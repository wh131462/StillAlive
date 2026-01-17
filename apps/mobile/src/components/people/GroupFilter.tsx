import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

export interface Group {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  count?: number;
}

interface GroupFilterProps {
  groups: Group[];
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  totalCount?: number;
}

// 默认图标和颜色
const DEFAULT_ICONS = ['people', 'heart', 'star', 'briefcase', 'school'];
const DEFAULT_COLORS = ['#3b82f6', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6'];

export default function GroupFilter({
  groups,
  selectedGroupId,
  onSelectGroup,
  totalCount = 0,
}: GroupFilterProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* All button */}
        <TouchableOpacity
          style={[
            styles.chip,
            selectedGroupId === null && styles.chipSelected,
          ]}
          onPress={() => onSelectGroup(null)}
        >
          <Ionicons
            name="grid-outline"
            size={16}
            color={selectedGroupId === null ? colors.white : colors.textSecondary}
          />
          <Text
            style={[
              styles.chipText,
              selectedGroupId === null && styles.chipTextSelected,
            ]}
          >
            全部
          </Text>
          {totalCount > 0 && (
            <View style={[styles.countBadge, selectedGroupId === null && styles.countBadgeSelected]}>
              <Text style={[styles.countText, selectedGroupId === null && styles.countTextSelected]}>
                {totalCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Group chips */}
        {groups.map((group, index) => {
          const isSelected = selectedGroupId === group.id;
          const iconName = group.icon || DEFAULT_ICONS[index % DEFAULT_ICONS.length];
          const chipColor = group.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length];

          return (
            <TouchableOpacity
              key={group.id}
              style={[
                styles.chip,
                isSelected && { backgroundColor: chipColor },
              ]}
              onPress={() => onSelectGroup(group.id)}
            >
              <Ionicons
                name={iconName as any}
                size={16}
                color={isSelected ? colors.white : chipColor}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? colors.white : colors.textPrimary },
                ]}
              >
                {group.name}
              </Text>
              {group.count !== undefined && group.count > 0 && (
                <View style={[
                  styles.countBadge,
                  isSelected ? styles.countBadgeSelected : { backgroundColor: chipColor + '20' },
                ]}>
                  <Text style={[
                    styles.countText,
                    { color: isSelected ? colors.white : chipColor },
                  ]}>
                    {group.count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 4,
    gap: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.white,
  },
  countBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  countText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  countTextSelected: {
    color: colors.white,
  },
});
