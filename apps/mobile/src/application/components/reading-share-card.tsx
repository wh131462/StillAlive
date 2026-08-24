import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book, Media, ReadingNoteSource } from '@still-alive/types';
import { colors, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../state/app-state';
import { readingSourceQuote, readingSourceTitle } from '../reading-share';
import { createThemedStyles } from '../../shared/theme/app-theme';

type ReadingShareVariant = 'composer' | 'detail' | 'feed';

export function ReadingShareCard({ compact = false, source, variant = 'feed' }: { compact?: boolean; source: ReadingNoteSource; variant?: ReadingShareVariant }) {
  const router = useRouter();
  const { books, media } = useAppState();
  const book = source.bookId ? books.find((item) => item.id === source.bookId) ?? null : null;
  const quote = readingSourceQuote(source);
  const readable = Boolean(book?.parseStatus === 'ready' && media.some((item) => item.id === book.fileMediaId));
  const interactive = variant !== 'composer' && readable && book;
  const title = readingSourceTitle(source, book);
  const label = quote
    ? variant === 'composer' ? '即将引用自' : book ? '书摘来自' : '来源书籍已移除'
    : variant === 'composer' ? '即将引用一本书' : book ? '引用了一本书' : '引用的书籍已不在书架';
  const quoteContent = quote ? <><View style={styles.quoteHeader}><SymbolView name={{ android: 'format_quote', ios: 'text.quote', web: 'format_quote' }} size={16} tintColor={colors.life} type="hierarchical" /><Text style={styles.quoteLabel}>书摘</Text></View><Text style={styles.quote}>{quote.text.trim()}</Text></> : null;
  const showQuote = Boolean(quoteContent && !compact);

  return (
    <Pressable
      accessibilityLabel={`${label}：${title}${quote ? `，${quote.text}` : ''}`}
      accessibilityRole={interactive ? 'button' : undefined}
      disabled={!interactive}
      onPress={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        router.push({ pathname: '/reader', params: { id: interactive.id } } as never);
      }}
      style={({ pressed }) => [styles.card, variant === 'composer' && styles.cardComposer, pressed && styles.cardPressed]}
    >
      {showQuote && variant === 'composer' ? <ScrollView contentContainerStyle={styles.quoteBlock} nestedScrollEnabled showsVerticalScrollIndicator style={styles.composerQuoteScroll}>{quoteContent}</ScrollView> : null}
      {showQuote && variant !== 'composer' ? <View style={styles.quoteBlock}>{quoteContent}</View> : null}
      <View style={[styles.sourceRow, !showQuote && styles.sourceRowOnly]}>
        <BookCover book={book} media={media} title={title} variant={variant} />
        <View style={styles.sourceCopy}>
          <Text style={styles.sourceLabel}>{label}</Text>
          <Text numberOfLines={1} style={styles.title}>{title}</Text>
          <Text numberOfLines={1} style={styles.meta}>{bookMeta(book)}</Text>
        </View>
        <View style={styles.action}>
          <SymbolView name={{ android: readable ? 'chevron_right' : 'book_2', ios: readable ? 'chevron.right' : 'book.closed', web: readable ? 'chevron_right' : 'book_2' }} size={18} tintColor={readable ? colors.life : colors.inkFaint} type="hierarchical" />
        </View>
      </View>
    </Pressable>
  );
}

function BookCover({ book, media, title, variant }: { book: Book | null; media: Media[]; title: string; variant: ReadingShareVariant }) {
  const cover = book?.coverMediaId ? media.find((item) => item.id === book.coverMediaId) : null;
  const size = variant === 'feed' ? styles.coverFeed : styles.coverLarge;
  return (
    <View style={[styles.cover, size]}>
      {cover
        ? <Image accessibilityLabel={`${title}封面`} resizeMode="cover" source={{ uri: cover.localPath }} style={styles.coverImage} />
        : <><Text style={styles.coverFormat}>{book?.format.toUpperCase() || 'BOOK'}</Text><Text numberOfLines={1} style={styles.coverInitial}>{title.trim().slice(0, 1) || '书'}</Text></>}
    </View>
  );
}

function bookMeta(book: Book | null): string {
  if (!book) return '来源快照仍会保留';
  const parts = [book.author || '未知作者', book.format.toUpperCase()];
  if (book.progress > 0) parts.push(book.progress >= 1 ? '已读完' : `已读 ${Math.round(book.progress * 100)}%`);
  return parts.join('，');
}

const styles = createThemedStyles(() => ({
  card: { minHeight: 88, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, backgroundColor: colors.lifeLight },
  cardComposer: { backgroundColor: colors.paper },
  cardPressed: { opacity: 0.7 },
  cover: { flexShrink: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
  coverFeed: { width: 40, height: 54 },
  coverLarge: { width: 44, height: 60 },
  coverImage: { width: '100%', height: '100%' },
  coverFormat: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 7, letterSpacing: 0.5 },
  coverInitial: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  quoteBlock: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.lg },
  composerQuoteScroll: { maxHeight: 152 },
  quoteHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  quoteLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  quote: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 14, lineHeight: 23 },
  sourceRow: { minHeight: 76, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lifeLine, backgroundColor: colors.paper },
  sourceRowOnly: { borderTopWidth: 0 },
  sourceCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  sourceLabel: { color: colors.life, fontFamily: typography.mono, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  title: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 14 },
  meta: { marginTop: 3, color: colors.inkFaint, fontSize: 9 },
  action: { width: 32, height: 32, marginLeft: spacing.xs, flexShrink: 0, alignItems: 'center', justifyContent: 'center' },
}));
