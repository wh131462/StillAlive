import type { Post, Person, PersonEvent, BookExcerpt } from '@still-alive/types';
import { birthdaySolarDate } from '../../people/person-profile';
import type { KnowledgeChunk, KnowledgeDataInput, KnowledgeSourceKind } from './knowledge-types';
import { estimateTokens, hashText, stripMarkdown } from './knowledge-types';
import { formatLocalDayKey, lunarDayLabel } from './time-context';

export interface KnowledgeSourceBundle {
  sourceKind: KnowledgeSourceKind;
  sourceId: string;
  contentHash: string;
  sourceUpdatedAt: string | null;
  chunks: KnowledgeChunk[];
}

const MAX_CHUNK_CHARS = 600;
const CHUNK_OVERLAP_CHARS = 60;

export function buildKnowledgeSources(input: KnowledgeDataInput, now = new Date().toISOString()): KnowledgeSourceBundle[] {
  const peopleById = new Map(input.people.map((person) => [person.id, person]));
  const tagsByPerson = groupPersonTags(input.personTags);
  const personIdsByPost = new Map<string, string[]>();
  for (const relation of input.postPersons) {
    const current = personIdsByPost.get(relation.postId) ?? [];
    current.push(relation.personId);
    personIdsByPost.set(relation.postId, current);
  }
  const bookById = new Map(input.books.map((book) => [book.id, book]));
  const bundles: KnowledgeSourceBundle[] = [];

  for (const post of input.posts) {
    const personIds = personIdsByPost.get(post.id) ?? [];
    const personNames = personIds.map((id) => peopleById.get(id)?.name).filter((name): name is string => Boolean(name));
    const datedPrefix = buildPostPrefix(post, personNames);
    const bundlesForPost = buildTextChunks({
      sourceKind: 'post',
      sourceId: post.id,
      title: titleOfPost(post),
      body: stripMarkdown(post.bodyMarkdown),
      contextPrefix: datedPrefix,
      dayKey: post.dayKey,
      personIds,
      tagKeys: uniqueTags(personIds, tagsByPerson),
      isPrivate: personIds.some((id) => peopleById.get(id)?.privacyMode === 'private'),
      sourceUpdatedAt: post.updatedAt,
      now,
    });
    if (bundlesForPost) bundles.push(bundlesForPost);

    const commentText = post.comments.map((comment) => stripMarkdown(comment.body)).filter(Boolean).join('\n');
    if (commentText) {
      const commentsBundle = buildTextChunks({
        sourceKind: 'comments',
        sourceId: post.id,
        title: `评论 · ${titleOfPost(post)}`,
        body: commentText,
        contextPrefix: `[${formatDay(post.dayKey)} · 记录评论]`,
        dayKey: post.dayKey,
        personIds,
        tagKeys: [],
        isPrivate: personIds.some((id) => peopleById.get(id)?.privacyMode === 'private'),
        sourceUpdatedAt: latestIso([post.updatedAt, ...post.comments.map((comment) => comment.updatedAt)]),
        now,
      });
      if (commentsBundle) bundles.push(commentsBundle);
    }
  }

  for (const person of input.people) {
    const tags = tagsByPerson.get(person.id) ?? [];
    const body = buildPersonBody(person, tags);
    const bundle = buildTextChunks({
      sourceKind: 'person',
      sourceId: person.id,
      title: `人物 · ${person.name}`,
      body,
      contextPrefix: `[人物 · ${person.relationToMe?.trim() || '关系未填'}]`,
      dayKey: null,
      personIds: [person.id],
      tagKeys: tags,
      isPrivate: person.privacyMode === 'private',
      sourceUpdatedAt: person.updatedAt,
      now,
    });
    if (bundle) bundles.push(bundle);
  }

  for (const event of input.personEvents) {
    const person = peopleById.get(event.personId);
    if (!person) continue;
    const body = [event.title, event.description?.trim(), event.timeText?.trim()].filter(Boolean).join('\n');
    const bundle = buildTextChunks({
      sourceKind: 'person_event',
      sourceId: event.id,
      title: `事件 · ${event.title}`,
      body: stripMarkdown(body),
      contextPrefix: `[${event.timeText?.trim() || '时间未填'} · ${person.name}]`,
      dayKey: event.createdAt.slice(0, 10) as KnowledgeChunk['dayKey'],
      personIds: [event.personId, ...event.participantIds],
      tagKeys: tagsByPerson.get(event.personId) ?? [],
      isPrivate: person.privacyMode === 'private',
      sourceUpdatedAt: event.updatedAt,
      now,
    });
    if (bundle) bundles.push(bundle);
  }

  for (const excerpt of input.bookExcerpts) {
    const book = excerpt.bookId ? bookById.get(excerpt.bookId) : undefined;
    const bookTitle = excerpt.bookTitle?.trim() || book?.title || '未知书籍';
    const body = [excerpt.text, excerpt.note?.trim()].filter(Boolean).join('\n');
    const bundle = buildTextChunks({
      sourceKind: 'excerpt',
      sourceId: excerpt.id,
      title: `摘抄 · ${bookTitle}`,
      body: stripMarkdown(body),
      contextPrefix: `[${bookTitle}${excerpt.chapterTitle?.trim() ? ` · ${excerpt.chapterTitle.trim()}` : ''}]`,
      dayKey: excerpt.createdAt.slice(0, 10) as KnowledgeChunk['dayKey'],
      personIds: [],
      tagKeys: [],
      isPrivate: false,
      sourceUpdatedAt: excerpt.createdAt,
      now,
    });
    if (bundle) bundles.push(bundle);
  }

  return bundles;
}

