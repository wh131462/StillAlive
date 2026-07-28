import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { BuiltInTagSystem, TagGroup } from '@still-alive/types';
import { useAppState } from '../src/state/app-state';
import { createThemedStyles } from '../src/theme/app-theme';
import { MBTI_TYPES } from '../src/domain/person-profile';

const BUILT_IN_OPTIONS: Record<Exclude<BuiltInTagSystem, 'custom'>, readonly string[]> = {
  mbti: MBTI_TYPES,
  constellation: ['白羊座', '金牛座', '双子座', '巨蟹座', '狮子座', '处女座', '天秤座', '天蝎座', '射手座', '摩羯座', '水瓶座', '双鱼座'],
  zodiac: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],
};

export default function TagManagementScreen() {
  const router = useRouter();
  const { countPeopleByTag, createTag, createTagGroup, deleteTag, deleteTagGroup, renameTag, renameTagGroup, tagDefinitions, tagGroups, tagSystemSettings, updateTagSystems } = useAppState();
  const [newTagName, setNewTagName] = useState('');
  const [newGroupName, setNewGroupName] = useState('');
  const [optionDrafts, setOptionDrafts] = useState<Record<string, string>>({});
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const singleTags = tagDefinitions.filter((tag) => !tag.groupId);
  const orderedSystems = [...tagSystemSettings].filter((item) => item.system !== 'custom').sort((a, b) => a.sortOrder - b.sortOrder);

  const toggleSystem = (system: BuiltInTagSystem) => void updateTagSystems(tagSystemSettings.map((item) => item.system === system ? { ...item, enabled: !item.enabled } : item)).catch(showError);
  const moveSystem = (index: number, offset: number) => {
    const target = index + offset;
    if (target < 0 || target >= orderedSystems.length) return;
    const nextBuiltIns = [...orderedSystems];
    [nextBuiltIns[index], nextBuiltIns[target]] = [nextBuiltIns[target], nextBuiltIns[index]];
    const custom = tagSystemSettings.find((item) => item.system === 'custom');
    void updateTagSystems([...nextBuiltIns.map((item, sortOrder) => ({ ...item, sortOrder })), ...(custom ? [{ ...custom, sortOrder: nextBuiltIns.length }] : [])]).catch(showError);
  };
  const addSingleTag = () => void createTag(newTagName).then(() => setNewTagName(''), showError);
  const addGroup = () => void createTagGroup(newGroupName).then(() => setNewGroupName(''), showError);
  const addOption = (groupId: string) => {
    const name = optionDrafts[groupId] ?? '';
    void createTag(name, groupId).then(() => setOptionDrafts((current) => ({ ...current, [groupId]: '' })), showError);
  };
  const confirmDeleteTag = async (tagId: string, name: string) => {
    const count = await countPeopleByTag(tagId);
    Alert.alert(`删除“${name}”？`, count ? `该标签已用于 ${count} 个人物，删除后会解除关联。` : '删除后无法恢复。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void deleteTag(tagId).catch(showError) }]);
  };
  const confirmDeleteGroup = async (group: TagGroup) => {
    const options = tagDefinitions.filter((tag) => tag.groupId === group.id);
    const counts = await Promise.all(options.map((tag) => countPeopleByTag(tag.id)));
    const count = counts.reduce((total, value) => total + value, 0);
    Alert.alert(`删除标签组“${group.name}”？`, count ? `组内选项存在 ${count} 条人物关联，删除后会全部解除。` : '组内选项也会一并删除。', [{ text: '取消', style: 'cancel' }, { text: '删除标签组', style: 'destructive', onPress: () => void deleteTagGroup(group.id).catch(showError) }]);
  };
  const saveEditing = () => {
    if (editingTagId) void renameTag(editingTagId, editingName).then(closeEditing, showError);
    else if (editingGroupId) void renameTagGroup(editingGroupId, editingName).then(closeEditing, showError);
  };
  const closeEditing = () => { setEditingTagId(null); setEditingGroupId(null); setEditingName(''); };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Text style={styles.headerTitle}>标签管理</Text><View style={styles.headerButton} /></View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.typeGuide}><View style={styles.typeItem}><View style={styles.typeIcon}><SymbolView name={{ android: 'label', ios: 'tag', web: 'label' }} size={18} tintColor={colors.life} type="hierarchical" /></View><View><Text style={styles.typeTitle}>单条标签</Text><Text style={styles.typeHint}>可同时选择多个</Text></View></View><View style={styles.typeDivider} /><View style={styles.typeItem}><View style={styles.typeIcon}><SymbolView name={{ android: 'folder_open', ios: 'folder', web: 'folder_open' }} size={18} tintColor={colors.life} type="hierarchical" /></View><View><Text style={styles.typeTitle}>标签组</Text><Text style={styles.typeHint}>同组只能选择一个</Text></View></View></View>

      <Text style={styles.eyebrow}>SINGLE TAGS</Text><Text style={styles.sectionTitle}>单条标签</Text>
      <CreateRow buttonLabel="新增" onChangeText={setNewTagName} onSubmit={addSingleTag} placeholder="例如：大学同学" value={newTagName} />
      <View style={styles.list}>{singleTags.length ? singleTags.map((tag, index) => <TagRow key={tag.id} bordered={index > 0} name={tag.name} onDelete={() => void confirmDeleteTag(tag.id, tag.name)} onEdit={() => { setEditingTagId(tag.id); setEditingName(tag.name); }} />) : <Empty text="还没有单条标签" />}</View>

      <View style={styles.sectionRule} /><Text style={styles.eyebrow}>TAG GROUPS</Text><Text style={styles.sectionTitle}>标签组</Text>
      <Text style={styles.subheading}>内置标签组</Text>
      <View style={styles.list}>{orderedSystems.map((setting, index) => {
        const system = setting.system as Exclude<BuiltInTagSystem, 'custom'>;
        const options = BUILT_IN_OPTIONS[system];
        return <View key={system} style={[styles.builtInRow, index > 0 && styles.rowBorder]}><View style={styles.groupCopy}><View style={styles.groupTitleRow}><Text style={styles.rowTitle}>{systemLabel(system)}</Text><View style={styles.fixedBadge}><Text style={styles.fixedBadgeText}>固定选项</Text></View></View><Text style={styles.rowHint}>{options.length} 个选项 · {options.slice(0, 4).join('、')}{options.length > 4 ? '…' : ''}</Text></View><View style={styles.orderActions}><Pressable accessibilityLabel="上移" disabled={index === 0} onPress={() => moveSystem(index, -1)} style={[styles.iconButton, index === 0 && styles.disabled]}><SymbolView name={{ android: 'arrow_upward', ios: 'arrow.up', web: 'arrow_upward' }} size={16} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel="下移" disabled={index === orderedSystems.length - 1} onPress={() => moveSystem(index, 1)} style={[styles.iconButton, index === orderedSystems.length - 1 && styles.disabled]}><SymbolView name={{ android: 'arrow_downward', ios: 'arrow.down', web: 'arrow_downward' }} size={16} tintColor={colors.life} type="hierarchical" /></Pressable></View><Pressable accessibilityRole="switch" accessibilityState={{ checked: setting.enabled }} onPress={() => toggleSystem(system)} style={[styles.switchTrack, setting.enabled && styles.switchTrackOn]}><View style={[styles.switchThumb, setting.enabled && styles.switchThumbOn]} /></Pressable></View>;
      })}</View>

      <Text style={styles.subheading}>自定义标签组</Text>
      <CreateRow buttonLabel="新建组" onChangeText={setNewGroupName} onSubmit={addGroup} placeholder="例如：关系阶段" value={newGroupName} />
      {tagGroups.length ? tagGroups.map((group) => {
        const options = tagDefinitions.filter((tag) => tag.groupId === group.id);
        const draft = optionDrafts[group.id] ?? '';
        return <View key={group.id} style={styles.groupCard}><View style={styles.groupHeader}><View style={styles.groupCopy}><Text style={styles.groupName}>{group.name}</Text><Text style={styles.rowHint}>{options.length} 个选项 · 单选</Text></View><Pressable accessibilityLabel="修改组名" onPress={() => { setEditingGroupId(group.id); setEditingName(group.name); }} style={styles.iconButton}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel="删除标签组" onPress={() => void confirmDeleteGroup(group)} style={styles.iconButton}><SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={17} tintColor={colors.danger} type="hierarchical" /></Pressable></View><View style={styles.optionChips}>{options.map((option) => <Pressable key={option.id} onLongPress={() => void confirmDeleteTag(option.id, option.name)} onPress={() => { setEditingTagId(option.id); setEditingName(option.name); }} style={styles.optionChip}><Text style={styles.optionText}>{option.name}</Text><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={11} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>)}</View><View style={styles.optionCreate}><TextInput maxLength={24} onChangeText={(value) => setOptionDrafts((current) => ({ ...current, [group.id]: value }))} onSubmitEditing={() => addOption(group.id)} placeholder="添加固定选项" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.optionInput} value={draft} /><Pressable disabled={!draft.trim()} onPress={() => addOption(group.id)} style={[styles.optionAdd, !draft.trim() && styles.disabled]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.life} type="hierarchical" /></Pressable></View></View>;
      }) : <View style={styles.list}><Empty text="还没有自定义标签组" /></View>}
    </ScrollView>

    <Modal animationType="slide" onRequestClose={closeEditing} transparent visible={Boolean(editingTagId || editingGroupId)}><Pressable onPress={closeEditing} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}><View style={styles.handle} /><Text style={styles.sheetTitle}>{editingGroupId ? '修改标签组' : '修改标签'}</Text><TextInput autoFocus maxLength={24} onChangeText={setEditingName} onSubmitEditing={saveEditing} style={styles.editInput} value={editingName} /><Pressable disabled={!editingName.trim()} onPress={saveEditing} style={[styles.confirmButton, !editingName.trim() && styles.disabled]}><Text style={styles.confirmText}>保存修改</Text></Pressable></Pressable></Pressable></Modal>
  </SafeAreaView>;
}

