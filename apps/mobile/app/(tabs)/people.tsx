import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { Person, CreatePersonRequest } from '@still-alive/types';
import { usePersonStore } from '../../src/stores/personStore';
import { useUIStore } from '../../src/stores/uiStore';
import {
  SearchBar,
  SortOptions,
  PersonCard,
  BirthdaySection,
  FloatingAddButton,
  PersonFormModal,
} from '../../src/components/people';
import { colors } from '../../src/theme/colors';

export default function PeopleScreen() {
  const {
    persons,
    isLoading,
    sortBy,
    searchKeyword,
    todayBirthdays,
    filteredPersons,
    fetchPersons,
    fetchTodayBirthdays,
    setSearchKeyword,
    setSortBy,
    createPerson,
    isCreating,
  } = usePersonStore();

  const {
    isPersonFormOpen,
    personFormMode,
    openPersonForm,
    closePersonForm,
    showToast,
  } = useUIStore();

  const [refreshing, setRefreshing] = useState(false);

  // Fetch data on mount and focus
  useFocusEffect(
    useCallback(() => {
      fetchPersons();
      fetchTodayBirthdays();
    }, [fetchPersons, fetchTodayBirthdays])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchPersons(), fetchTodayBirthdays()]);
    setRefreshing(false);
  };

  const handleAddPerson = () => {
    openPersonForm('create');
  };

  const handlePersonPress = (person: Person) => {
    // TODO: Navigate to person detail or open detail modal
    console.log('Person pressed:', person.id);
  };

  const handleCreatePerson = async (data: CreatePersonRequest) => {
    try {
      await createPerson(data);
      closePersonForm();
      showToast({ type: 'success', message: '添加成功' });
    } catch {
      showToast({ type: 'error', message: '添加失败' });
    }
  };

  const displayedPersons = filteredPersons();

  const renderHeader = () => (
    <View>
      {/* Search and Add */}
      <View style={styles.searchRow}>
        <SearchBar
          value={searchKeyword}
          onChangeText={setSearchKeyword}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={handleAddPerson}
        >
          <Ionicons name="add" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* Sort Options */}
      <View style={styles.sortSection}>
        <SortOptions value={sortBy} onChange={setSortBy} />
      </View>

      {/* Birthday Section */}
      <BirthdaySection
        persons={todayBirthdays}
        onPersonPress={handlePersonPress}
      />

      {/* All People Header */}
      <Text style={styles.sectionTitle}>
        全部人物 ({displayedPersons.length})
      </Text>
    </View>
  );

  const renderEmpty = () => (
    <View style={styles.empty}>
      <Ionicons name="people-outline" size={48} color={colors.textMuted} />
      <Text style={styles.emptyText}>
        {searchKeyword ? '未找到匹配的人物' : '还没有添加人物'}
      </Text>
      {!searchKeyword && (
        <TouchableOpacity
          style={styles.emptyButton}
          onPress={handleAddPerson}
        >
          <Text style={styles.emptyButtonText}>添加第一个人物</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={displayedPersons}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <PersonCard
            person={item}
            onPress={() => handlePersonPress(item)}
          />
        )}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
      />

      {/* Floating Add Button */}
      <FloatingAddButton onPress={handleAddPerson} />

      {/* Person Form Modal */}
      <PersonFormModal
        visible={isPersonFormOpen}
        mode={personFormMode}
        onClose={closePersonForm}
        onSubmit={handleCreatePerson}
        isLoading={isCreating}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 16,
    paddingTop: 60,
    paddingBottom: 100,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  addButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
    marginBottom: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: 12,
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
  },
});
