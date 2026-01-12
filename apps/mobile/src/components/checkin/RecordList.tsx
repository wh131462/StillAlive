import React from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Checkin } from '@still-alive/types';
import { colors } from '../../theme/colors';
import RecordItem from './RecordItem';

interface RecordListProps {
  records: Checkin[];
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

export default function RecordList({
  records,
  isLoading,
  hasMore,
  onLoadMore,
}: RecordListProps) {
  const renderFooter = () => {
    if (isLoading) {
      return (
        <View style={styles.footer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      );
    }

    if (hasMore) {
      return (
        <TouchableOpacity style={styles.loadMore} onPress={onLoadMore}>
          <Ionicons name="chevron-down" size={16} color={colors.textSecondary} />
          <Text style={styles.loadMoreText}>加载更多</Text>
        </TouchableOpacity>
      );
    }

    if (records.length > 0) {
      return (
        <View style={styles.footer}>
          <Text style={styles.endText}>没有更多了</Text>
        </View>
      );
    }

    return null;
  };

  if (records.length === 0 && !isLoading) {
    return (
      <View style={styles.empty}>
        <Ionicons name="document-text-outline" size={48} color={colors.textMuted} />
        <Text style={styles.emptyText}>暂无打卡记录</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="time-outline" size={20} color={colors.textSecondary} />
        <Text style={styles.headerText}>近期记录</Text>
      </View>
      <FlatList
        data={records}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <RecordItem record={item} />}
        ListFooterComponent={renderFooter}
        scrollEnabled={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  footer: {
    padding: 16,
    alignItems: 'center',
  },
  loadMore: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadMoreText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  endText: {
    fontSize: 14,
    color: colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
  },
});
