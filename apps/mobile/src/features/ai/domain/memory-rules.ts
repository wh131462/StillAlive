import type { MemoryItem, MemoryKind, MemoryOrigin, MemorySourceRef, MemorySubject } from './knowledge-types';
import { createLocalEntityId, hashText, jaccardSimilarity } from './knowledge-types';

export interface MemoryDraft {
  content: string;
  kind: MemoryKind;
  subject: MemorySubject;
  origin: MemoryOrigin;
  confidence?: number | undefined;
  importance?: 1 | 2 | 3 | undefined;
  sources: MemorySourceRef[];
  extractionBatchId?: string | null | undefined;
  now?: string | undefined;
}

export interface MemoryWritePlan {
  item: MemoryItem;
  mergedMemoryId: string | null;
  invalidatedMemoryIds: string[];
  revisionAction: 'create' | 'auto_extract' | 'update';
  reason: string;
}

export interface MemoryHit {
  item: MemoryItem;
  score: number;
}

const CONFLICT_MARKERS = ['不再', '改成', '现在', '已经', '换了', '不喜欢了', '不是了'];

export function normalizeMemoryContent(content: string): string {
  return content.replace(/\s+/gu, ' ').trim();
}

export function isConflictingContent(newContent: string, previousContent: string): boolean {
  if (!CONFLICT_MARKERS.some((marker) => newContent.includes(marker))) return false;
  return jaccardSimilarity(newContent, previousContent) >= 0.15;
}

export function planMemoryWrite(draft: MemoryDraft, existing: MemoryItem[], now = new Date().toISOString()): MemoryWritePlan {
  const content = normalizeMemoryContent(draft.content);
  const contentHash = hashText(content.toLowerCase());
  const origin = draft.origin;
  const confidence = draft.confidence ?? (origin === 'user' ? 1 : origin === 'derived' ? 0.7 : 0.5);
  const importance: 1 | 2 | 3 = draft.importance ?? (origin === 'user' ? 3 : origin === 'derived' ? 1 : 2);
  const batchId = draft.extractionBatchId ?? null;
  const base: MemoryItem = {
    id: createLocalEntityId('memory'),
    kind: draft.kind,
    subjectType: draft.subject.type,
    subjectId: draft.subject.id,
    content,
    confidence,
    importance,
    status: 'active',
    origin,
    validFrom: now,
    validTo: null,
    recordedAt: now,
    lastConfirmedAt: now,
    extractionBatchId: batchId,
    lastUsedAt: null,
    useCount: 0,
    contentHash,
    createdAt: now,
    updatedAt: now,
  };
  if (!content) return { item: base, mergedMemoryId: null, invalidatedMemoryIds: [], revisionAction: origin === 'user' ? 'create' : 'auto_extract', reason: 'empty' };

  const active = existing.filter((item) => item.status === 'active' && item.validTo === null);
  const exact = active.find((item) => item.contentHash === contentHash);
  if (exact) {
    const merged: MemoryItem = {
      ...exact,
      confidence: Math.max(exact.confidence, confidence),
      importance: Math.max(exact.importance, importance) as 1 | 2 | 3,
      lastConfirmedAt: now,
      updatedAt: now,
      extractionBatchId: batchId ?? exact.extractionBatchId,
    };
    return { item: merged, mergedMemoryId: merged.id, invalidatedMemoryIds: [], revisionAction: origin === 'user' ? 'update' : 'auto_extract', reason: 'duplicate' };
  }

  const sameSubject = active.filter((item) => item.kind === draft.kind && item.subjectType === draft.subject.type && item.subjectId === draft.subject.id);
  const similar = sameSubject.find((item) => jaccardSimilarity(content, item.content) >= 0.7);
  if (similar) {
    const merged: MemoryItem = {
      ...similar,
      content: similar.content.length >= content.length ? similar.content : content,
      confidence: Math.max(similar.confidence, confidence),
      importance: Math.max(similar.importance, importance) as 1 | 2 | 3,
      lastConfirmedAt: now,
      updatedAt: now,
      extractionBatchId: batchId ?? similar.extractionBatchId,
    };
    return { item: merged, mergedMemoryId: merged.id, invalidatedMemoryIds: [], revisionAction: origin === 'user' ? 'update' : 'auto_extract', reason: 'similar' };
  }

  const conflict = origin !== 'user' ? sameSubject.find((item) => item.origin !== 'user' && isConflictingContent(content, item.content)) : undefined;
  return {
    item: base,
    mergedMemoryId: null,
    invalidatedMemoryIds: conflict ? [conflict.id] : [],
    revisionAction: origin === 'user' ? 'create' : 'auto_extract',
    reason: conflict ? 'conflict' : 'new',
  };
}

export function scoreMemories(input: {
  memories: MemoryItem[];
  question: string;
  subject?: { type: MemorySubject['type']; id: string | null };
  now?: number;
}): MemoryHit[] {
  const now = input.now ?? Date.now();
  const question = input.question.trim();
  return input.memories
    .filter((item) => item.status === 'active' && item.validTo === null)
    .map((item) => {
      const ageDays = Math.max(0, (now - new Date(item.recordedAt).getTime()) / 86_400_000);
      const recency = Math.exp(-ageDays / 180);
      const relevance = question && jaccardSimilarity(question, item.content) > 0 ? Math.min(1, jaccardSimilarity(question, item.content) * 2) : 0.1;
      const subjectBoost = input.subject && item.subjectType === input.subject.type && item.subjectId === input.subject.id ? 0.25 : 0;
      const score = relevance * 0.5 + recency * 0.2 + (item.importance / 3) * 0.15 + item.confidence * 0.1 + Math.min(0.05, Math.log1p(item.useCount) / 100) + subjectBoost;
      return { item, score };
    })
    .sort((left, right) => right.score - left.score);
}

export function selectCoreMemories(memories: MemoryItem[]): MemoryItem[] {
  const candidates = memories.filter((item) => item.status === 'active' && item.validTo === null && item.kind !== 'episodic');
  const selected: MemoryItem[] = [];
  let chars = 0;
  for (const item of candidates.sort((left, right) => right.importance - left.importance || (right.lastUsedAt ?? '').localeCompare(left.lastUsedAt ?? ''))) {
    if (chars + item.content.length > 1200) continue;
    selected.push(item);
    chars += item.content.length;
  }
  return selected;
}

export function formatMemoriesForPrompt(memories: MemoryHit[]): string {
  return memories.map((hit, index) => `<memory id="M${index + 1}" origin="${hit.item.origin}">${hit.item.content}</memory>`).join('\n');
}

export function createMemoryRevisionJson(item: MemoryItem): string {
  return JSON.stringify({ id: item.id, content: item.content, status: item.status, origin: item.origin, updatedAt: item.updatedAt });
}
