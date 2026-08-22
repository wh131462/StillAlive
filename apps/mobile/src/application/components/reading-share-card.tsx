import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { Book, Media, ReadingNoteSource } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../state/app-state';
import { readingSourceQuote, readingSourceTitle } from '../reading-share';
import { createThemedStyles } from '../../shared/theme/app-theme';

type ReadingShareVariant = 'composer' | 'detail' | 'feed';

export function ReadingShareCard({ source, variant = 'feed' }: { source: ReadingNoteSource; variant?: ReadingShareVariant }) {
  const router = useRouter();
  const { books, media } = useAppState();
  const book = source.bookId ? books.find((item) => item.id === source.bookId) ?? null : null;
  const quote = readingSourceQuote(source);
  const readable = Boolean(book?.parseStatus === 'ready' && media.some((item) => item.id === book.fileMediaId));
  const interactive = variant !== 'composer' && readable && book;
  const title = readingSourceTitle(source, book);
  const label = variant === 'composer'
    ? quote ? '即将引用一段书摘' : '即将引用一本书'
    : book ? quote ? '引用了一段书摘' : '引用了一本书'
    : '引用的书籍已不在书架';

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
      <BookCover book={book} media={media} title={title} variant={variant} />
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{bookMeta(book)}</Text>
        {quote ? <Text numberOfLines={variant === 'feed' ? 2 : 3} style={styles.quote}>“{quote.text.trim()}”</Text> : null}
      </View>
      <View style={[styles.action, !readable && styles.actionUnavailable]}>
        <SymbolView name={{ android: readable ? 'menu_book' : 'book_2', ios: readable ? 'book.pages.fill' : 'book.closed', web: readable ? 'menu_book' : 'book_2' }} size={17} tintColor={readable ? colors.onLife : colors.inkFaint} type="hierarchical" />
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
  card: { minHeight: 88, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.lifeLight },
  cardComposer: { minHeight: 96, backgroundColor: colors.paper },
  cardPressed: { opacity: 0.7 },
  cover: { flexShrink: 0, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.sm, borderBottomLeftRadius: radius.sm, backgroundColor: colors.sheet },
  coverFeed: { width: 48, height: 66 },
  coverLarge: { width: 54, height: 74 },
  coverImage: { width: '100%', height: '100%' },
  coverFormat: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 7, letterSpacing: 0.5 },
  coverInitial: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  copy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  label: { color: colors.life, fontFamily: typography.mono, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  title: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  meta: { marginTop: 3, color: colors.inkFaint, fontSize: 9 },
  quote: { marginTop: 5, color: colors.inkSoft, fontFamily: typography.display, fontSize: 11, lineHeight: 16 },
  action: { width: 34, height: 34, marginLeft: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.life },
  actionUnavailable: { backgroundColor: colors.lineSoft },
}));
