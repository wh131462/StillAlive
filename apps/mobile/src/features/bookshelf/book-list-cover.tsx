import { Image, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { Book, Media } from '@still-alive/types';
import { colors, typography } from '@still-alive/tokens';

export function BookListCover({ books, media, size }: { books: Book[]; media: Media[]; size: number }) {
  const visibleBooks = books.slice(0, 3);
  const bookWidth = Math.round(size * (visibleBooks.length === 1 ? 0.48 : 0.4));
  const bookHeight = Math.round(size * (visibleBooks.length === 1 ? 0.66 : 0.58));

  return <View style={[styles.frame, { width: size, height: size, borderRadius: Math.min(8, size * 0.08) }]}>
    {visibleBooks.length ? visibleBooks.map((book, index) => {
      const cover = book.coverMediaId ? media.find((item) => item.id === book.coverMediaId) : null;
      const position = bookPosition(index, visibleBooks.length, size, bookWidth);
      return <View key={book.id} style={[styles.book, position, { width: bookWidth, height: bookHeight, backgroundColor: coverColor(book) }]}>
        {cover ? <Image accessibilityLabel={`${book.title} 封面`} resizeMode="cover" source={{ uri: cover.localPath }} style={styles.image} /> : <Text numberOfLines={1} style={styles.initial}>{book.title.trim().slice(0, 1) || '书'}</Text>}
      </View>;
    }) : <SymbolView name={{ android: 'library_books', ios: 'books.vertical', web: 'library_books' }} size={Math.round(size * 0.34)} tintColor={colors.life} type="hierarchical" />}
  </View>;
}

function bookPosition(index: number, count: number, size: number, bookWidth: number) {
  if (count === 1) return { left: Math.round((size - bookWidth) / 2), top: Math.round(size * 0.17), zIndex: 1 };
  if (index === 0) return { left: Math.round(size * 0.12), top: Math.round(size * 0.23), transform: [{ rotate: '-7deg' }], zIndex: 1 };
  if (index === 1) return { right: Math.round(size * 0.12), top: Math.round(size * 0.19), transform: [{ rotate: '7deg' }], zIndex: 2 };
  return { left: Math.round((size - bookWidth) / 2), top: Math.round(size * 0.1), zIndex: 3 };
}

function coverColor(book: Book): string {
  if (book.parseStatus === 'failed' || book.parseStatus === 'protected') return colors.dangerLight;
  return book.format === 'epub' ? colors.lifeLight : colors.sunLight;
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet },
  book: { position: 'absolute', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, backgroundColor: colors.paper },
  image: { width: '100%', height: '100%' },
  initial: { color: colors.ink, fontFamily: typography.display, fontSize: 15 },
});