export function buildAggregateChunks(aggregates: Array<{ id: string; kind: string; scopeKey: string; title: string; bodyMarkdown: string; updatedAt: string }>, now = new Date().toISOString()): KnowledgeSourceBundle[] {
  return aggregates.flatMap((aggregate) => {
    const body = stripMarkdown(aggregate.bodyMarkdown);
    if (!body) return [];
    const contentHash = hashText(body);
    const chunks: KnowledgeChunk[] = splitText(body).map((part, index) => ({
      id: `knowledge_chunk_aggregate_${aggregate.id}_${index}`,
      sourceKind: 'aggregate',
      sourceId: aggregate.id,
      chunkIndex: index,
      dayKey: null,
      personIds: [],
      tagKeys: [aggregate.kind],
      title: aggregate.title,
      contextPrefix: `[汇总 · ${aggregate.kind}]`,
      bodyText: part,
      charStart: 0,
      charEnd: part.length,
      isPrivate: false,
      tokenEstimate: estimateTokens(part),
      contentHash,
      sourceUpdatedAt: aggregate.updatedAt,
      indexedAt: now,
    }));
    return [{ sourceKind: 'aggregate' as const, sourceId: aggregate.id, contentHash, sourceUpdatedAt: aggregate.updatedAt, chunks }];
  });
}

function buildTextChunks(input: {
  sourceKind: KnowledgeSourceKind;
  sourceId: string;
  title: string;
  body: string;
  contextPrefix: string;
  dayKey: KnowledgeChunk['dayKey'];
  personIds: string[];
  tagKeys: string[];
  isPrivate: boolean;
  sourceUpdatedAt: string | null;
  now: string;
}): KnowledgeSourceBundle | null {
  const body = input.body.trim();
  if (!body) return null;
  const parts = splitText(body);
  const contentHash = hashText(`${body}\n${input.personIds.join(',')}\n${input.tagKeys.join(',')}`);
  const chunks = parts.map((part, index) => ({
    id: `knowledge_chunk_${input.sourceKind}_${input.sourceId}_${index}`,
    sourceKind: input.sourceKind,
    sourceId: input.sourceId,
    chunkIndex: index,
    dayKey: input.dayKey,
    personIds: input.personIds,
    tagKeys: input.tagKeys,
    title: input.title,
    contextPrefix: input.contextPrefix,
    bodyText: part,
    charStart: index === 0 ? 0 : Math.max(0, body.indexOf(part)),
    charEnd: index === 0 ? part.length : Math.max(part.length, body.indexOf(part) + part.length),
    isPrivate: input.isPrivate,
    tokenEstimate: estimateTokens(`${input.contextPrefix}\n${part}`),
    contentHash,
    sourceUpdatedAt: input.sourceUpdatedAt,
    indexedAt: input.now,
  }));
  return { sourceKind: input.sourceKind, sourceId: input.sourceId, contentHash, sourceUpdatedAt: input.sourceUpdatedAt, chunks };
}