function CreateRow({ buttonLabel, onChangeText, onSubmit, placeholder, value }: { buttonLabel: string; onChangeText(value: string): void; onSubmit(): void; placeholder: string; value: string }) { return <View style={styles.createRow}><TextInput maxLength={24} onChangeText={onChangeText} onSubmitEditing={onSubmit} placeholder={placeholder} placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.input} value={value} /><Pressable disabled={!value.trim()} onPress={onSubmit} style={[styles.addButton, !value.trim() && styles.disabled]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.addText}>{buttonLabel}</Text></Pressable></View>; }
function TagRow({ bordered, name, onDelete, onEdit }: { bordered: boolean; name: string; onDelete(): void; onEdit(): void }) { return <View style={[styles.tagRow, bordered && styles.rowBorder]}><View style={styles.tagMark} /><Text style={styles.tagName}>{name}</Text><Pressable accessibilityLabel={`修改${name}`} onPress={onEdit} style={styles.iconButton}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={18} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel={`删除${name}`} onPress={onDelete} style={styles.iconButton}><SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={18} tintColor={colors.danger} type="hierarchical" /></Pressable></View>; }
function Empty({ text }: { text: string }) { return <View style={styles.empty}><Text style={styles.emptyText}>{text}</Text></View>; }
function systemLabel(system: Exclude<BuiltInTagSystem, 'custom'>) { return { mbti: 'MBTI', constellation: '星座', zodiac: '生肖' }[system]; }
function showError(cause: unknown) { Alert.alert('操作失败', cause instanceof Error ? cause.message : '请稍后重试。'); }

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  typeGuide: { minHeight: 76, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.lifeLight }, typeItem: { flex: 1, flexDirection: 'row', alignItems: 'center' }, typeIcon: { width: 36, height: 36, marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.paper }, typeTitle: { color: colors.ink, fontSize: 11, fontWeight: '700' }, typeHint: { marginTop: 4, color: colors.inkFaint, fontSize: 8 }, typeDivider: { width: StyleSheet.hairlineWidth, height: 36, marginHorizontal: spacing.sm, backgroundColor: colors.line },
  eyebrow: { marginTop: spacing.xl, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 }, sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 }, sectionRule: { height: StyleSheet.hairlineWidth, marginTop: spacing.xl, backgroundColor: colors.line }, subheading: { marginTop: spacing.lg, color: colors.inkSoft, fontSize: 11, fontWeight: '700' },
  createRow: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }, input: { flex: 1, minHeight: 50, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 14 }, addButton: { minWidth: 82, paddingHorizontal: spacing.md, flexDirection: 'row', gap: 5, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, addText: { color: colors.onLife, fontSize: 10, fontWeight: '700' }, disabled: { opacity: 0.35 },
  list: { marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, tagRow: { minHeight: 58, paddingLeft: spacing.md, flexDirection: 'row', alignItems: 'center' }, rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, tagMark: { width: 7, height: 7, marginRight: spacing.md, borderRadius: 4, backgroundColor: colors.sun }, tagName: { flex: 1, color: colors.ink, fontSize: 12 }, iconButton: { width: 38, height: 40, alignItems: 'center', justifyContent: 'center' }, empty: { minHeight: 64, alignItems: 'center', justifyContent: 'center' }, emptyText: { color: colors.inkFaint, fontSize: 9 },
  builtInRow: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, groupCopy: { flex: 1 }, groupTitleRow: { flexDirection: 'row', alignItems: 'center' }, rowTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' }, rowHint: { marginTop: 5, color: colors.inkFaint, fontSize: 8 }, fixedBadge: { marginLeft: spacing.sm, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 8, backgroundColor: colors.lifeLight }, fixedBadgeText: { color: colors.life, fontSize: 7, fontWeight: '700' }, orderActions: { flexDirection: 'row' }, switchTrack: { width: 40, height: 24, marginLeft: spacing.sm, padding: 2, borderRadius: 12, backgroundColor: colors.line }, switchTrackOn: { backgroundColor: colors.life }, switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.paper }, switchThumbOn: { alignSelf: 'flex-end' },
  groupCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.sheet }, groupHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center' }, groupName: { color: colors.ink, fontFamily: typography.display, fontSize: 17 }, optionChips: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 7 }, optionChip: { minHeight: 32, paddingHorizontal: 10, flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 16, backgroundColor: colors.lifeLight }, optionText: { color: colors.life, fontSize: 9 }, optionCreate: { marginTop: spacing.md, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, optionInput: { flex: 1, minHeight: 46, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 11 }, optionAdd: { width: 44, height: 44, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, editInput: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, confirmButton: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, confirmText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
}));
