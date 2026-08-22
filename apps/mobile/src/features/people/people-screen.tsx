import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { useAppState } from '../../application/state/app-state';
import { TabPageHeader } from '../../shared/components/tab-page-header';
import { createThemedStyles, nameTextStyle } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';

export default function PeopleScreen() {
  const router = useRouter();
  const { createPerson, getPostsByPerson, media, people, posts, preferences } = useAppState();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [sortByName, setSortByName] = useState(false);
  const [summaries, setSummaries] = useState<Record<string, { count: number; latestDay: string | null }>>({});

  useEffect(() => {
    let active = true;
    void Promise.all(people.map(async (person) => {
      const relatedPosts = await getPostsByPerson(person.id);
      return [person.id, { count: relatedPosts.length, latestDay: relatedPosts[0]?.dayKey ?? null }] as const;
    })).then((entries) => {
      if (!active) return;
      setSummaries(Object.fromEntries(entries));
    }).catch(() => {
      if (active) setSummaries({});
    });
    return () => { active = false; };
  }, [getPostsByPerson, people, posts]);

  const visiblePeople = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return people
      .filter((person) => !normalizedQuery || [person.name, person.relationToMe ?? '', person.impression ?? ''].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
      .sort((a, b) => {
        if (sortByName) return a.name.localeCompare(b.name, 'zh-CN');
        const latestA = summaries[a.id]?.latestDay ?? '';
        const latestB = summaries[b.id]?.latestDay ?? '';
        return latestB.localeCompare(latestA) || a.name.localeCompare(b.name, 'zh-CN');
      });
  }, [people, query, sortByName, summaries]);

  const handleCreate = async () => {
    const value = name.trim();
    if (!value) return;
    try {
      const person = await createPerson(value);
      setName('');
      setCreating(false);
      router.push(`/person/${person.id}`);
    } catch (cause: unknown) {
      feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppKeyboardAvoidingView style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <TabPageHeader
          action={(
            <View style={styles.headerActions}>
              <Pressable accessibilityLabel="导入对方填写的资料" accessibilityRole="button" onPress={() => router.push('/profile-collection/import')} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}><SymbolView name={{ android: 'move_to_inbox', ios: 'tray.and.arrow.down.fill', web: 'move_to_inbox' }} pointerEvents="none" size={20} tintColor={colors.life} type="hierarchical" /></Pressable>
              <Pressable accessibilityLabel="添加人物" accessibilityRole="button" onPress={() => setCreating(true)} style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}><SymbolView name={{ android: 'person_add', ios: 'person.badge.plus', web: 'person_add' }} pointerEvents="none" size={21} tintColor={colors.life} type="hierarchical" /></Pressable>
            </View>
          )}
          eyebrow="PEOPLE"
          subtitle="有些日子，因为有人而记得。"
          title="人物"
        />

        {people.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有人物</Text>
            <Text style={styles.emptyText}>写日记时使用 @人物，或在这里先记下一个名字。</Text>
            <Text style={styles.emptyAction}>添加第一个人物 →</Text>
          </Pressable>
        ) : (
          <>
            <View style={styles.controls}>
              <View style={[styles.searchField, searchFocused && styles.searchFieldFocused]}>
                <SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} pointerEvents="none" size={18} tintColor={searchFocused ? colors.life : colors.inkFaint} type="hierarchical" />
                <TextInput
                  accessibilityLabel="搜索人物、关系或印象"
                  autoCorrect={false}
                  onBlur={() => setSearchFocused(false)}
                  onChangeText={setQuery}
                  onFocus={() => setSearchFocused(true)}
                  placeholder="搜索人物、关系或印象"
                  placeholderTextColor={colors.inkFaint}
                  returnKeyType="search"
                  style={styles.searchInput}
                  value={query}
                />
                {query ? (
                  <Pressable accessibilityLabel="清除搜索" accessibilityRole="button" hitSlop={8} onPress={() => setQuery('')} style={({ pressed }) => [styles.clearButton, pressed && styles.clearButtonPressed]}>
                    <SymbolView name={{ android: 'close', ios: 'xmark.circle.fill', web: 'close' }} pointerEvents="none" size={17} tintColor={colors.inkFaint} type="hierarchical" />
                  </Pressable>
                ) : null}
              </View>
              <View style={styles.controlsMeta}>
                <Text accessibilityLiveRegion="polite" style={styles.resultCount}>{query.trim() ? `${visiblePeople.length} 个结果` : `共 ${people.length} 人`}</Text>
                <View style={styles.sortGroup}>
                  <Text style={styles.sortLabel}>排序</Text>
                  <View accessibilityLabel="人物排序方式" style={styles.sortControl}>
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: !sortByName }} onPress={() => setSortByName(false)} style={[styles.sortOption, !sortByName && styles.sortOptionActive]}>
                      <Text style={[styles.sortOptionText, !sortByName && styles.sortOptionTextActive]}>最近</Text>
                    </Pressable>
                    <Pressable accessibilityRole="button" accessibilityState={{ selected: sortByName }} onPress={() => setSortByName(true)} style={[styles.sortOption, sortByName && styles.sortOptionActive]}>
                      <Text style={[styles.sortOptionText, sortByName && styles.sortOptionTextActive]}>名称</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            </View>
            {visiblePeople.length ? <View style={styles.list}>
            {visiblePeople.map((person, index) => {
              const avatar = person.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
              const summary = summaries[person.id];
              return <Pressable key={person.id} accessibilityLabel={`查看${person.name}的人物详情`} accessibilityRole="button" onPress={() => router.push(`/person/${person.id}`)} style={({ pressed }) => [styles.personRow, index === visiblePeople.length - 1 && styles.personRowLast, pressed && styles.personRowPressed]}>
                <View style={styles.avatar}>{avatar ? <Image accessibilityLabel={`${person.name}的头像`} resizeMode="cover" source={{ uri: avatar.localPath }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text>}</View>
                <View style={styles.personInfo}>
                  <View style={styles.personTitleRow}>
                    <Text numberOfLines={1} style={[styles.personName, nameTextStyle(preferences.friendNameStyle)]}>{person.name}</Text>
                    {person.relationToMe ? <Text numberOfLines={1} style={styles.personRelation}>{person.relationToMe}</Text> : null}
                  </View>
                  <Text numberOfLines={2} style={styles.personMeta}>{person.impression ?? '还没有留下关于 ta 的印象'}</Text>
                  <Text style={styles.personStats}>{summary?.count ?? 0} 条共同记录 / {summary?.latestDay ? `最近 ${formatDay(summary.latestDay)}` : '还没有共同记录'}</Text>
                </View>
                <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={18} tintColor={colors.inkFaint} type="hierarchical" />
              </Pressable>;
            })}
            </View> : <View style={styles.noResults}><Text style={styles.noResultsText}>没有找到匹配的人物。</Text></View>}
          </>
        )}
        </ScrollView>
      </AppKeyboardAvoidingView>

      <DraggableBottomSheet keyboardAvoiding onClose={() => setCreating(false)} open={creating} sheetStyle={styles.sheet}>
              <Text style={styles.sheetTitle}>先记下一个名字</Text>
              <Text style={styles.sheetHint}>其他信息以后再补，也可以一直不补。</Text>
              <TextInput maxLength={40} onChangeText={setName} onSubmitEditing={() => void handleCreate()} placeholder="名字" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.input} value={name} />
              <Pressable accessibilityRole="button" disabled={!name.trim()} onPress={() => void handleCreate()} style={({ pressed }) => [styles.confirmButton, !name.trim() && styles.confirmButtonDisabled, pressed && styles.confirmButtonPressed]}>
                <Text style={styles.confirmButtonText}>创建人物</Text>
              </Pressable>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

