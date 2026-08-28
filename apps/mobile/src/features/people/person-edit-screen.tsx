import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { useAppState } from '../../application/state/app-state';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import type { Birthday, BirthdayCalendar, Media } from '@still-alive/types';
import { DatePickerField, TimePickerField } from './date-time-picker';
import { GenderPickerField } from './gender-picker';
import { MbtiPickerField } from './mbti-picker';
import { RelationshipPicker } from './relationship-picker';
import type { DateParts } from './date-time-picker';
import { birthdayForCalendar } from './person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';

export default function EditPersonScreen() {
  const router = useRouter();
 const { id } = useLocalSearchParams<{ id: string }>();
  const { albums, createTag, deletePerson, discardMedia, media, notificationPermission, openNotificationSettings, people, personTags, preferences, saveMedia, setBirthdayNotificationsEnabled, tagDefinitions, tagGroups, tagSystemSettings, updatePerson } = useAppState();
  const person = useMemo(() => people.find((item) => item.id === id), [id, people]);
  const currentAvatar = person?.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
  const [name, setName] = useState(person?.name ?? '');
  const [nickname, setNickname] = useState(person?.nickname ?? '');
  const [bio, setBio] = useState(person?.bio ?? '');
  const [gender, setGender] = useState(person?.gender ?? null);
  const [relation, setRelation] = useState(person?.relationToMe ?? '');
  const [impression, setImpression] = useState(person?.impression ?? '');
  const [birthdayCalendar, setBirthdayCalendar] = useState<BirthdayCalendar>(person?.birthday?.calendar ?? 'solar');
  const [birthdayDate, setBirthdayDate] = useState<DateParts | null>(person?.birthday ? { year: person.birthday.year, month: person.birthday.month, day: person.birthday.day } : null);
  const [birthdayIsLeapMonth, setBirthdayIsLeapMonth] = useState(person?.birthday?.isLeapMonth ?? false);
  const [birthdayReminderEnabled, setBirthdayReminderEnabled] = useState(person?.birthday?.reminderEnabled ?? true);
  const [birthdayReminderHour, setBirthdayReminderHour] = useState<number | null>(person?.birthday?.reminderHour ?? null);
  const [birthdayReminderMinute, setBirthdayReminderMinute] = useState<number | null>(person?.birthday?.reminderMinute ?? null);
  const initialAssignments = personTags.filter((item) => item.personId === person?.id);
  const [mbti, setMbti] = useState(initialAssignments.find((item) => item.kind === 'mbti')?.value ?? '');
  const [customTagIds, setCustomTagIds] = useState(initialAssignments.filter((item) => item.kind === 'custom').map((item) => item.value));
  const [newTagName, setNewTagName] = useState('');
  const [pickedAsset, setPickedAsset] = useState<ImagePickerAsset | null>(null);
  const [avatarSourcePickerOpen, setAvatarSourcePickerOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [saving, setSaving] = useState(false);
 const avatarUri = pickedAsset?.uri ?? currentAvatar?.localPath;
  const globalReminderEnabled = preferences.birthdayNotificationsEnabled;
  const hasCustomReminderTime = birthdayReminderHour !== null && birthdayReminderMinute !== null;
  const effectiveReminderHour = birthdayReminderHour ?? preferences.birthdayReminderHour;
  const effectiveReminderMinute = birthdayReminderMinute ?? preferences.birthdayReminderMinute;

  const changeBirthdayCalendar = (calendar: BirthdayCalendar) => {
    if (calendar === birthdayCalendar) return;
    if (birthdayDate) {
      const converted = birthdayForCalendar({
        calendar: birthdayCalendar,
        ...birthdayDate,
        isLeapMonth: birthdayCalendar === 'lunar' && birthdayIsLeapMonth,
        reminderEnabled: birthdayReminderEnabled,
        reminderHour: birthdayReminderHour,
        reminderMinute: birthdayReminderMinute,
        reminderMode: birthdayCalendar,
      }, calendar);
      setBirthdayDate({ year: converted.year, month: converted.month, day: converted.day });
      setBirthdayIsLeapMonth(converted.isLeapMonth);
    } else {
      setBirthdayIsLeapMonth(false);
    }
    setBirthdayCalendar(calendar);
  };

  const takeAvatarPhoto = async () => {
    setAvatarSourcePickerOpen(false);
    if (!await ensureAppPermission('camera')) return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    setPickedAsset(result.assets[0]);
    setAvatarFailed(false);
  };

  const pickAvatarPhoto = async () => {
    setAvatarSourcePickerOpen(false);
    if (!await ensureAppPermission('photos')) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    setPickedAsset(result.assets[0]);
    setAvatarFailed(false);
  };

  const handleSave = async () => {
    if (!person || !name.trim()) {
      feedback.alert('请填写名字');
      return;
    }
    let importedMedia: Media | null = null;
    try {
      setSaving(true);
      let avatarMediaId = person.avatarMediaId;
      if (pickedAsset) {
        const item = await persistPickedImage(pickedAsset);
        importedMedia = item;
        await saveMedia(item);
        avatarMediaId = item.id;
      }
      await updatePerson(person.id, {
        name: name.trim(),
        nickname: nickname.trim(),
        bio: bio.trim(),
        avatarMediaId,
        gender,
        relationToMe: relation.trim() || null,
        impression: impression.trim() || null,
        birthday: birthdayDate ? { calendar: birthdayCalendar, ...birthdayDate, isLeapMonth: birthdayCalendar === 'lunar' && birthdayIsLeapMonth, reminderEnabled: birthdayReminderEnabled, reminderHour: birthdayReminderHour, reminderMinute: birthdayReminderMinute, reminderMode: birthdayCalendar } satisfies Birthday : null,
      }, mbti || null, customTagIds);
      router.back();
    } catch (cause: unknown) {
      if (importedMedia) {
        await discardMedia(importedMedia);
      }
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
   } finally {
     setSaving(false);
   }
 };

  const handleReminderAction = async () => {
    if (globalReminderEnabled && notificationPermission === 'denied') {
      await openNotificationSettings();
    } else {
      await setBirthdayNotificationsEnabled(true);
    }
  };

  const confirmDelete = () => {
    if (!person) return;
    const albumCount = albums.filter((album) => album.personId === person.id).length;
    feedback.alert(`删除 ${person.name}？`, `人物会被删除，历史记录会保留，只解除人物关联。${albumCount ? `同时永久删除 ${albumCount} 个相册及其中媒体。` : ''}此操作无法恢复。`, [
      { text: '取消', style: 'cancel' },
      { text: '删除人物', style: 'destructive', onPress: () => void deletePerson(person.id).then(
        () => router.replace('/people'),
        (cause: unknown) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。'),
      ) },
    ]);
  };

  if (!person) return <SafeAreaView style={styles.safeArea}><ToolPageHeader onBack={() => router.back()} title="编辑人物" /><Text style={styles.missing}>这个人物不存在或已被删除。</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <AppKeyboardAvoidingView style={styles.flex}>
        <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderTextAction disabled={saving} label={saving ? '保存中' : '保存'} onPress={() => void handleSave()} />} title="编辑人物" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <View style={styles.avatarCard}>
            <Pressable accessibilityLabel={avatarUri ? '更换头像' : '添加头像'} accessibilityRole="button" onPress={() => setAvatarSourcePickerOpen(true)} style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}><View style={styles.avatar}>{avatarUri && !avatarFailed ? <Image accessibilityLabel="人物头像预览" onError={() => setAvatarFailed(true)} resizeMode="cover" source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.trim().slice(0, 1) || '人'}</Text>}<View style={styles.cameraBadge}><SymbolView name={{ android: 'photo_camera', ios: 'camera.fill', web: 'photo_camera' }} size={14} tintColor={colors.onLife} type="hierarchical" /></View></View></Pressable>
            <View style={styles.avatarCopy}>
              <Text style={styles.avatarTitle}>人物头像</Text>
              <Text style={styles.avatarHint}>选择一张容易认出的照片，也可以只保留名字首字。</Text>
              <Text style={styles.avatarAction}>{avatarUri ? '轻点更换' : '轻点添加'}</Text>
            </View>
          </View>

          <SectionHeader description="记录最常用的信息，之后仍可随时修改。" index="01" title="基本资料" />
          <Field label="名字 必填" maxLength={40} onChangeText={setName} placeholder="例如：小满" value={name} />
          <Field label="昵称" maxLength={30} onChangeText={setNickname} placeholder="更常用的称呼，可选" value={nickname} />
          <Field label="个人简介" maxLength={500} multiline onChangeText={setBio} placeholder="介绍一下这个人，可选" value={bio} />
          <GenderPickerField onChange={setGender} value={gender} />
          <RelationshipPicker onChange={setRelation} value={relation} />
          <Field label="一句话印象" maxLength={100} multiline onChangeText={setImpression} placeholder="不必完整，写下此刻最自然的一句话。" value={impression} />

          <SectionHeader description="选择生日历法和日期，提醒会按该历法计算。" index="02" title="生日与提醒" />
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>生日历法</Text>
            <View style={styles.segmented}>{(['solar', 'lunar'] as const).map((calendar) => <Pressable key={calendar} accessibilityRole="button" accessibilityState={{ selected: birthdayCalendar === calendar }} onPress={() => changeBirthdayCalendar(calendar)} style={[styles.segment, birthdayCalendar === calendar && styles.segmentActive]}><Text style={[styles.segmentText, birthdayCalendar === calendar && styles.segmentTextActive]}>{calendar === 'solar' ? '公历' : '农历'}</Text></Pressable>)}</View>
          </View>
          <DatePickerField calendar={birthdayCalendar} isLeapMonth={birthdayIsLeapMonth} label={birthdayCalendar === 'solar' ? '公历生日' : '农历生日'} onChange={(value, nextIsLeapMonth) => { setBirthdayDate(value); setBirthdayIsLeapMonth(nextIsLeapMonth); }} onClear={() => { setBirthdayDate(null); setBirthdayIsLeapMonth(false); }} value={birthdayDate} />

          {birthdayDate ? <>
            <View style={styles.reminderCard}>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: birthdayReminderEnabled }} onPress={() => setBirthdayReminderEnabled((value) => !value)} style={styles.reminderHead}>
                <View style={styles.reminderCopy}>
                  <Text style={styles.reminderTitle}>生日提醒</Text>
                  <Text style={styles.reminderStatus}>{!birthdayReminderEnabled ? '已为此人关闭' : !globalReminderEnabled ? '通用生日提醒未开启' : notificationPermission !== 'granted' ? '需要系统通知权限' : hasCustomReminderTime ? '使用个人提醒时间' : '使用通用默认时间'}</Text>
                </View>
                <View style={[styles.switchTrack, birthdayReminderEnabled && styles.switchTrackOn]}><View style={[styles.switchThumb, birthdayReminderEnabled && styles.switchThumbOn]} /></View>
              </Pressable>
              {birthdayReminderEnabled && (!globalReminderEnabled || notificationPermission !== 'granted') ? <Pressable onPress={() => void handleReminderAction().catch((cause: unknown) => feedback.alert('提醒设置失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={styles.reminderAction}>
                <Text style={styles.reminderActionText}>{globalReminderEnabled && notificationPermission === 'denied' ? '打开系统通知设置' : '开启通用提醒'}</Text>
              </Pressable> : null}
              {preferences.birthdayNotificationError ? <Text style={styles.reminderError}>{preferences.birthdayNotificationError}</Text> : null}
            </View>
            {birthdayReminderEnabled ? <>
              <TimePickerField hour={effectiveReminderHour} label={hasCustomReminderTime ? '个人提醒时间' : '提醒时间 / 使用通用默认'} minute={effectiveReminderMinute} onChange={(hour, minute) => { setBirthdayReminderHour(hour); setBirthdayReminderMinute(minute); }} />
              {hasCustomReminderTime ? <Pressable accessibilityRole="button" onPress={() => { setBirthdayReminderHour(null); setBirthdayReminderMinute(null); }} style={styles.useDefaultTime}><Text style={styles.useDefaultTimeText}>恢复通用默认时间</Text></Pressable> : null}
            </> : null}
          </> : null}

          <SectionHeader description="用 MBTI 和自定义标签，更快找到关于 ta 的记录。" index="03" title="人物标签" />
          {tagSystemSettings.find((item) => item.system === 'mbti')?.enabled !== false ? <MbtiPickerField onChange={setMbti} value={mbti} /> : null}
          {tagSystemSettings.find((item) => item.system === 'custom')?.enabled !== false ? <><View style={styles.field}><Text style={styles.fieldLabel}>单条标签 / 可多选</Text><View style={styles.chips}>{tagDefinitions.filter((tag) => !tag.groupId).map((tag) => <Pressable key={tag.id} onPress={() => setCustomTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} style={[styles.chip, customTagIds.includes(tag.id) && styles.chipActive]}><Text style={[styles.chipText, customTagIds.includes(tag.id) && styles.chipTextActive]}>{tag.name}</Text></Pressable>)}</View><View style={styles.inlineCreate}><TextInput maxLength={24} onChangeText={setNewTagName} placeholder="输入新标签" placeholderTextColor={colors.inkFaint} style={styles.inlineInput} value={newTagName} /><Pressable onPress={() => void createTag(newTagName).then((tag) => { setCustomTagIds((current) => [...current, tag.id]); setNewTagName(''); }, (cause: unknown) => feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={styles.inlineButton}><Text style={styles.inlineButtonText}>添加</Text></Pressable></View></View>{tagGroups.map((group) => { const options = tagDefinitions.filter((tag) => tag.groupId === group.id); if (!options.length) return null; return <View key={group.id} style={styles.field}><Text style={styles.fieldLabel}>{group.name} / 单选</Text><View style={styles.chips}>{options.map((option) => <Pressable key={option.id} onPress={() => setCustomTagIds((current) => { const groupOptionIds = options.map((item) => item.id); const withoutGroup = current.filter((id) => !groupOptionIds.includes(id)); return current.includes(option.id) ? withoutGroup : [...withoutGroup, option.id]; })} style={[styles.chip, customTagIds.includes(option.id) && styles.chipActive]}><Text style={[styles.chipText, customTagIds.includes(option.id) && styles.chipTextActive]}>{option.name}</Text></Pressable>)}</View></View>; })}</> : null}
          <View style={styles.note}><Text style={styles.noteText}>资料只用于整理你的本地记忆，不会上传。</Text></View>
          <View style={styles.dangerZone}>
            <Text style={styles.dangerTitle}>危险操作</Text>
            <Text style={styles.dangerHint}>删除人物不会删除历史记录，但会永久删除其相册及其中媒体。</Text>
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}>
              <Text style={styles.deleteText}>删除这个人物</Text>
            </Pressable>
          </View>
        </ScrollView>
        <DraggableBottomSheet accessibilityLabel="选择头像来源，向下拖动关闭" accessibilityRole="menu" onClose={() => setAvatarSourcePickerOpen(false)} open={avatarSourcePickerOpen} sheetStyle={styles.sourceSheet}>
              <AvatarSourceOption label="拍摄" onPress={() => void takeAvatarPhoto()} />
              <AvatarSourceOption label="从手机相册选择" onPress={() => void pickAvatarPhoto()} />
              <Pressable accessibilityRole="button" onPress={() => setAvatarSourcePickerOpen(false)} style={styles.sourceCancel}><Text style={styles.sourceCancelText}>取消</Text></Pressable>
        </DraggableBottomSheet>
      </AppKeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.inkFaint} style={[styles.input, props.multiline && styles.inputMultiline]} textAlignVertical={props.multiline ? 'top' : 'center'} />
    </View>
  );
}

