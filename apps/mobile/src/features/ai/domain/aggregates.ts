import type { CheckIn, LedgerTransaction, Person, PersonTagAssignment, Post } from '@still-alive/types';
import type { AggregateKind, KnowledgeAggregate, KnowledgeDataInput } from './knowledge-types';
import { hashText, stripMarkdown } from './knowledge-types';

const DAY_AGGREGATE_DAYS = 120;

interface AggregateDraft {
  kind: AggregateKind;
  scopeKey: string;
  title: string;
  lines: string[];
  stats: Record<string, unknown> | null;
  sourceRefs: Array<{ kind: string; id: string }>;
  revisionParts: string[];
}

export function buildDeterministicAggregates(input: KnowledgeDataInput, now = new Date().toISOString()): KnowledgeAggregate[] {
  const drafts: AggregateDraft[] = [
    ...buildMonthAggregates(input),
    ...buildYearAggregates(input),
    ...buildPersonAggregates(input),
    ...buildTagAggregates(input),
    ...buildLedgerAggregates(input),
    ...buildReadingAggregate(input),
    ...buildMusicAggregate(input),
    ...buildDayAggregates(input),
  ];
  return drafts
    .filter((draft) => draft.lines.length > 0)
    .map((draft) => ({
      id: `knowledge_aggregate_${draft.kind}_${scopeKeyToId(draft.scopeKey)}`,
      kind: draft.kind,
      scopeKey: draft.scopeKey,
      title: draft.title,
      bodyMarkdown: draft.lines.join('\n'),
      statsJson: draft.stats ? JSON.stringify(draft.stats) : null,
      sourceRefs: draft.sourceRefs,
      generator: 'deterministic',
      modelId: null,
      sourceRevision: hashText(draft.revisionParts.sort().join('|')),
      stale: false,
      generatedAt: now,
      updatedAt: now,
    }));
}

function buildMonthAggregates(input: KnowledgeDataInput): AggregateDraft[] {
  const byMonth = new Map<string, { posts: Post[]; checkIns: CheckIn[]; ledger: LedgerTransaction[]; personIds: Set<string>; cities: Set<string> }>();
  for (const post of input.posts) {
    const month = post.dayKey.slice(0, 7);
    const entry = byMonth.get(month) ?? { posts: [], checkIns: [], ledger: [], personIds: new Set<string>(), cities: new Set<string>() };
    entry.posts.push(post);
    byMonth.set(month, entry);
  }
  for (const checkIn of input.checkIns) {
    const entry = byMonth.get(checkIn.dayKey.slice(0, 7));
    if (!entry) continue;
    entry.checkIns.push(checkIn);
    if (checkIn.city?.trim()) entry.cities.add(checkIn.city.trim());
  }
  for (const transaction of input.ledgerTransactions) {
    const entry = byMonth.get(transaction.dayKey.slice(0, 7));
    if (!entry) continue;
    entry.ledger.push(transaction);
  }
  const postPersons = new Map<string, string[]>();
  for (const relation of input.postPersons) postPersons.set(relation.postId, [...(postPersons.get(relation.postId) ?? []), relation.personId]);

  return [...byMonth.entries()].map(([month, entry]) => {
    const personIds = new Set(entry.posts.flatMap((post) => postPersons.get(post.id) ?? []));
    const expense = entry.ledger.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amountCents, 0);
    const income = entry.ledger.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountCents, 0);
    const lines = [
      `# ${month} 月汇总`,
      `- 记录 ${entry.posts.length} 条`,
      `- 打卡 ${entry.checkIns.length} 天`,
      `- 关联人物 ${personIds.size} 人`,
      `- 留下城市的记录 ${entry.cities.size} 个`,
    ];
    if (entry.ledger.length) lines.push(`- 支出 ${formatMoney(expense)}，收入 ${formatMoney(income)}`);
    const recent = entry.posts.slice(0, 5).map((post) => `${post.dayKey.slice(8)} 日：${titleOf(post)}`).filter(Boolean);
    if (recent.length) lines.push('', '代表记录：', ...recent.map((item) => `- ${item}`));
    return {
      kind: 'month' as const,
      scopeKey: month,
      title: `${month} 月汇总`,
      lines,
      stats: { posts: entry.posts.length, checks: entry.checkIns.length, people: personIds.size, expenseCents: expense, incomeCents: income },
      sourceRefs: entry.posts.slice(0, 20).map((post) => ({ kind: 'post', id: post.id })),
      revisionParts: entry.posts.map((post) => post.updatedAt),
    };
  });
}

