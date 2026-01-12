import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import dayjs from 'dayjs';

interface DailyQuoteProps {
  quote?: string;
  author?: string;
}

const DEFAULT_QUOTES = [
  { quote: '人生中最重要的不是所站的位置，而是所朝的方向。', author: '奥利弗·温德尔·霍姆斯' },
  { quote: '活着就是胜利，挣钱只是游戏。', author: '佚名' },
  { quote: '每一天都是一个新的开始。', author: '佚名' },
  { quote: '简单生活，高尚思考。', author: '亚里士多德' },
];

export default function DailyQuote({ quote, author }: DailyQuoteProps) {
  // Use date as seed for consistent daily quote
  const today = dayjs().format('YYYY-MM-DD');
  const index = today.split('').reduce((a, b) => a + b.charCodeAt(0), 0) % DEFAULT_QUOTES.length;
  const defaultQuote = DEFAULT_QUOTES[index];

  const displayQuote = quote || defaultQuote.quote;
  const displayAuthor = author || defaultQuote.author;
  const dateStr = dayjs().format('YYYY年M月D日');

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="bulb" size={20} color={colors.amber500} />
        <Text style={styles.headerText}>每日信息差</Text>
      </View>

      <View style={styles.quoteCard}>
        <Text style={styles.date}>{dateStr}</Text>
        <Text style={styles.quote}>"{displayQuote}"</Text>
        <View style={styles.authorRow}>
          <Ionicons name="chatbubble-outline" size={12} color="rgba(255,255,255,0.7)" />
          <Text style={styles.author}>{displayAuthor}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  quoteCard: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 20,
  },
  date: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  quote: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.white,
    lineHeight: 24,
    marginBottom: 12,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  author: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginLeft: 4,
  },
});
