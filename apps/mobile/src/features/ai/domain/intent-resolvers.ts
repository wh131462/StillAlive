import type { DayKey, MusicTrack, Person, Post } from '@still-alive/types';
import { nextBirthday } from '../../people/person-profile';
import type { KnowledgeDataInput } from './knowledge-types';
import { stripMarkdown } from './knowledge-types';
import { formatLocalDayKey, lunarDayLabel } from './time-context';

export type StructuredQuery =
  | { kind: 'birthdays'; withinDays: number; focusPersonId?: string; includeSelf?: boolean }
  | { kind: 'people'; nameLike?: string; tag?: string; relation?: string }
  | { kind: 'music'; artist?: string; title?: string; personId?: string }
  | { kind: 'ledger'; month?: string; from?: DayKey; to?: DayKey; type?: 'expense' | 'income'; category?: string }
  | { kind: 'posts'; personId?: string; from?: DayKey; to?: DayKey; latest?: boolean; keyword?: string }
  | { kind: 'excerpts'; bookTitle?: string; keyword?: string }
  | { kind: 'counts' };

export interface StructuredFact {
  label: string;
  value: string;
  citationId: string;
  source: { kind: string; id: string } | null;
}

export interface StructuredResult {
  kind: StructuredQuery['kind'];
  facts: StructuredFact[];
  renderedText: string;
  entityIds: { postIds: string[]; personIds: string[]; trackIds: string[]; bookIds: string[] };
}

export interface CombinedStructuredResult {
  facts: StructuredFact[];
  renderedText: string;
  entityIds: { postIds: string[]; personIds: string[]; trackIds: string[]; bookIds: string[] };
}

const BIRTHDAY_KEYWORDS = ['生日', '过生', '几号生', '农历'];
const MUSIC_KEYWORDS = ['听', '歌', '音乐', '歌手', '播放', '专辑'];
const LEDGER_KEYWORDS = ['花', '支出', '收入', '账', '钱', '余额', '开销'];
const POSTS_KEYWORDS = ['最近', '第一次', '见面', '记录', '日记', '那段时间'];
const COUNT_KEYWORDS = ['多少天', '多少条', '几天', '记录天数', '打卡', '多少张', '多少首'];
const BOOK_KEYWORDS = ['书', '摘抄', '读', '笔记'];
const PEOPLE_KEYWORDS = ['谁', '标签', '关系', '认识', '资料'];

export function routeStructuredQueries(question: string, data: KnowledgeDataInput, now = new Date()): StructuredQuery[] {
  const queries: StructuredQuery[] = [];
  const text = question.trim();
  if (!text) return queries;
  const person = findMentionedPerson(text, data.people);
  const ranges = parseDateExpression(text, now);
  const asksBirthday = BIRTHDAY_KEYWORDS.some((keyword) => text.includes(keyword));
  const asksMusic = MUSIC_KEYWORDS.some((keyword) => text.includes(keyword));
  const asksLedger = LEDGER_KEYWORDS.some((keyword) => text.includes(keyword));
  const asksBooks = BOOK_KEYWORDS.some((keyword) => text.includes(keyword));
  const asksCounts = COUNT_KEYWORDS.some((keyword) => text.includes(keyword));

  if (asksBirthday) {
    queries.push({
      kind: 'birthdays',
      withinDays: 60,
      ...(person ? { focusPersonId: person.id } : {}),
      ...(/我|自己/u.test(text) ? { includeSelf: true } : {}),
    });
  }
  if (asksMusic) {
    const artist = findMentionedArtist(text, data.musicTracks);
    queries.push(artist ? { kind: 'music', artist } : person ? { kind: 'music', personId: person.id } : { kind: 'music' });
  }
  if (asksLedger) {
    if (ranges.month) queries.push({ kind: 'ledger', month: ranges.month });
    else if (ranges.from || ranges.to) queries.push({ kind: 'ledger', ...(ranges.from ? { from: ranges.from } : {}), ...(ranges.to ? { to: ranges.to } : {}) });
    else queries.push({ kind: 'ledger', month: currentMonth(now) });
  }
  if (asksBooks) queries.push({ kind: 'excerpts' });
  if (asksCounts) queries.push({ kind: 'counts' });
  // 「最近」太宽泛：只有当问题没有落到别的领域时，才把它当成“翻最近的记录”。
  const asksRecentRecords = text.includes('最近') && !asksBirthday && !asksMusic && !asksLedger && !asksBooks && !asksCounts;
  const asksExplicitPosts = POSTS_KEYWORDS.some((keyword) => keyword !== '最近' && text.includes(keyword));
  if (asksExplicitPosts || asksRecentRecords || (person && ranges.from)) {
    queries.push({ kind: 'posts', ...(person ? { personId: person.id } : {}), ...(ranges.from ? { from: ranges.from } : {}), ...(ranges.to ? { to: ranges.to } : {}), latest: text.includes('最近') || text.includes('第一次') });
  }
  if (PEOPLE_KEYWORDS.some((keyword) => text.includes(keyword))) {
    queries.push({ kind: 'people', ...(person ? { nameLike: person.name } : {}) });
  }
  return dedupeQueries(queries).slice(0, 3);
}