function buildYearAggregates(input: KnowledgeDataInput): AggregateDraft[] {
  const byYear = new Map<string, Post[]>();
  for (const post of input.posts) {
    const year = post.dayKey.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), post]);
  }
  return [...byYear.entries()].map(([year, posts]) => {
    const peopleCount = new Set(input.postPersons.filter((relation) => posts.some((post) => post.id === relation.postId)).map((relation) => relation.personId)).size;
    const days = new Set(posts.map((post) => post.dayKey)).size;
    const expense = input.ledgerTransactions.filter((item) => item.dayKey.startsWith(year) && item.type === 'expense').reduce((sum, item) => sum + item.amountCents, 0);
    return {
      kind: 'year' as const,
      scopeKey: year,
      title: `${year} 年回顾`,
      lines: [
        `# ${year} 年回顾`,
        `- 记录 ${posts.length} 条，分布在 ${days} 天`,
        `- 关联人物 ${peopleCount} 人`,
        ...(expense ? [`- 当年支出 ${formatMoney(expense)}`] : []),
      ],
      stats: { posts: posts.length, days, people: peopleCount, expenseCents: expense },
      sourceRefs: posts.slice(0, 30).map((post) => ({ kind: 'post', id: post.id })),
      revisionParts: posts.map((post) => post.updatedAt),
    };
  });
}

function buildPersonAggregates(input: KnowledgeDataInput): AggregateDraft[] {
  const postsByPerson = new Map<string, Post[]>();
  for (const relation of input.postPersons) {
    const post = input.posts.find((item) => item.id === relation.postId);
    if (!post) continue;
    postsByPerson.set(relation.personId, [...(postsByPerson.get(relation.personId) ?? []), post]);
  }
  return input.people.map((person) => {
    const posts = (postsByPerson.get(person.id) ?? []).sort((left, right) => right.dayKey.localeCompare(left.dayKey));
    const events = input.personEvents.filter((event) => event.personId === person.id);
    const tags = input.personTags.filter((tag) => tag.personId === person.id).map((tag) => tag.kind === 'custom' ? tag.value : `${tag.kind}:${tag.value}`);
    const lines = [`# ${person.name} 的档案`];
    if (person.relationToMe?.trim()) lines.push(`- 与我的关系：${person.relationToMe.trim()}`);
    if (person.bio?.trim()) lines.push(`- 简介：${person.bio.trim()}`);
    if (person.impression?.trim()) lines.push(`- 印象：${person.impression.trim()}`);
    if (tags.length) lines.push(`- 标签：${tags.join('、')}`);
    lines.push(`- 共同记录 ${posts.length} 条，人物事件 ${events.length} 个`);
    if (posts.length) lines.push(`- 最近一次记录：${posts[0]?.dayKey ?? ''}`);
    const recent = posts.slice(0, 5).map((post) => `- ${post.dayKey}：${titleOf(post)}`);
    if (recent.length) lines.push('', '最近记录：', ...recent);
    return {
      kind: 'person' as const,
      scopeKey: person.id,
      title: `${person.name} 档案`,
      lines,
      stats: { posts: posts.length, events: events.length },
      sourceRefs: [{ kind: 'person', id: person.id }, ...posts.slice(0, 20).map((post) => ({ kind: 'post', id: post.id }))],
      revisionParts: [person.updatedAt, ...posts.map((post) => post.updatedAt), ...events.map((event) => event.updatedAt)],
    };
  });
}

function buildTagAggregates(input: KnowledgeDataInput): AggregateDraft[] {
  const groups = new Map<string, { people: Person[]; tags: PersonTagAssignment[] }>();
  for (const tag of input.personTags) {
    const key = tag.kind === 'custom' ? tag.value : `${tag.kind}:${tag.value}`;
    const person = input.people.find((item) => item.id === tag.personId);
    if (!person) continue;
    const entry = groups.get(key) ?? { people: [], tags: [] };
    entry.people.push(person);
    entry.tags.push(tag);
    groups.set(key, entry);
  }
  return [...groups.entries()].map(([key, entry]) => ({
    kind: 'tag' as const,
    scopeKey: key,
    title: `标签 · ${key}`,
    lines: [`# 标签：${key}`, `- 人物 ${entry.people.length} 人：${entry.people.map((person) => person.name).join('、')}`],
    stats: { people: entry.people.length },
    sourceRefs: entry.people.map((person) => ({ kind: 'person', id: person.id })),
    revisionParts: entry.people.map((person) => person.updatedAt),
  }));
}

function buildLedgerAggregates(input: KnowledgeDataInput): AggregateDraft[] {
  const byMonth = new Map<string, LedgerTransaction[]>();
  for (const transaction of input.ledgerTransactions) {
    const month = transaction.dayKey.slice(0, 7);
    byMonth.set(month, [...(byMonth.get(month) ?? []), transaction]);
  }
  return [...byMonth.entries()].map(([month, transactions]) => {
    const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amountCents, 0);
    const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountCents, 0);
    const categories = new Map<string, number>();
    for (const item of transactions.filter((entry) => entry.type === 'expense')) categories.set(item.category, (categories.get(item.category) ?? 0) + item.amountCents);
    const top = [...categories.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5);
    return {
      kind: 'ledger' as const,
      scopeKey: month,
      title: `${month} 账本汇总`,
      lines: [
        `# ${month} 账本汇总`,
        `- 支出 ${formatMoney(expense)}，收入 ${formatMoney(income)}，结余 ${formatMoney(income - expense)}`,
        ...(top.length ? ['- 支出分类：', ...top.map(([category, cents]) => `  - ${category} ${formatMoney(cents)}`)] : []),
        `- 共 ${transactions.length} 笔`,
      ],
      stats: { expenseCents: expense, incomeCents: income, count: transactions.length },
      sourceRefs: transactions.slice(0, 50).map((item) => ({ kind: 'ledger', id: item.id })),
      revisionParts: transactions.map((item) => item.updatedAt),
    };
  });
}

