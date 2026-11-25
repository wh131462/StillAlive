import type { DayKey } from '@still-alive/types';
import type { KnowledgeChunk, KnowledgeHit, KnowledgeQuery } from './knowledge-types';

const STOP_WORDS = new Set(['的', '了', '是', '我', '你', '他', '她', '在', '和', '与', '也', '都', '就', '很', '有', '吗', '呢', '吧', '啊', '什么', '怎么', '还有', '一下', '这个', '那个', '我们', '你们', '他们', 'the', 'a', 'an', 'is', 'are', 'and', 'or', 'of', 'to', 'in', 'on']);

export interface QueryTerms {
  terms: string[];
  ftsMatch: string | null;
  likePatterns: string[];
}

export interface ScoredChunk {
  chunk: KnowledgeChunk;
  score: number;
  matchedBy: Array<'fts' | 'like' | 'filter' | 'aggregate'>;
}

export interface PersonNameLookup {
  get(personId: string): string | undefined;
}

export function buildQueryTerms(text: string): QueryTerms {
  const normalized = text.replace(/[\p{P}\p{S}]+/gu, ' ').trim();
  const rawTerms = normalized.split(/\s+/u).flatMap((segment) => splitSegment(segment));
  const terms = [...new Set(rawTerms.map((term) => term.trim()).filter((term) => term.length >= 2 && !STOP_WORDS.has(term)))].slice(0, 16);
  const ftsTerms = terms.filter((term) => term.length >= 3);
  const likeTerms = terms.filter((term) => term.length < 3);
  return {
    terms,
    ftsMatch: ftsTerms.length ? ftsTerms.map((term) => `"${term.replaceAll('"', '""')}"`).join(' OR ') : null,
    likePatterns: likeTerms.map((term) => `%${term}%`),
  };
}

export function scoreChunks(input: {
  chunks: KnowledgeChunk[];
  terms: QueryTerms;
  matches: Map<string, Array<'fts' | 'like'>>;
  ranks?: Map<string, number>;
  personNames: PersonNameLookup;
  now?: number;
  scope?: KnowledgeQuery['scope'];
  preferredSourceIds?: Set<string>;
  excludePrivate?: boolean;
}): ScoredChunk[] {
  const now = input.now ?? Date.now();
  const scored = input.chunks.map((chunk) => {
    const matchedBy: Array<'fts' | 'like' | 'filter' | 'aggregate'> = [...(input.matches.get(chunk.id) ?? [])];
    let relevance = 0.2;
    const rank = input.ranks?.get(chunk.id);
    if (rank !== undefined) relevance = Math.max(0, 1 / (1 + Math.abs(rank)));
    else if (matchedBy.includes('like')) relevance = 0.35;
    if (chunk.sourceKind === 'aggregate') relevance += 0.15;

    const ageDays = chunk.dayKey ? Math.max(0, (now - new Date(`${chunk.dayKey}T12:00:00`).getTime()) / 86_400_000) : 365;
    const recency = Math.exp(-Math.max(0, ageDays) / 365);
    const haystack = `${chunk.title}\n${chunk.contextPrefix}\n${chunk.bodyText}`.toLowerCase();
    const fieldHits = input.terms.terms.filter((term) => haystack.includes(term.toLowerCase())).length;
    const personNames = chunk.personIds.map((id) => input.personNames.get(id) ?? '').join(' ');
    const personHit = input.terms.terms.some((term) => personNames.includes(term)) ? 1 : 0;
    const tagHit = input.terms.terms.some((term) => chunk.tagKeys.some((tag) => tag.includes(term))) ? 1 : 0;
    const preferred = input.preferredSourceIds?.has(chunk.sourceId) ? 0.2 : 0;
    const score = relevance * 0.55 + recency * 0.15 + Math.min(1, fieldHits / 3) * 0.1 + personHit * 0.1 + tagHit * 0.05 + (chunk.sourceKind === 'aggregate' ? 0.05 : 0) + preferred;
    return { chunk, score, matchedBy };
  });
  return scored
    .filter((item) => input.excludePrivate === false || !item.chunk.isPrivate)
    .filter((item) => item.matchedBy.length > 0 || item.score > 0.3)
    .filter((item) => !input.scope?.personId || item.chunk.personIds.includes(input.scope.personId))
    .filter((item) => !input.scope?.from || (item.chunk.dayKey ?? '') >= input.scope.from)
    .filter((item) => !input.scope?.to || (item.chunk.dayKey ?? '9999-99-99') <= input.scope.to)
    .filter((item) => !input.scope?.tag || item.chunk.tagKeys.some((tag) => tag.includes(input.scope?.tag ?? '')))
    .sort((left, right) => right.score - left.score);
}

