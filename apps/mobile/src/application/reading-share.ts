import type { Book, ReadingNoteSource } from '@still-alive/types';

export function readingSourceTitle(source: ReadingNoteSource, book?: Book | null): string {
  return book?.title || source.quoteSnapshots[0]?.bookTitle || '原书已从书架移除';
}

export function readingSourceQuote(source: ReadingNoteSource): ReadingNoteSource['quoteSnapshots'][number] | null {
  return source.quoteSnapshots.find((quote) => quote.text.trim()) ?? null;
}

export function withReadingSourceQuote(markdown: string, source: ReadingNoteSource | null, book?: Book | null): string {
  const body = withoutReadingSourceQuote(markdown, source, book);
  if (!source) return body;
  const quote = readingSourceQuote(source);
  const title = readingSourceTitle(source, book);
  const prefix = quote
    ? `> 《${title}》\n> ${quote.text.replaceAll('\n', '\n> ')}${quote.location ? `\n> —— ${quote.location}` : ''}`
    : `> 《${title}》`;
  return body ? `${prefix}\n\n${body}` : prefix;
}

export function withoutReadingSourceQuote(markdown: string, source: ReadingNoteSource | null, book?: Book | null): string {
  const body = markdown.trim();
  if (!source || !body.startsWith('> 《')) return body;
  const quote = readingSourceQuote(source);
  if (!quote) return body.replace(/^> 《[^\n]+》\n*(?=\S|$)/, '').trim();

  const titles = [...new Set([quote.bookTitle, book?.title].filter((value): value is string => Boolean(value)))];
  for (const title of titles) {
    const prefix = `> 《${title}》\n> ${quote.text.replaceAll('\n', '\n> ')}${quote.location ? `\n> —— ${quote.location}` : ''}`;
    if (body === prefix) return '';
    if (body.startsWith(`${prefix}\n\n`)) return body.slice(prefix.length).trim();
  }
  return body;
}