function AvatarSourceOption({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.sourceOption, pressed && styles.sourceOptionPressed]}><Text style={styles.sourceOptionText}>{label}</Text></Pressable>;
}

function SectionHeader({ description, index, title }: { description: string; index: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionIndex}>{index}</Text>
      <View style={styles.sectionCopy}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <Text style={styles.sectionDescription}>{description}</Text>
      </View>
    </View>
  );
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  avatarCard: { padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet },
  avatarButton: { alignItems: 'center' },
  avatarPressed: { opacity: 0.72 },
  avatar: { width: 86, height: 86, alignItems: 'center', justifyContent: 'center', borderRadius: 43, backgroundColor: colors.life },
  avatarImage: { width: '100%', height: '100%', borderRadius: 43 },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 32 },
  cameraBadge: { position: 'absolute', right: 0, bottom: 0, width: 28, height: 28, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.sheet, borderRadius: 14, backgroundColor: colors.life },
  avatarCopy: { flex: 1, marginLeft: spacing.lg },
  avatarTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  avatarHint: { marginTop: spacing.xs, color: colors.inkSoft, fontSize: typography.size.meta, lineHeight: 17 },
  avatarAction: { marginTop: spacing.sm, color: colors.life, fontSize: typography.size.meta, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sourceSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginVertical: spacing.md, borderRadius: 2, backgroundColor: colors.line },
  sourceOption: { minHeight: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sourceOptionPressed: { opacity: 0.58 },
  sourceOptionText: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  sourceCancel: { minHeight: 54, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  sourceCancelText: { color: colors.inkSoft, fontSize: 14, fontWeight: '600' },
  sectionHeader: { marginTop: spacing.xxl, paddingTop: spacing.md, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sectionIndex: { width: 36, paddingTop: 3, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1 },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  sectionDescription: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  field: { marginTop: spacing.lg },
  fieldLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 15 },
  inputMultiline: { minHeight: 112, paddingTop: spacing.md, lineHeight: 23 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.sheet },
  segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  segmentActive: { backgroundColor: colors.paper },
  segmentText: { color: colors.inkFaint, fontSize: 11 },
  segmentTextActive: { color: colors.life, fontWeight: '700' },
  reminderCard: { marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet },
  reminderHead: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reminderCopy: { flex: 1, paddingRight: spacing.md },
  reminderTitle: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  reminderStatus: { marginTop: 5, color: colors.inkFaint, fontSize: 10 },
  switchTrack: { width: 42, height: 24, padding: 2, borderRadius: 12, backgroundColor: colors.line },
  switchTrackOn: { backgroundColor: colors.life },
  switchThumb: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.paper },
  switchThumbOn: { transform: [{ translateX: 18 }] },
  reminderAction: { marginTop: spacing.sm, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.life },
  reminderActionText: { color: colors.onLife, fontSize: 10, fontWeight: '700' },
  reminderError: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.size.meta, lineHeight: 16 },
  useDefaultTime: { minHeight: 40, alignItems: 'flex-end', justifyContent: 'center' },
  useDefaultTimeText: { color: colors.life, fontSize: 10, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.sheet },
  chipActive: { backgroundColor: colors.life },
  chipText: { color: colors.inkSoft, fontSize: 10 },
  chipTextActive: { color: colors.onLife },
  inlineCreate: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  inlineInput: { flex: 1, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink },
  inlineButton: { width: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  inlineButtonText: { color: colors.onLife, fontSize: 10, fontWeight: '700' },
  note: { marginTop: spacing.xl, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  noteText: { color: colors.life, fontSize: 9, lineHeight: 17, textAlign: 'center' },
  dangerZone: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.dangerLine },
  dangerTitle: { color: colors.danger, fontFamily: typography.display, fontSize: 17 },
  dangerHint: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: 10, lineHeight: 17 },
  deleteButton: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.md },
  deletePressed: { opacity: 0.58 },
  deleteText: { color: colors.danger, fontSize: typography.size.meta, fontWeight: '700' },
  missing: { margin: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
}));