function formatDay(dayKey: string): string {
  const [, month, day] = dayKey.split('-');
  return `${Number(month)}月${Number(day)}日`;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  addButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 22, backgroundColor: colors.lifeLight },
  addButtonPressed: { opacity: 0.72, transform: [{ scale: 0.94 }] },
  controls: { marginBottom: spacing.md },
  searchField: { height: 50, paddingLeft: spacing.md, paddingRight: 6, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet },
  searchFieldFocused: { borderColor: colors.life },
  searchInput: { flex: 1, height: '100%', paddingHorizontal: spacing.sm, paddingVertical: 0, color: colors.ink, fontSize: 13 },
  clearButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18 },
  clearButtonPressed: { backgroundColor: colors.lifeLight },
  controlsMeta: { minHeight: 44, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  resultCount: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 0.5 },
  sortGroup: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  sortLabel: { color: colors.inkFaint, fontSize: typography.size.meta },
  sortControl: { width: 126, height: 36, padding: 3, flexDirection: 'row', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 18, backgroundColor: colors.sheet },
  sortOption: { flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  sortOptionActive: { backgroundColor: colors.life },
  sortOptionText: { color: colors.inkFaint, fontSize: typography.size.meta },
  sortOptionTextActive: { color: colors.onLife, fontWeight: '700' },
  emptyCard: { marginTop: 0, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, lineHeight: 21 },
  emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' },
  list: { marginTop: 0, paddingHorizontal: spacing.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet },
  personRow: { minHeight: 92, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  personRowLast: { borderBottomWidth: 0 },
  personRowPressed: { opacity: 0.58 },
  avatar: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 26, backgroundColor: colors.life },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 20 },
  personInfo: { flex: 1, marginLeft: spacing.md },
  personTitleRow: { flexDirection: 'row', alignItems: 'center' },
  personName: { maxWidth: '64%', color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  personRelation: { maxWidth: '34%', marginLeft: spacing.sm, paddingHorizontal: 7, paddingVertical: 3, overflow: 'hidden', borderRadius: 9, backgroundColor: colors.lifeLight, color: colors.life, fontSize: typography.size.meta },
  personMeta: { marginTop: 5, marginRight: spacing.md, color: colors.inkFaint, fontSize: 11, lineHeight: 17 },
  personStats: { marginTop: 5, color: colors.life, fontFamily: typography.mono, fontSize: 10 },
  noResults: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  noResultsText: { color: colors.inkSoft, fontSize: 12 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  handle: { width: 38, height: 4, alignSelf: 'center', marginVertical: spacing.md, borderRadius: 2, backgroundColor: colors.line },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 25 },
  sheetHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 },
  input: { height: 54, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 16 },
  confirmButton: { height: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  confirmButtonDisabled: { opacity: 0.35 },
  confirmButtonPressed: { opacity: 0.82 },
  confirmButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
}));