function splitText(text: string): string[] {
  const normalized = text.trim();
  if (normalized.length <= MAX_CHUNK_CHARS) return [normalized];
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < normalized.length) {
    let end = Math.min(normalized.length, cursor + MAX_CHUNK_CHARS);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf('\n', end), normalized.lastIndexOf('。', end), normalized.lastIndexOf('！', end), normalized.lastIndexOf('？', end), normalized.lastIndexOf('.', end));
      if (boundary > cursor + MAX_CHUNK_CHARS * 0.5) end = boundary + 1;
    }
    parts.push(normalized.slice(cursor, end).trim());
    if (end >= normalized.length) break;
    cursor = Math.max(cursor + 1, end - CHUNK_OVERLAP_CHARS);
  }
  return parts.filter(Boolean);
}

function buildPostPrefix(post: Post, personNames: string[]): string {
  const parts = [formatDay(post.dayKey)];
  if (personNames.length) parts.push(uniqueStrings(personNames).join('、'));
  if (post.locationName?.trim()) parts.push(post.locationName.trim());
  return `[${parts.join(' · ')}]`;
}

function titleOfPost(post: Post): string {
  const firstLine = stripMarkdown(post.bodyMarkdown).split('\n').map((line) => line.trim()).find(Boolean) ?? '';
  return firstLine.slice(0, 24) || formatDay(post.dayKey);
}

function buildPersonBody(person: Person, tags: string[]): string {
  const lines: string[] = [`姓名：${person.name}`];
  if (person.nickname.trim()) lines.push(`昵称：${person.nickname.trim()}`);
  if (person.relationToMe?.trim()) lines.push(`与我的关系：${person.relationToMe.trim()}`);
  if (person.bio?.trim()) lines.push(`简介：${person.bio.trim()}`);
  if (person.impression?.trim()) lines.push(`关于 ta 的印象：${person.impression.trim()}`);
  if (tags.length) lines.push(`标签：${tags.join('、')}`);
  if (person.birthday) lines.push(`生日：${formatBirthday(person.birthday)}`);
  if (person.importantDates.length) lines.push(`重要日期：${person.importantDates.map((item) => `${item.name} ${item.date}`).join('；')}`);
  return lines.join('\n');
}

function formatBirthday(birthday: NonNullable<Person['birthday']>): string {
  if (birthday.calendar === 'solar') {
    return `公历 ${birthday.year}-${String(birthday.month).padStart(2, '0')}-${String(birthday.day).padStart(2, '0')}`;
  }
  try {
    const solar = birthdaySolarDate(birthday);
    return `农历${lunarDayLabel(solar) ?? `${birthday.month}月${birthday.day}日`}（公历 ${formatLocalDayKey(solar)}）`;
  } catch {
    return `农历 ${birthday.year}年${birthday.isLeapMonth ? '闰' : ''}${birthday.month}月${birthday.day}日`;
  }
}

function formatDay(dayKey: string): string {
  return dayKey.replaceAll('-', '.');
}

function groupPersonTags(tags: Array<{ personId: string; kind: string; value: string }>): Map<string, string[]> {
  const result = new Map<string, string[]>();
  for (const tag of tags) {
    const list = result.get(tag.personId) ?? [];
    list.push(tag.kind === 'custom' ? tag.value : `${tag.kind}:${tag.value}`);
    result.set(tag.personId, list);
  }
  return result;
}

function uniqueTags(personIds: string[], tagsByPerson: Map<string, string[]>): string[] {
  return uniqueStrings(personIds.flatMap((personId) => tagsByPerson.get(personId) ?? []));
}

function uniqueStrings(items: string[]): string[] {
  return [...new Set(items)];
}

function latestIso(values: string[]): string {
  return values.reduce((latest, value) => (value > latest ? value : latest), '');
}

export type { Post, Person, PersonEvent, BookExcerpt };