export function packKnowledgeHits(input: {
  scored: ScoredChunk[];
  personNames: PersonNameLookup;
  tokenBudget: number;
  limit?: number;
  routeFor: (chunk: KnowledgeChunk) => string;
}): { hits: KnowledgeHit[]; usedTokens: number; truncated: boolean } {
  const hits: KnowledgeHit[] = [];
  let usedTokens = 0;
  let truncated = false;
  const seenSources = new Set<string>();
  for (const item of input.scored) {
    if (hits.length >= (input.limit ?? 8)) {
      truncated = true;
      break;
    }
    const sourceKey = `${item.chunk.sourceKind}:${item.chunk.sourceId}`;
    if (seenSources.has(sourceKey)) continue;
    if (usedTokens + item.chunk.tokenEstimate > input.tokenBudget) {
      truncated = true;
      continue;
    }
    seenSources.add(sourceKey);
    usedTokens += item.chunk.tokenEstimate;
    hits.push({
      id: item.chunk.id,
      sourceKind: item.chunk.sourceKind,
      sourceId: item.chunk.sourceId,
      title: item.chunk.title,
      snippet: makeSnippet(item.chunk.bodyText, item.chunk.contextPrefix),
      bodyText: item.chunk.bodyText,
      dayKey: item.chunk.dayKey,
      charStart: item.chunk.charStart,
      charEnd: item.chunk.charEnd,
      persons: item.chunk.personIds.map((id) => ({ id, name: input.personNames.get(id) ?? '' })).filter((person) => person.name),
      score: item.score,
      matchedBy: item.matchedBy,
      route: input.routeFor(item.chunk),
      citationId: `K${hits.length + 1}`,
    });
  }
  return { hits, usedTokens, truncated };
}

export function formatHitsForPrompt(hits: KnowledgeHit[]): string {
  return hits.map((hit) => {
    const meta = [hit.dayKey?.replaceAll('-', '.'), hit.persons.map((person) => person.name).join('、')].filter(Boolean).join(' · ');
    return `[${hit.citationId}]${meta ? `（${meta}）` : ''} ${hit.title}\n${hit.snippet}`;
  }).join('\n\n');
}

export function makeSnippet(body: string, contextPrefix: string): string {
  const compact = body.replace(/\s+/gu, ' ').trim();
  return compact.length > 160 ? `${compact.slice(0, 160)}…` : compact || contextPrefix;
}

export function routeForKnowledgeSource(kind: KnowledgeChunk['sourceKind'], sourceId: string, excerptBookId?: string | null): string {
  if (kind === 'post' || kind === 'comments') return `/post/${sourceId}`;
  if (kind === 'person') return `/person/${sourceId}`;
  if (kind === 'excerpt') return excerptBookId ? `/reader?bookId=${excerptBookId}` : '/excerpts';
  if (kind === 'aggregate') return '/ai';
  return '/ai';
}

function splitSegment(segment: string): string[] {
  const result: string[] = [];
  const parts = segment.match(/[\u3400-\u9fff\uf900-\ufaff]+|[a-zA-Z0-9]+/gu);
  if (!parts) return result;
  for (const part of parts) {
    if (/^[a-zA-Z0-9]+$/u.test(part)) {
      result.push(part.toLowerCase());
      continue;
    }
    if (part.length <= 2) {
      result.push(part);
      continue;
    }
    if (part.length <= 4) {
      result.push(part);
      for (let index = 0; index + 3 <= part.length; index += 1) result.push(part.slice(index, index + 3));
      continue;
    }
    // 长中文串：生成滑动 3 字窗口，供 trigram 检索命中。
    let windows = 0;
    for (let index = 0; index + 3 <= part.length && windows < 10; index += 1) {
      result.push(part.slice(index, index + 3));
      windows += 1;
    }
  }
  return result;
}

export function toDayKey(value: string | null): DayKey | null {
  return value && /^\d{4}-\d{2}-\d{2}$/u.test(value) ? (value as DayKey) : null;
}