export function resolveStructuredQueries(queries: StructuredQuery[], data: KnowledgeDataInput, now = new Date()): CombinedStructuredResult {
  const facts: StructuredFact[] = [];
  const entityIds: CombinedStructuredResult['entityIds'] = { postIds: [], personIds: [], trackIds: [], bookIds: [] };
  for (const query of queries) {
    const result = resolveStructuredQuery(query, data, now);
    facts.push(...result.facts);
    entityIds.postIds.push(...result.entityIds.postIds);
    entityIds.personIds.push(...result.entityIds.personIds);
    entityIds.trackIds.push(...result.entityIds.trackIds);
    entityIds.bookIds.push(...result.entityIds.bookIds);
  }
  const numbered = facts.map((fact, index) => ({ ...fact, citationId: `S${index + 1}` }));
  return {
    facts: numbered,
    renderedText: numbered.map((fact) => `[${fact.citationId}]${fact.source?.kind === 'person' ? '（人物资料）' : '（我的信息）'} ${fact.label}：${fact.value}`).join('\n'),
    entityIds: {
      postIds: [...new Set(entityIds.postIds)],
      personIds: [...new Set(entityIds.personIds)],
      trackIds: [...new Set(entityIds.trackIds)],
      bookIds: [...new Set(entityIds.bookIds)],
    },
  };
}

function resolveStructuredQuery(query: StructuredQuery, data: KnowledgeDataInput, now: Date): StructuredResult {
  if (query.kind === 'birthdays') return resolveBirthdays(query.withinDays, data, now, query.focusPersonId, query.includeSelf === true);
  if (query.kind === 'music') return resolveMusic(query, data);
  if (query.kind === 'ledger') return resolveLedger(query, data);
  if (query.kind === 'posts') return resolvePosts(query, data);
  if (query.kind === 'excerpts') return resolveExcerpts(query, data);
  if (query.kind === 'counts') return resolveCounts(data);
  return resolvePeople(query, data);
}

function resolveBirthdays(withinDays: number, data: KnowledgeDataInput, now: Date, focusPersonId: string | undefined, includeSelf: boolean): StructuredResult {
  const today = startOfDay(now);
  const entries: Array<{ name: string; personId: string | null; date: Date; days: number; calendar: '农历' | '公历' }> = [];
  if (data.self.birthday) {
    try {
      const next = nextBirthday(data.self.birthday, now);
      entries.push({
        name: data.self.name || '我',
        personId: null,
        date: next,
        days: diffDays(today, next),
        calendar: data.self.birthday.calendar === 'lunar' ? '农历' : '公历',
      });
    } catch {
      // 无法换算的生日跳过，不影响其它结果。
    }
  }
  for (const person of data.people) {
    if (!person.birthday) continue;
    try {
      const next = nextBirthday(person.birthday, now);
      entries.push({
        name: person.nickname.trim() || person.name,
        personId: person.id,
        date: next,
        days: diffDays(today, next),
        calendar: person.birthday.calendar === 'lunar' ? '农历' : '公历',
      });
    } catch {
      // 无法换算的生日跳过，不影响其它结果。
    }
  }
  const selected = entries
    .filter((entry) => entry.days <= withinDays || Boolean(focusPersonId && entry.personId === focusPersonId) || (includeSelf && entry.personId === null))
    .sort((left, right) => {
      // 问的是某个人时，先把 ta 的生日放进来，避免被 60 天窗口和条数上限筛掉。
      const leftFocused = Boolean((focusPersonId && left.personId === focusPersonId) || (includeSelf && left.personId === null));
      const rightFocused = Boolean((focusPersonId && right.personId === focusPersonId) || (includeSelf && right.personId === null));
      if (leftFocused !== rightFocused) return leftFocused ? -1 : 1;
      return left.days - right.days;
    })
    .slice(0, 8);
  const facts = selected.map((entry) => {
    const when = entry.days === 0 ? '就是今天' : `还有 ${entry.days} 天`;
    const solar = formatLocalDayKey(entry.date);
    // 农历生日必须把农历月日和对应的公历日期都写清楚，避免把公历日期当成农历读。
    const value = entry.calendar === '农历'
      ? `农历${lunarDayLabel(entry.date) ?? '日期未知'}（对应公历 ${solar}，${when}）`
      : `公历 ${solar}（${when}）`;
    return {
      label: `${entry.name} · 下一次生日`,
      value,
      citationId: '',
      source: entry.personId ? { kind: 'person', id: entry.personId } as StructuredFact['source'] : null,
    };
  });
  return {
    kind: 'birthdays',
    facts,
    renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'),
    entityIds: { postIds: [], personIds: selected.map((entry) => entry.personId).filter((id): id is string => Boolean(id)), trackIds: [], bookIds: [] },
  };
}

