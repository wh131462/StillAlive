import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Image, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { BirthdayCalendar, Media } from '@still-alive/types';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { useAppState } from '../../application/state/app-state';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import { DatePickerField } from '../people/date-time-picker';
import { GenderPickerField } from '../people/gender-picker';
import { MbtiPickerField } from '../people/mbti-picker';
import type { DateParts } from '../people/date-time-picker';
import { birthdayForCalendar, birthdayFromDateString, constellationForBirthday, zodiacForBirthday } from '../people/person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';

export default function ProfileScreen() {
  const router = useRouter();
  const { createTag, discardMedia, media, preferences, saveMedia, tagDefinitions, tagGroups, tagSystemSettings, updatePreferences } = useAppState();
  const currentAvatar = preferences.profileAvatarMediaId ? media.find((item) => item.id === preferences.profileAvatarMediaId) : null;
  const [nickname, setNickname] = useState(preferences.nickname);
  const [bio, setBio] = useState(preferences.profileBio);
  const [signature, setSignature] = useState(preferences.profileSignature);
  const [gender, setGender] = useState(preferences.profileGender);
  const [birthDate, setBirthDate] = useState(preferences.birthDate);
  const [birthDateCalendar, setBirthDateCalendar] = useState<BirthdayCalendar>(preferences.birthDateCalendar);
  const [birthDateIsLeapMonth, setBirthDateIsLeapMonth] = useState(preferences.birthDateIsLeapMonth);
  const [mbti, setMbti] = useState(preferences.profileMbti);
  const [customTagIds, setCustomTagIds] = useState(preferences.profileCustomTagIds);
  const [newTagName, setNewTagName] = useState('');
  const [pickedAsset, setPickedAsset] = useState<ImagePickerAsset | null>(null);
  const [avatarSourcePickerOpen, setAvatarSourcePickerOpen] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const avatarUri = pickedAsset?.uri ?? currentAvatar?.localPath;
  const birthDateParts: DateParts | null = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? (() => { const [year, month, day] = birthDate.split('-').map(Number); return { year, month, day }; })() : null;
  const profileBirthday = useMemo(() => birthdayFromDateString(birthDate, birthDateCalendar, birthDateIsLeapMonth), [birthDate, birthDateCalendar, birthDateIsLeapMonth]);
  const derivedTags = useMemo(() => {
    if (!profileBirthday) return [];
    try { return [constellationForBirthday(profileBirthday), zodiacForBirthday(profileBirthday)]; } catch { return []; }
  }, [profileBirthday]);

  const changeBirthDateCalendar = (calendar: BirthdayCalendar) => {
    if (calendar === birthDateCalendar) return;
    if (profileBirthday) {
      const converted = birthdayForCalendar(profileBirthday, calendar);
      setBirthDate(`${converted.year}-${String(converted.month).padStart(2, '0')}-${String(converted.day).padStart(2, '0')}`);
      setBirthDateIsLeapMonth(converted.isLeapMonth);
    } else {
      setBirthDateIsLeapMonth(false);
    }
    setBirthDateCalendar(calendar);
  };

  const takeAvatarPhoto = async () => {
    setAvatarSourcePickerOpen(false);
    if (Platform.OS !== 'web' && !await ensureAppPermission('camera')) return;
    const result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    setPickedAsset(result.assets[0]); setAvatarFailed(false);
  };

  const pickAvatarPhoto = async () => {
    setAvatarSourcePickerOpen(false);
    if (Platform.OS !== 'web' && !await ensureAppPermission('photos')) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    setPickedAsset(result.assets[0]); setAvatarFailed(false);
  };

  const save = async () => {
    let importedMedia: Media | null = null;
    try {
      setSaving(true);
      if (birthDate && !profileBirthday) throw new Error('生日日期不存在');
      let avatarMediaId = preferences.profileAvatarMediaId;
      if (pickedAsset) { importedMedia = await persistPickedImage(pickedAsset); await saveMedia(importedMedia); avatarMediaId = importedMedia.id; }
      const previousAvatar = preferences.profileAvatarMediaId;
      await updatePreferences({ nickname: nickname.trim(), profileBio: bio.trim(), profileSignature: signature.trim(), profileGender: gender, birthDate, birthDateCalendar, birthDateIsLeapMonth: birthDateCalendar === 'lunar' && birthDateIsLeapMonth, profileAvatarMediaId: avatarMediaId, profileMbti: mbti, profileCustomTagIds: customTagIds });
      if (previousAvatar && previousAvatar !== avatarMediaId) {
        const previous = media.find((item) => item.id === previousAvatar);
        if (previous) await discardMedia(previous);
      }
      router.back();
    } catch (cause: unknown) {
      if (importedMedia) await discardMedia(importedMedia);
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally { setSaving(false); }
  };

  return <SafeAreaView style={styles.safeArea}><AppKeyboardAvoidingView style={styles.flex}>
    <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderTextAction disabled={saving} label={saving ? '保存中' : '保存'} onPress={() => void save()} />} title="个人信息" />
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Pressable accessibilityHint="可以拍照或从照片中选择" accessibilityLabel={avatarUri ? '更换头像' : '添加头像'} accessibilityRole="button" onPress={() => setAvatarSourcePickerOpen(true)} style={({ pressed }) => [styles.avatarButton, pressed && styles.avatarPressed]}><View style={styles.avatar}>{avatarUri && !avatarFailed ? <Image onError={() => setAvatarFailed(true)} source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{nickname.trim().slice(0, 1) || '我'}</Text>}<View style={styles.cameraBadge}><SymbolView name={{ android: 'photo_camera', ios: 'camera.fill', web: 'photo_camera' }} size={15} tintColor={colors.onLife} type="hierarchical" /></View></View></Pressable>

      <Field label="昵称" maxLength={30} onChangeText={setNickname} placeholder="怎么称呼你" value={nickname} />
      <Field label="个性签名" onChangeText={setSignature} placeholder="写一句此刻想说的话" value={signature} />
      <Field label="简介" multiline onChangeText={setBio} placeholder="写几句话介绍自己" value={bio} />
      <GenderPickerField onChange={setGender} value={gender} />
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>生日历法</Text>
        <View style={styles.segmented}>{(['solar', 'lunar'] as const).map((calendar) => <Pressable key={calendar} accessibilityRole="button" accessibilityState={{ selected: birthDateCalendar === calendar }} onPress={() => changeBirthDateCalendar(calendar)} style={[styles.segment, birthDateCalendar === calendar && styles.segmentActive]}><Text style={[styles.segmentText, birthDateCalendar === calendar && styles.segmentTextActive]}>{calendar === 'solar' ? '公历' : '农历'}</Text></Pressable>)}</View>
      </View>
      <DatePickerField calendar={birthDateCalendar} isLeapMonth={birthDateIsLeapMonth} label={birthDateCalendar === 'solar' ? '公历生日' : '农历生日'} onChange={({ year, month, day }, nextIsLeapMonth) => { setBirthDate(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`); setBirthDateIsLeapMonth(nextIsLeapMonth); }} onClear={() => { setBirthDate(''); setBirthDateIsLeapMonth(false); }} value={birthDateParts} />
      {birthDateParts && derivedTags.length ? <View style={styles.derived}><Text style={styles.derivedLabel}>根据生日</Text><View style={styles.chips}>{derivedTags.map((tag) => <View key={tag} style={styles.derivedChip}><Text style={styles.derivedChipText}>{tag}</Text></View>)}</View></View> : null}

      {tagSystemSettings.find((item) => item.system === 'mbti')?.enabled !== false ? <MbtiPickerField onChange={setMbti} value={mbti} /> : null}
      {tagSystemSettings.find((item) => item.system === 'custom')?.enabled !== false ? <><View style={styles.field}><Text style={styles.fieldLabel}>单条标签 / 可多选</Text><View style={styles.chips}>{tagDefinitions.filter((tag) => !tag.groupId).map((tag) => <Pressable key={tag.id} onPress={() => setCustomTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} style={[styles.chip, customTagIds.includes(tag.id) && styles.chipActive]}><Text style={[styles.chipText, customTagIds.includes(tag.id) && styles.chipTextActive]}>{tag.name}</Text></Pressable>)}</View><View style={styles.inlineCreate}><TextInput maxLength={24} onChangeText={setNewTagName} placeholder="输入新标签" placeholderTextColor={colors.inkFaint} style={styles.inlineInput} value={newTagName} /><Pressable disabled={!newTagName.trim()} onPress={() => void createTag(newTagName).then((tag) => { setCustomTagIds((current) => [...current, tag.id]); setNewTagName(''); }, (cause: unknown) => feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={[styles.inlineButton, !newTagName.trim() && styles.disabled]}><Text style={styles.inlineButtonText}>添加</Text></Pressable></View></View>{tagGroups.map((group) => { const options = tagDefinitions.filter((tag) => tag.groupId === group.id); if (!options.length) return null; return <View key={group.id} style={styles.field}><Text style={styles.fieldLabel}>{group.name} / 单选</Text><View style={styles.chips}>{options.map((option) => <Pressable key={option.id} onPress={() => setCustomTagIds((current) => { const groupOptionIds = options.map((item) => item.id); const withoutGroup = current.filter((id) => !groupOptionIds.includes(id)); return current.includes(option.id) ? withoutGroup : [...withoutGroup, option.id]; })} style={[styles.chip, customTagIds.includes(option.id) && styles.chipActive]}><Text style={[styles.chipText, customTagIds.includes(option.id) && styles.chipTextActive]}>{option.name}</Text></Pressable>)}</View></View>; })}</> : null}
      <Text style={styles.note}>这是你的个人资料，不会出现在人物列表，也不会关联自己的记录。</Text>
    </ScrollView>
    <DraggableBottomSheet accessibilityLabel="选择头像来源，向下拖动关闭" accessibilityRole="menu" onClose={() => setAvatarSourcePickerOpen(false)} open={avatarSourcePickerOpen} sheetStyle={styles.sourceSheet}>
          <AvatarSourceOption label="拍摄" onPress={() => void takeAvatarPhoto()} />
          <AvatarSourceOption label="从手机相册选择" onPress={() => void pickAvatarPhoto()} />
          <Pressable accessibilityRole="button" onPress={() => setAvatarSourcePickerOpen(false)} style={({ pressed }) => [styles.sourceCancel, pressed && styles.sourceOptionPressed]}><Text style={styles.sourceCancelText}>取消</Text></Pressable>
    </DraggableBottomSheet>
  </AppKeyboardAvoidingView></SafeAreaView>;
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor={colors.inkFaint} style={[styles.input, props.multiline && styles.inputMultiline]} textAlignVertical={props.multiline ? 'top' : 'center'} /></View>; }

function AvatarSourceOption({ label, onPress }: { label: string; onPress(): void }) { return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.sourceOption, pressed && styles.sourceOptionPressed]}><Text style={styles.sourceOptionText}>{label}</Text></Pressable>; }

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  avatarButton: { alignItems: 'center' }, avatarPressed: { opacity: 0.72 }, avatar: { width: 104, height: 104, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.sheet, borderRadius: 52, backgroundColor: colors.life }, avatarImage: { width: '100%', height: '100%', borderRadius: 52 }, avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 38 }, cameraBadge: { position: 'absolute', right: 1, bottom: 1, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.paper, borderRadius: 16, backgroundColor: colors.life },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sourceSheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet }, sheetHandle: { width: 38, height: 4, alignSelf: 'center', marginVertical: spacing.md, borderRadius: 2, backgroundColor: colors.line }, sourceOption: { minHeight: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, sourceOptionPressed: { opacity: 0.58 }, sourceOptionText: { color: colors.ink, fontSize: 15, fontWeight: '600' }, sourceCancel: { minHeight: 54, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper }, sourceCancelText: { color: colors.inkSoft, fontSize: 14, fontWeight: '600' },
  field: { marginTop: spacing.lg }, fieldLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 }, input: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 15 }, inputMultiline: { minHeight: 108, paddingTop: spacing.md, lineHeight: 23 }, segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.sheet }, segment: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm }, segmentActive: { backgroundColor: colors.paper }, segmentText: { color: colors.inkFaint, fontSize: 11 }, segmentTextActive: { color: colors.life, fontWeight: '700' }, derived: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.lifeLight }, derivedLabel: { marginBottom: spacing.sm, color: colors.life, fontSize: 9, fontWeight: '700' }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, chip: { minHeight: 34, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.sheet }, chipActive: { backgroundColor: colors.life }, chipText: { color: colors.inkSoft, fontSize: 10 }, chipTextActive: { color: colors.onLife }, derivedChip: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: colors.paper }, derivedChipText: { color: colors.life, fontSize: 10 }, inlineCreate: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }, inlineInput: { flex: 1, minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, inlineButton: { width: 64, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, inlineButtonText: { color: colors.onLife, fontSize: 10, fontWeight: '700' }, disabled: { opacity: 0.4 }, note: { marginTop: spacing.xl, color: colors.inkFaint, fontSize: 9, lineHeight: 17, textAlign: 'center' },
}));