function buildReadingAggregate(input: KnowledgeDataInput): AggregateDraft[] {
  if (!input.bookExcerpts.length && !input.books.length) return [];
  const booksWithExcerpts = new Set(input.bookExcerpts.map((excerpt) => excerpt.bookId ?? excerpt.bookTitle ?? ''));
  const lines = ['# 阅读汇总', `- 书架 ${input.books.length} 本，其中 ${booksWithExcerpts.size} 本书有摘抄`, `- 摘抄 ${input.bookExcerpts.length} 条`];
  const recent = input.bookExcerpts.slice(0, 8).map((excerpt) => `- ${excerpt.bookTitle ?? '未知书籍'}：${excerpt.text.slice(0, 60)}`);
  if (recent.length) lines.push('', '最近摘抄：', ...recent);
  return [{
    kind: 'reading' as const,
    scopeKey: 'all',
    title: '阅读汇总',
    lines,
    stats: { books: input.books.length, excerpts: input.bookExcerpts.length },
    sourceRefs: [...input.books.slice(0, 20).map((book) => ({ kind: 'book', id: book.id })), ...input.bookExcerpts.slice(0, 20).map((excerpt) => ({ kind: 'excerpt', id: excerpt.id }))],
    revisionParts: [...input.books.map((book) => book.updatedAt), ...input.bookExcerpts.map((excerpt) => excerpt.createdAt)],
  }];
}

function buildMusicAggregate(input: KnowledgeDataInput): AggregateDraft[] {
  if (!input.musicTracks.length) return [];
  const topArtists = new Map<string, number>();
  for (const track of input.musicTracks) {
    const artist = track.artist?.trim() || '未知歌手';
    topArtists.set(artist, (topArtists.get(artist) ?? 0) + track.playCount);
  }
  const collectionCount = input.musicCollectionEntries.length;
  return [{
    kind: 'music' as const,
    scopeKey: 'all',
    title: '音乐汇总',
    lines: [
      '# 音乐汇总',
      `- 曲库 ${input.musicTracks.length} 首，收藏 ${collectionCount} 条`,
      '- 常听歌手：',
      ...[...topArtists.entries()].sort((left, right) => right[1] - left[1]).slice(0, 8).map(([artist, plays]) => `  - ${artist}（${plays} 次播放）`),
    ],
    stats: { tracks: input.musicTracks.length, collections: collectionCount },
    sourceRefs: input.musicTracks.slice(0, 30).map((track) => ({ kind: 'music', id: track.id })),
    revisionParts: input.musicTracks.map((track) => track.updatedAt),
  }];
}

function buildDayAggregates(input: KnowledgeDataInput): AggregateDraft[] {
  const cutoff = Date.now() - DAY_AGGREGATE_DAYS * 24 * 60 * 60 * 1000;
  const byDay = new Map<string, Post[]>();
  for (const post of input.posts) {
    const time = new Date(`${post.dayKey}T00:00:00`).getTime();
    if (Number.isFinite(time) && time < cutoff) continue;
    byDay.set(post.dayKey, [...(byDay.get(post.dayKey) ?? []), post]);
  }
  return [...byDay.entries()].map(([day, posts]) => {
    const city = input.checkIns.find((checkIn) => checkIn.dayKey === day)?.city?.trim();
    const personIds = new Set(input.postPersons.filter((relation) => posts.some((post) => post.id === relation.postId)).map((relation) => relation.personId));
    return {
      kind: 'day' as const,
      scopeKey: day,
      title: `${day} 记录`,
      lines: [
        `# ${day}`,
        ...(city ? [`- 城市：${city}`] : []),
        `- 记录 ${posts.length} 条，关联人物 ${personIds.size} 人`,
        ...posts.slice(0, 4).map((post) => `- ${titleOf(post)}`),
      ],
      stats: { posts: posts.length, people: personIds.size },
      sourceRefs: posts.map((post) => ({ kind: 'post', id: post.id })),
      revisionParts: posts.map((post) => post.updatedAt),
    };
  });
}

function titleOf(post: Post): string {
  const line = stripMarkdown(post.bodyMarkdown).split('\n').map((item) => item.trim()).find(Boolean) ?? '';
  return line.slice(0, 30) || '无标题记录';
}

function formatMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function scopeKeyToId(scopeKey: string): string {
  return scopeKey.replace(/[^a-z0-9]+/giu, '_').slice(0, 64);
}