function resolvePeople(query: Extract<StructuredQuery, { kind: 'people' }>, data: KnowledgeDataInput): StructuredResult {
  const matched = data.people.filter((person) => {
    if (query.nameLike && !`${person.name} ${person.nickname}`.includes(query.nameLike)) return false;
    if (query.relation && !(person.relationToMe ?? '').includes(query.relation)) return false;
    if (query.tag && !data.personTags.some((tag) => tag.personId === person.id && (tag.value.includes(query.tag ?? '') || tag.kind.includes(query.tag ?? '')))) return false;
    return true;
  });
  const facts = matched.slice(0, 8).map((person) => ({
    label: `人物 · ${person.nickname.trim() || person.name}`,
    value: [person.relationToMe?.trim(), person.bio?.trim(), person.impression?.trim()].filter(Boolean).join('；') || '资料未填写',
    citationId: '',
    source: { kind: 'person', id: person.id } as StructuredFact['source'],
  }));
  return { kind: 'people', facts, renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'), entityIds: { postIds: [], personIds: matched.map((person) => person.id), trackIds: [], bookIds: [] } };
}

function resolveMusic(query: Extract<StructuredQuery, { kind: 'music' }>, data: KnowledgeDataInput): StructuredResult {
  let tracks = data.musicTracks;
  if (query.personId) {
    const trackIds = new Set(data.musicCollectionEntries.filter((entry) => entry.targetType === 'person' && entry.targetId === query.personId).map((entry) => entry.trackId));
    tracks = tracks.filter((track) => trackIds.has(track.id));
  }
  if (query.artist) tracks = tracks.filter((track) => (track.artist ?? '').includes(query.artist ?? ''));
  if (query.title) tracks = tracks.filter((track) => track.title.includes(query.title ?? ''));
  const personName = query.personId ? data.people.find((person) => person.id === query.personId)?.name : null;
  const facts: StructuredFact[] = [];
  if (!query.artist && !query.title && !query.personId) {
    const artists = new Map<string, number>();
    for (const track of tracks) artists.set(track.artist?.trim() || '未知歌手', (artists.get(track.artist?.trim() || '未知歌手') ?? 0) + track.playCount);
    [...artists.entries()].filter(([, plays]) => plays > 0).sort((left, right) => right[1] - left[1]).slice(0, 5).forEach(([artist, plays]) => {
      facts.push({ label: `常听歌手 · ${artist}`, value: `本机累计播放 ${plays} 次`, citationId: '', source: null });
    });
    tracks.filter((track) => track.playCount > 0).sort((left, right) => right.playCount - left.playCount).slice(0, 5).forEach((track) => {
      facts.push({ label: `常听歌曲 · ${track.title}`, value: `${track.artist?.trim() || '未知歌手'} · 播放 ${track.playCount} 次`, citationId: '', source: { kind: 'music', id: track.id } });
    });
  } else {
    tracks.slice(0, 8).forEach((track) => {
      facts.push({ label: `${personName ? `${personName} 收藏 · ` : ''}${track.title}`, value: `${track.artist?.trim() || '未知歌手'}${track.playCount ? ` · 播放 ${track.playCount} 次` : ''}`, citationId: '', source: { kind: 'music', id: track.id } });
    });
  }
  return { kind: 'music', facts, renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'), entityIds: { postIds: [], personIds: [], trackIds: tracks.map((track) => track.id), bookIds: [] } };
}

function resolveLedger(query: Extract<StructuredQuery, { kind: 'ledger' }>, data: KnowledgeDataInput): StructuredResult {
  const transactions = data.ledgerTransactions.filter((item) => {
    if (query.month && !item.dayKey.startsWith(query.month)) return false;
    if (query.from && item.dayKey < query.from) return false;
    if (query.to && item.dayKey > query.to) return false;
    if (query.type && item.type !== query.type) return false;
    if (query.category && !item.category.includes(query.category)) return false;
    return true;
  });
  const expense = transactions.filter((item) => item.type === 'expense').reduce((sum, item) => sum + item.amountCents, 0);
  const income = transactions.filter((item) => item.type === 'income').reduce((sum, item) => sum + item.amountCents, 0);
  const categories = new Map<string, number>();
  for (const item of transactions.filter((entry) => entry.type === 'expense')) categories.set(item.category, (categories.get(item.category) ?? 0) + item.amountCents);
  const period = query.month ?? (query.from || query.to ? `${query.from ?? '—'} 至 ${query.to ?? '—'}` : '');
  const facts: StructuredFact[] = [
    { label: `账本${period ? ` · ${period}` : ''} · 支出`, value: formatMoney(expense), citationId: '', source: null },
    { label: `账本${period ? ` · ${period}` : ''} · 收入`, value: formatMoney(income), citationId: '', source: null },
    { label: '结余', value: formatMoney(income - expense), citationId: '', source: null },
  ];
  [...categories.entries()].sort((left, right) => right[1] - left[1]).slice(0, 5).forEach(([category, cents]) => {
    facts.push({ label: `支出分类 · ${category}`, value: formatMoney(cents), citationId: '', source: null });
  });
  return { kind: 'ledger', facts, renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'), entityIds: { postIds: [], personIds: [], trackIds: [], bookIds: [] } };
}

function resolvePosts(query: Extract<StructuredQuery, { kind: 'posts' }>, data: KnowledgeDataInput): StructuredResult {
  let posts = data.posts;
  if (query.personId) {
    const postIds = new Set(data.postPersons.filter((relation) => relation.personId === query.personId).map((relation) => relation.postId));
    posts = posts.filter((post) => postIds.has(post.id));
  }
  if (query.from) posts = posts.filter((post) => post.dayKey >= (query.from ?? ''));
  if (query.to) posts = posts.filter((post) => post.dayKey <= (query.to ?? ''));
  if (query.keyword) posts = posts.filter((post) => post.bodyMarkdown.includes(query.keyword ?? ''));
  const sorted = [...posts].sort((left, right) => right.dayKey.localeCompare(left.dayKey));
  const selected = query.latest ? sorted.slice(0, 3) : sorted.slice(0, 5);
  const facts = selected.map((post) => ({
    label: `${post.dayKey} 记录`,
    value: `${postTitle(post)}${post.locationName?.trim() ? `（${post.locationName.trim()}）` : ''}`,
    citationId: '',
    source: { kind: 'post', id: post.id } as StructuredFact['source'],
  }));
  return { kind: 'posts', facts, renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'), entityIds: { postIds: selected.map((post) => post.id), personIds: [], trackIds: [], bookIds: [] } };
}

function resolveExcerpts(query: Extract<StructuredQuery, { kind: 'excerpts' }>, data: KnowledgeDataInput): StructuredResult {
  let excerpts = data.bookExcerpts;
  if (query.keyword) excerpts = excerpts.filter((excerpt) => excerpt.text.includes(query.keyword ?? '') || (excerpt.note ?? '').includes(query.keyword ?? ''));
  if (query.bookTitle) excerpts = excerpts.filter((excerpt) => (excerpt.bookTitle ?? data.books.find((book) => book.id === excerpt.bookId)?.title ?? '').includes(query.bookTitle ?? ''));
  const selected = excerpts.slice(0, 8);
  const facts = selected.map((excerpt) => ({
    label: `摘抄 · ${excerpt.bookTitle ?? data.books.find((book) => book.id === excerpt.bookId)?.title ?? '未知书籍'}`,
    value: excerpt.text.slice(0, 80),
    citationId: '',
    source: { kind: 'excerpt', id: excerpt.id } as StructuredFact['source'],
  }));
  return { kind: 'excerpts', facts, renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'), entityIds: { postIds: [], personIds: [], trackIds: [], bookIds: selected.map((excerpt) => excerpt.bookId).filter((id): id is string => Boolean(id)) } };
}

function resolveCounts(data: KnowledgeDataInput): StructuredResult {
  const recordedDays = new Set([...data.posts.map((post) => post.dayKey), ...data.checkIns.map((checkIn) => checkIn.dayKey)]).size;
  const facts: StructuredFact[] = [
    { label: '记录', value: `${data.posts.length} 条`, citationId: '', source: null },
    { label: '记录天数', value: `${recordedDays} 天`, citationId: '', source: null },
    { label: '打卡', value: `${data.checkIns.length} 天`, citationId: '', source: null },
    { label: '人物', value: `${data.people.length} 人`, citationId: '', source: null },
    { label: '摘抄', value: `${data.bookExcerpts.length} 条`, citationId: '', source: null },
    { label: '音乐', value: `${data.musicTracks.length} 首`, citationId: '', source: null },
  ];
  return { kind: 'counts', facts, renderedText: facts.map((fact) => `${fact.label}：${fact.value}`).join('\n'), entityIds: { postIds: [], personIds: [], trackIds: [], bookIds: [] } };
}

function findMentionedPerson(text: string, people: Person[]): Person | null {
  return people.find((person) => (person.name.length >= 2 && text.includes(person.name)) || (person.nickname.trim().length >= 2 && text.includes(person.nickname.trim()))) ?? null;
}

function findMentionedArtist(text: string, tracks: MusicTrack[]): string | null {
  const artists = [...new Set(tracks.map((track) => track.artist?.trim()).filter((artist): artist is string => Boolean(artist && artist.length >= 2)))];
  return artists.find((artist) => text.includes(artist)) ?? null;
}

function parseDateExpression(text: string, now: Date): { from?: DayKey; to?: DayKey; month?: string } {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const lastMonth = month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, '0')}`;
  if (text.includes('上个月')) return { month: lastMonth, from: `${lastMonth}-01` as DayKey, to: `${lastMonth}-31` as DayKey };
  if (text.includes('今年')) return { from: `${year}-01-01` as DayKey, to: `${year}-12-31` as DayKey };
  if (text.includes('去年')) return { from: `${year - 1}-01-01` as DayKey, to: `${year - 1}-12-31` as DayKey };
  const daysMatch = /最近\s*(\d+)\s*天/u.exec(text);
  if (daysMatch?.[1]) {
    const days = Number(daysMatch[1]);
    const from = new Date(now.getTime() - days * 86_400_000);
    return { from: toDayKey(from), to: toDayKey(now) };
  }
  const monthMatch = /(\d{4})\s*年\s*(\d{1,2})\s*月/u.exec(text);
  if (monthMatch?.[1] && monthMatch[2]) {
    const value = `${monthMatch[1]}-${String(Number(monthMatch[2])).padStart(2, '0')}`;
    return { month: value, from: `${value}-01` as DayKey, to: `${value}-31` as DayKey };
  }
  const bareMonth = Number(/(?:^|[^\d])(\d{1,2})\s*月/u.exec(text)?.[1] ?? chineseMonthNumber(text));
  if (Number.isInteger(bareMonth) && bareMonth >= 1 && bareMonth <= 12) {
    const value = `${year}-${String(bareMonth).padStart(2, '0')}`;
    return { month: value, from: `${value}-01` as DayKey, to: `${value}-31` as DayKey };
  }
  return {};
}

function chineseMonthNumber(text: string): number | null {
  const match = /(十[一二]?|[一二三四五六七八九])\s*月/u.exec(text);
  if (!match?.[1]) return null;
  const numbers: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10, 十一: 11, 十二: 12 };
  return numbers[match[1]] ?? null;
}

function dedupeQueries(queries: StructuredQuery[]): StructuredQuery[] {
  const seen = new Set<string>();
  return queries.filter((query) => {
    const key = `${query.kind}:${'month' in query ? query.month ?? '' : ''}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function diffDays(from: Date, to: Date): number {
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / 86_400_000);
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function toDayKey(date: Date): DayKey {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` as DayKey;
}

function currentMonth(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function formatMoney(cents: number): string {
  return `¥${(cents / 100).toFixed(2)}`;
}

function postTitle(post: Post): string {
  const line = stripMarkdown(post.bodyMarkdown).split('\n').map((item) => item.trim()).find(Boolean) ?? '';
  return line.slice(0, 40) || '无标题记录';
}

