import type { StillAliveRepository } from '../../infrastructure/database/repository-contract';
import { buildAggregateChunks, buildKnowledgeSources } from '../../features/ai/domain/chunker';
import { buildDeterministicAggregates } from '../../features/ai/domain/aggregates';
import type { KnowledgeDataInput } from '../../features/ai/domain/knowledge-types';

export const KNOWLEDGE_INDEX_VERSION = 'knowledge-v2';
const BATCH_SIZE = 25;

export interface KnowledgeIndexResult {
  indexed: number;
  deleted: number;
  chunks: number;
  aggregates: number;
  durationMs: number;
}

export async function ensureKnowledgeIndex(input: {
  repository: StillAliveRepository;
  data: KnowledgeDataInput;
  force?: boolean;
  onProgress?: (indexed: number, total: number) => void;
}): Promise<KnowledgeIndexResult> {
  const startedAt = Date.now();
  const now = new Date().toISOString();
  const [existingSources, indexVersion, lastIndexedAt] = await Promise.all([
    input.repository.listKnowledgeSources(),
    input.repository.getKnowledgeState('index_version'),
    input.repository.getKnowledgeState('last_indexed_at'),
  ]);
  const force = Boolean(input.force) || indexVersion !== KNOWLEDGE_INDEX_VERSION || (!existingSources.length && !lastIndexedAt && hasAnyData(input.data));
  const existingByKey = new Map(existingSources.map((source) => [`${source.sourceKind}:${source.sourceId}`, source]));

  const aggregates = buildDeterministicAggregates(input.data, now);
  const bundles = [...buildKnowledgeSources(input.data, now), ...buildAggregateChunks(aggregates, now)];
  const currentKeys = new Set(bundles.map((bundle) => `${bundle.sourceKind}:${bundle.sourceId}`));
  const missing = existingSources
    .filter((source) => !currentKeys.has(`${source.sourceKind}:${source.sourceId}`))
    .map((source) => ({ sourceKind: source.sourceKind, sourceId: source.sourceId }));
  if (missing.length) await input.repository.deleteKnowledgeSources(missing);

  const changed = bundles.filter((bundle) => {
    if (force) return true;
    const existing = existingByKey.get(`${bundle.sourceKind}:${bundle.sourceId}`);
    return !existing || existing.contentHash !== bundle.contentHash;
  });

  let indexed = 0;
  let chunkCount = 0;
  for (let start = 0; start < changed.length; start += BATCH_SIZE) {
    const batch = changed.slice(start, start + BATCH_SIZE);
    await input.repository.replaceKnowledgeSources(batch.map((bundle) => ({
      sourceKind: bundle.sourceKind,
      sourceId: bundle.sourceId,
      contentHash: bundle.contentHash,
      indexedAt: now,
      chunks: bundle.chunks,
    })));
    indexed += batch.length;
    chunkCount += batch.reduce((sum, bundle) => sum + bundle.chunks.length, 0);
    input.onProgress?.(indexed, changed.length);
    await yieldToUi();
  }

  if (aggregates.length) await input.repository.saveKnowledgeAggregates(aggregates);
  await input.repository.setKnowledgeState('index_version', KNOWLEDGE_INDEX_VERSION);
  await input.repository.setKnowledgeState('last_indexed_at', now);
  await input.repository.setKnowledgeState('aggregate_count', String(aggregates.length));

  return {
    indexed,
    deleted: missing.length,
    chunks: chunkCount,
    aggregates: aggregates.length,
    durationMs: Date.now() - startedAt,
  };
}

export function buildKnowledgeData(input: {
  posts: KnowledgeDataInput['posts'];
  people: KnowledgeDataInput['people'];
  personEvents: KnowledgeDataInput['personEvents'];
  postPersons: Array<{ postId: string; personId: string }>;
  personTags: KnowledgeDataInput['personTags'];
  bookExcerpts: KnowledgeDataInput['bookExcerpts'];
  books: KnowledgeDataInput['books'];
  ledgerTransactions: KnowledgeDataInput['ledgerTransactions'];
  checkIns: KnowledgeDataInput['checkIns'];
  musicTracks: KnowledgeDataInput['musicTracks'];
  musicCollectionEntries: KnowledgeDataInput['musicCollectionEntries'];
  personBooks: KnowledgeDataInput['personBooks'];
  self: KnowledgeDataInput['self'];
  today: KnowledgeDataInput['today'];
}): KnowledgeDataInput {
  return {
    posts: input.posts,
    people: input.people,
    personEvents: input.personEvents,
    postPersons: input.postPersons,
    personTags: input.personTags,
    bookExcerpts: input.bookExcerpts,
    books: input.books,
    ledgerTransactions: input.ledgerTransactions,
    checkIns: input.checkIns,
    musicTracks: input.musicTracks,
    musicCollectionEntries: input.musicCollectionEntries,
    personBooks: input.personBooks,
    self: input.self,
    today: input.today,
  };
}

function hasAnyData(data: KnowledgeDataInput): boolean {
  return data.posts.length > 0 || data.people.length > 0 || data.bookExcerpts.length > 0 || data.ledgerTransactions.length > 0 || data.musicTracks.length > 0;
}

function yieldToUi(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

