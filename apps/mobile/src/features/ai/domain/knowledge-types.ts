import type { Birthday, Book, BookExcerpt, CheckIn, DayKey, LedgerTransaction, MusicCollectionEntry, MusicTrack, Person, PersonBook, PersonEvent, PersonTagAssignment, Post } from '@still-alive/types';

export type KnowledgeSourceKind = 'post' | 'comments' | 'person' | 'person_event' | 'excerpt' | 'aggregate';
export type AggregateKind = 'day' | 'week' | 'month' | 'year' | 'person' | 'tag' | 'ledger' | 'reading' | 'music';
export type AggregateGenerator = 'deterministic' | 'ai';

export interface KnowledgeSourceSignature {
  sourceKind: KnowledgeSourceKind;
  sourceId: string;
  contentHash: string;
  chunkCount: number;
  indexedAt: string;
}

export interface KnowledgeChunk {
  id: string;
  sourceKind: KnowledgeSourceKind;
  sourceId: string;
  chunkIndex: number;
  dayKey: DayKey | null;
  personIds: string[];
  tagKeys: string[];
  title: string;
  contextPrefix: string;
  bodyText: string;
  charStart: number;
  charEnd: number;
  isPrivate: boolean;
  tokenEstimate: number;
  contentHash: string;
  sourceUpdatedAt: string | null;
  indexedAt: string;
}

export interface KnowledgeAggregate {
  id: string;
  kind: AggregateKind;
  scopeKey: string;
  title: string;
  bodyMarkdown: string;
  statsJson: string | null;
  sourceRefs: Array<{ kind: string; id: string }>;
  generator: AggregateGenerator;
  modelId: string | null;
  sourceRevision: string;
  stale: boolean;
  generatedAt: string;
  updatedAt: string;
}

export interface KnowledgeStats {
  chunks: number;
  aggregates: number;
  lastIndexedAt: string | null;
  backfillDone: boolean;
}

export interface KnowledgeDataInput {
  posts: Post[];
  people: Person[];
  personEvents: PersonEvent[];
  postPersons: Array<{ postId: string; personId: string }>;
  personTags: PersonTagAssignment[];
  bookExcerpts: BookExcerpt[];
  books: Book[];
  ledgerTransactions: LedgerTransaction[];
  checkIns: CheckIn[];
  musicTracks: MusicTrack[];
  musicCollectionEntries: MusicCollectionEntry[];
  personBooks: PersonBook[];
  self: { name: string; birthday: Birthday | null };
  today: DayKey;
}

export type MemoryKind = 'semantic' | 'episodic' | 'procedural';
export type MemorySubjectType = 'self' | 'person' | 'topic';
export type MemoryStatus = 'pending' | 'active' | 'archived' | 'suppressed' | 'deleted';
export type MemoryOrigin = 'user' | 'derived' | 'ai_auto';

export interface MemorySubject {
  type: MemorySubjectType;
  id: string | null;
}

export interface MemorySourceRef {
  sourceKind: string;
  sourceId: string;
}

export interface MemoryItem {
  id: string;
  kind: MemoryKind;
  subjectType: MemorySubjectType;
  subjectId: string | null;
  content: string;
  confidence: number;
  importance: 1 | 2 | 3;
  status: MemoryStatus;
  origin: MemoryOrigin;
  validFrom: string | null;
  validTo: string | null;
  recordedAt: string;
  lastConfirmedAt: string | null;
  extractionBatchId: string | null;
  lastUsedAt: string | null;
  useCount: number;
  contentHash: string;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRevision {
  id: string;
  memoryId: string;
  action: string;
  beforeJson: string | null;
  afterJson: string | null;
  reason: string | null;
  createdAt: string;
}

export interface MemorySourceRow {
  memoryId: string;
  sourceKind: string;
  sourceId: string;
}

export interface KnowledgeQuery {
  text: string;
  scope?: { personId?: string; from?: DayKey; to?: DayKey; tag?: string; bookId?: string };
  limit?: number;
  tokenBudget?: number;
  includeAggregates?: boolean;
  now?: string;
}

export interface KnowledgeHit {
  id: string;
  sourceKind: KnowledgeSourceKind;
  sourceId: string;
  title: string;
  snippet: string;
  bodyText: string;
  dayKey: DayKey | null;
  charStart: number;
  charEnd: number;
  persons: Array<{ id: string; name: string }>;
  score: number;
  matchedBy: Array<'fts' | 'like' | 'filter' | 'aggregate'>;
  route: string;
  citationId: string;
}

const CJK_PATTERN = /[\u3400-\u9fff\uf900-\ufaff]/u;

export function stripMarkdown(markdown: string): string {
  if (!markdown) return '';
  return markdown
    .replace(/!\[([^\]]*)\]\(audio:\/\/[^)]*\)/gu, '[语音]')
    .replace(/!\[([^\]]*)\]\(media:\/\/[^)]*\)/gu, (_match, alt: string) => alt ? `[${alt}]` : '[媒体]')
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, (_match, alt: string) => alt ? `[${alt}]` : '[图片]')
    .replace(/\[\[(?:date|datetime):[^\]]+\]\]/gu, '[日期]')
    .replace(/```[\s\S]*?```/gu, (block) => block.replace(/```[a-zA-Z]*\n?/gu, '').replace(/```/gu, ''))
    .replace(/`([^`]+)`/gu, '$1')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/gu, '$1')
    .replace(/^#{1,6}\s+/gmu, '')
    .replace(/^>\s?/gmu, '')
    .replace(/^[-*+]\s+/gmu, '')
    .replace(/^\d+\.\s+/gmu, '')
    .replace(/[*_~]{1,3}/gu, '')
    .replace(/<\s*br\s*\/?>/giu, '\n')
    .replace(/<[^>]+>/gu, '')
    .replace(/\n{3,}/gu, '\n\n')
    .trim();
}

/** 保守估算：CJK 约 0.8 token/字，其它按 4 字符 1 token，再加 10% 余量。 */
export function estimateTokens(text: string): number {
  let cjk = 0;
  let other = 0;
  for (const char of text) {
    if (CJK_PATTERN.test(char)) cjk += 1;
    else other += 1;
  }
  return Math.ceil((cjk * 0.8 + other / 4) * 1.1);
}

export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function createLocalEntityId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function trigramSet(text: string): Set<string> {
  const normalized = text.replace(/\s+/gu, ' ').trim();
  const result = new Set<string>();
  for (let index = 0; index <= normalized.length - 3; index += 1) result.add(normalized.slice(index, index + 3));
  return result;
}

export function jaccardSimilarity(left: string, right: string): number {
  const a = trigramSet(left);
  const b = trigramSet(right);
  if (!a.size || !b.size) return contentFallbackSimilarity(left, right);
  let intersection = 0;
  for (const item of a) if (b.has(item)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

function contentFallbackSimilarity(left: string, right: string): number {
  const a = left.trim();
  const b = right.trim();
  return a === b && a.length > 0 ? 1 : 0;
}

export function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
