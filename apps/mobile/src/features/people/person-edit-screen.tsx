import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { useAppState } from '../../application/state/app-state';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import type { Birthday, BirthdayCalendar, Media, PersonContact, PersonImportantDate } from '@still-alive/types';
import { PERSON_CUSTOM_FIELD_VALUE_MAX_LENGTH } from '@still-alive/types';
import { DatePickerField, TimePickerField } from './date-time-picker';
import type { DateParts } from './date-time-picker';
import { GenderPickerField } from './gender-picker';
import { MbtiPickerField } from './mbti-picker';
import { RelationshipPicker } from './relationship-picker';
import { birthdayForCalendar } from './person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';

const CONTACT_TYPE_OPTIONS = ['手机', '微信', 'QQ', '邮箱'] as const;
type CustomFieldDraft = { key: string; value: string };

type PersonEditSnapshotInput = {
  name: string;
  nickname: string;
  bio: string;
  gender: unknown;
  relation: string;
  impression: string;
  contacts: PersonContact[];
  customFields: Array<{ key: string; value: string }>;
  importantDates: PersonImportantDate[];
  privacyMode: unknown;
  birthdayCalendar: BirthdayCalendar;
  birthdayDate: DateParts | null;
  birthdayIsLeapMonth: boolean;
  birthdayReminderEnabled: boolean;
  birthdayReminderHour: number | null;
  birthdayReminderMinute: number | null;
  mbti: string;
  customTagIds: string[];
  pickedAssetUri: string | null;
};

function serializePersonEditSnapshot(value: PersonEditSnapshotInput): string {
  return JSON.stringify({
    ...value,
    contacts: value.contacts.filter(({ type, value: contactValue }) => type || contactValue).map(({ type, value: contactValue }) => ({ type, value: contactValue })),
    customFields: value.customFields.map(({ key, value: fieldValue }) => ({ key, value: fieldValue })),
    customTagIds: [...value.customTagIds].sort(),
  });
}

function ImportantDatePickerField({ value, onChange }: { value: string; onChange(value: string): void }) {
  const hasYear = /^\d{4}-/.test(value);
  const parts = parseImportantDate(value);
  const today = new Date();
  const pickerValue = parts ?? { year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate() };
  return <DatePickerField defaultValue={pickerValue} fieldStyle={styles.importantDateField} formatValue={(next) => formatImportantDate(next, hasYear)} label="日期" maximumDate={new Date(2100, 11, 31)} onChange={(next) => onChange(formatImportantDate(next, hasYear))} value={parts} />;
}

function parseImportantDate(value: string): DateParts | null {
  const match = /^(?:(\d{4})-)?(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  return { year: Number(match[1] ?? 2000), month: Number(match[2]), day: Number(match[3]) };
}

function formatImportantDate(value: DateParts, includeYear: boolean): string {
  const month = String(value.month).padStart(2, '0');
  const day = String(value.day).padStart(2, '0');
  return includeYear ? `${value.year}-${month}-${day}` : `${month}-${day}`;
}

function formatImportantDateDisplay(value: string): string {
  const parts = parseImportantDate(value);
  if (!parts) return '待选择日期';
  return /^\d{4}-/.test(value) ? `${parts.year}年${parts.month}月${parts.day}日` : `${parts.month}月${parts.day}日`;
}

export default function EditPersonScreen() {
  const router = useRouter();
  const navigation = useNavigation();
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
  const [contacts, setContacts] = useState<PersonContact[]>(person?.contacts.length ? person.contacts : [createEmptyContact()]);
  const [customFields, setCustomFields] = useState<Array<{ key: string; value: string }>>(() => Object.entries(person?.customFields ?? {}).map(([key, value]) => ({ key, value })));
  const [importantDates, setImportantDates] = useState<PersonImportantDate[]>(person?.importantDates ?? []);
  const [editingImportantDate, setEditingImportantDate] = useState<PersonImportantDate | null>(null);
  const [editingCustomField, setEditingCustomField] = useState<{ index: number | null; draft: CustomFieldDraft } | null>(null);
  const [privacyMode, setPrivacyMode] = useState(person?.privacyMode ?? 'normal');
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
  const [contactTypePickerId, setContactTypePickerId] = useState<string | null>(null);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const allowExitRef = useRef(false);
 const avatarUri = pickedAsset?.uri ?? currentAvatar?.localPath;
  const globalReminderEnabled = preferences.birthdayNotificationsEnabled;
  const hasCustomReminderTime = birthdayReminderHour !== null && birthdayReminderMinute !== null;
  const effectiveReminderHour = birthdayReminderHour ?? preferences.birthdayReminderHour;
  const effectiveReminderMinute = birthdayReminderMinute ?? preferences.birthdayReminderMinute;
  const currentSnapshot = serializePersonEditSnapshot({ name, nickname, bio, gender, relation, impression, contacts, customFields, importantDates, privacyMode, birthdayCalendar: birthdayDate ? birthdayCalendar : 'solar', birthdayDate, birthdayIsLeapMonth: birthdayDate ? birthdayIsLeapMonth : false, birthdayReminderEnabled: birthdayDate ? birthdayReminderEnabled : true, birthdayReminderHour: birthdayDate ? birthdayReminderHour : null, birthdayReminderMinute: birthdayDate ? birthdayReminderMinute : null, mbti, customTagIds, pickedAssetUri: pickedAsset?.uri ?? null });
  const initialSnapshot = useMemo(() => {
    if (!person) return null;
    const assignments = personTags.filter((item) => item.personId === person.id);
    return serializePersonEditSnapshot({
      name: person.name,
      nickname: person.nickname,
      bio: person.bio ?? '',
      gender: person.gender,
      relation: person.relationToMe ?? '',
      impression: person.impression ?? '',
      contacts: person.contacts.length ? person.contacts : [{ id: '', type: '', value: '' }],
      customFields: Object.entries(person.customFields ?? {}).map(([key, value]) => ({ key, value })),
      importantDates: person.importantDates,
      privacyMode: person.privacyMode,
      birthdayCalendar: person.birthday?.calendar ?? 'solar',
      birthdayDate: person.birthday ? { year: person.birthday.year, month: person.birthday.month, day: person.birthday.day } : null,
      birthdayIsLeapMonth: person.birthday?.isLeapMonth ?? false,
      birthdayReminderEnabled: person.birthday?.reminderEnabled ?? true,
      birthdayReminderHour: person.birthday?.reminderHour ?? null,
      birthdayReminderMinute: person.birthday?.reminderMinute ?? null,
      mbti: assignments.find((item) => item.kind === 'mbti')?.value ?? '',
      customTagIds: assignments.filter((item) => item.kind === 'custom').map((item) => item.value),
      pickedAssetUri: null,
    });
  }, [person, personTags]);
  const dirty = Boolean(initialSnapshot && currentSnapshot !== initialSnapshot);

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
      const filledCustomFields = customFields.filter((item) => item.key.trim() || item.value.trim());
      const customFieldKeys = filledCustomFields.map((item) => item.key.trim());
      if (new Set(customFieldKeys).size !== customFieldKeys.length) throw new Error('自定义资料名称不能重复');
      await updatePerson(person.id, {
        name: name.trim(),
        nickname: nickname.trim(),
        bio: bio.trim(),
        avatarMediaId,
        gender,
        relationToMe: relation.trim() || null,
        impression: impression.trim() || null,
        contacts: contacts.filter((contact) => contact.type.trim() || contact.value.trim()).map((contact) => ({ ...contact, type: contact.type.trim(), value: contact.value.trim() })),
        customFields: Object.fromEntries(filledCustomFields.map((item) => [item.key.trim(), item.value.trim()])),
        importantDates: importantDates.filter((item) => item.name.trim() || item.date.trim()).map((item) => ({ ...item, name: item.name.trim(), date: item.date.trim(), note: item.note?.trim() || null })),
        privacyMode,
        birthday: birthdayDate ? { calendar: birthdayCalendar, ...birthdayDate, isLeapMonth: birthdayCalendar === 'lunar' && birthdayIsLeapMonth, reminderEnabled: birthdayReminderEnabled, reminderHour: birthdayReminderHour, reminderMinute: birthdayReminderMinute, reminderMode: birthdayCalendar } satisfies Birthday : null,
      }, mbti || null, customTagIds);
      allowExitRef.current = true;
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

  useEffect(() => navigation.addListener('beforeRemove', (event) => {
    if (allowExitRef.current) return;
    if (saving) {
      event.preventDefault();
      feedback.alert('正在保存', '请等待保存完成后再离开。');
      return;
    }
    if (!dirty) return;
    event.preventDefault();
    feedback.alert('保存对人物的修改？', '当前页面有尚未保存的填写或删除变更。', [
      { text: '继续编辑', style: 'cancel' },
      { text: '放弃修改', style: 'destructive', onPress: () => { allowExitRef.current = true; navigation.dispatch(event.data.action); } },
      { text: '保存并退出', onPress: () => void handleSave() },
    ]);
  }), [dirty, handleSave, navigation, saving]);

  const handleReminderAction = async () => {
    if (globalReminderEnabled && notificationPermission === 'denied') {
      await openNotificationSettings();
    } else {
      await setBirthdayNotificationsEnabled(true);
    }
  };

  const updateContactType = (contactId: string, type: string) => {
    setContacts((current) => current.map((item) => item.id === contactId ? { ...item, type } : item));
  };

  const openImportantDateEditor = (item?: PersonImportantDate) => {
    setEditingImportantDate(item ? { ...item } : { id: `important_date_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: '', date: '', note: null, reminderEnabled: true });
  };

  const saveImportantDateDraft = () => {
    if (!editingImportantDate || !editingImportantDate.name.trim() || !editingImportantDate.date.trim()) return;
    setImportantDates((current) => current.some((item) => item.id === editingImportantDate.id) ? current.map((item) => item.id === editingImportantDate.id ? editingImportantDate : item) : [...current, editingImportantDate]);
    setEditingImportantDate(null);
  };

  const updateImportantDateDraft = (patch: Partial<PersonImportantDate>) => {
    setEditingImportantDate((current) => current ? { ...current, ...patch } : current);
  };

  const openCustomFieldEditor = (index?: number) => {
    setEditingCustomField({ index: index ?? null, draft: index === undefined ? { key: '', value: '' } : { ...customFields[index] } });
  };

  const updateCustomFieldDraft = (patch: Partial<CustomFieldDraft>) => {
    setEditingCustomField((current) => current ? { ...current, draft: { ...current.draft, ...patch } } : current);
  };

  const saveCustomFieldDraft = () => {
    if (!editingCustomField || (!editingCustomField.draft.key.trim() && !editingCustomField.draft.value.trim())) return;
    const draft = { ...editingCustomField.draft };
    setCustomFields((current) => editingCustomField.index === null ? [...current, draft] : current.map((item, index) => index === editingCustomField.index ? draft : item));
    setEditingCustomField(null);
  };

  const confirmDeleteCustomField = (index: number) => {
    const label = customFields[index]?.key.trim() || '这条自定义资料';
    feedback.alert(`删除${label}？`, '删除后需要点击保存才会生效。', [
      { text: '取消', style: 'cancel' },
      { text: '删除资料', style: 'destructive', onPress: () => setCustomFields((current) => current.filter((_, row) => row !== index)) },
    ]);
  };

  const confirmDeleteImportantDate = (item: PersonImportantDate) => {
    feedback.alert(`删除${item.name.trim() || '这条重要日期'}？`, '删除后需要点击保存才会生效。', [
      { text: '取消', style: 'cancel' },
      { text: '删除日期', style: 'destructive', onPress: () => setImportantDates((current) => current.filter((entry) => entry.id !== item.id)) },
    ]);
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
        <ToolPageHeader backDisabled={saving} onBack={() => router.back()} right={<ToolPageHeaderTextAction disabled={saving} label={saving ? '保存中' : '保存'} onPress={() => void handleSave()} />} title="编辑人物" />
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
          <View style={styles.fieldRow}>
            <Field label="名字 必填" maxLength={40} onChangeText={setName} placeholder="例如：小满" value={name} wrapperStyle={styles.fieldRowItem} />
            <Field label="昵称" maxLength={30} onChangeText={setNickname} placeholder="常用称呼，可选" value={nickname} wrapperStyle={styles.fieldRowItem} />
          </View>
          <GenderPickerField onChange={setGender} value={gender} />
          <RelationshipPicker onChange={setRelation} value={relation} />
          <Field label="一句话印象" maxLength={100} multiline onChangeText={setImpression} placeholder="不必完整，写下此刻最自然的一句话。" value={impression} />
          <Field label="个人简介" maxLength={500} multiline onChangeText={setBio} placeholder="介绍一下这个人，可选" value={bio} />

          <SectionHeader description="可以记录手机号、微信、QQ 或其他联系方式。" index="02" title="联系方式" />
          {contacts.map((contact, index) => {
            const pickerOpen = contactTypePickerId === contact.id;
            const customType = CONTACT_TYPE_OPTIONS.includes(contact.type as typeof CONTACT_TYPE_OPTIONS[number]) ? '' : contact.type;
            return <View key={contact.id} style={styles.contactItem}>
              <View style={styles.contactRow}>
                <Pressable accessibilityLabel={`第 ${index + 1} 个联系方式类型，${contact.type || '未选择'}`} accessibilityRole="button" accessibilityState={{ expanded: pickerOpen }} onPress={() => setContactTypePickerId(pickerOpen ? null : contact.id)} style={({ pressed }) => [styles.contactType, pickerOpen && styles.contactTypeOpen, pressed && styles.contactTypePressed]}>
                  <Text numberOfLines={1} style={[styles.contactTypeText, !contact.type && styles.contactTypePlaceholder]}>{contact.type || '选择类型'}</Text>
                  <SymbolView name={{ android: pickerOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down', ios: pickerOpen ? 'chevron.up' : 'chevron.down', web: pickerOpen ? 'keyboard_arrow_up' : 'keyboard_arrow_down' }} size={17} tintColor={colors.life} type="hierarchical" />
                </Pressable>
                <TextInput accessibilityLabel={`第 ${index + 1} 个联系方式内容`} maxLength={100} onChangeText={(value) => setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, value } : item))} placeholder="输入联系方式" placeholderTextColor={colors.inkFaint} style={[styles.input, styles.contactValue]} value={contact.value} />
                {contacts.length > 1 ? <Pressable accessibilityLabel="删除这个联系方式" onPress={() => setContacts((current) => current.filter((item) => item.id !== contact.id))} style={styles.contactRemove}><SymbolView name={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} size={20} tintColor={colors.danger} type="hierarchical" /></Pressable> : null}
              </View>
              {pickerOpen ? <View style={styles.contactTypeMenu}>
                <Text style={styles.contactTypeMenuLabel}>常用类型</Text>
                <View style={styles.contactTypeOptions}>
                  {CONTACT_TYPE_OPTIONS.map((option) => {
                    const selected = contact.type === option;
                    return <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => { updateContactType(contact.id, option); setContactTypePickerId(null); }} style={({ pressed }) => [styles.contactTypeOption, selected && styles.contactTypeOptionSelected, pressed && styles.contactTypeOptionPressed]}><Text style={[styles.contactTypeOptionText, selected && styles.contactTypeOptionTextSelected]}>{option}</Text></Pressable>;
                  })}
                  <Pressable accessibilityRole="button" onPress={() => { setContacts((current) => current.map((item) => item.id === contact.id ? { ...item, type: '', value: '' } : item)); setContactTypePickerId(null); }} style={({ pressed }) => [styles.contactTypeOption, pressed && styles.contactTypeOptionPressed]}><Text style={styles.contactTypeOptionText}>不填写</Text></Pressable>
                </View>
                <TextInput accessibilityLabel="自定义联系方式类型" maxLength={16} onChangeText={(value) => updateContactType(contact.id, value)} onSubmitEditing={() => setContactTypePickerId(null)} placeholder="自定义类型，例如：工作电话" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.contactTypeCustomInput} value={customType} />
              </View> : null}
            </View>;
          })}
          <Pressable accessibilityRole="button" onPress={() => { const contact = createEmptyContact(); setContacts((current) => [...current, contact]); setContactTypePickerId(contact.id); }} style={styles.addContact}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.addContactText}>添加联系方式</Text></Pressable>

          <SectionHeader description="补充固定资料之外的内容，内容支持长文本。" index="03" title="自定义资料" />
          {customFields.length ? <View style={styles.customFieldList}>
            {customFields.map((item, index) => <View key={`custom-${index}`}>
              {index > 0 ? <View style={styles.customFieldListDivider} /> : null}
              <View style={styles.customFieldListRow}>
                <View style={styles.customFieldListCopy}>
                  <Text numberOfLines={1} style={styles.customFieldListKey}>{item.key || '未命名资料'}</Text>
                  <Text numberOfLines={2} style={styles.customFieldListValue}>{item.value || '未填写内容'}</Text>
                </View>
                <Pressable accessibilityLabel={`编辑第 ${index + 1} 个自定义资料`} accessibilityRole="button" onPress={() => openCustomFieldEditor(index)} style={({ pressed }) => [styles.importantDateListAction, styles.importantDateListEdit, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable>
                <Pressable accessibilityLabel={`删除第 ${index + 1} 个自定义资料`} accessibilityRole="button" onPress={() => confirmDeleteCustomField(index)} style={({ pressed }) => [styles.importantDateListAction, styles.importantDateListDelete, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={17} tintColor={colors.danger} type="hierarchical" /></Pressable>
              </View>
            </View>)}
          </View> : <Text style={styles.customFieldEmpty}>还没有添加自定义资料</Text>}
          <Pressable accessibilityRole="button" onPress={() => openCustomFieldEditor()} style={({ pressed }) => [styles.dateAddButton, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.dateAddButtonText}>添加资料字段</Text></Pressable>

          <SectionHeader description="记录值得记住的日子，便于日后回顾和提醒。" index="04" title="重要日期" />
          {importantDates.length ? <View style={styles.importantDateList}>
            {importantDates.map((item, index) => {
              const parts = parseImportantDate(item.date);
              return <View key={item.id}>
                {index > 0 ? <View style={styles.importantDateListDivider} /> : null}
                <View style={styles.importantDateListRow}>
                  <View style={styles.importantDateListMarker}>
                    {parts ? <><Text style={styles.importantDateListMonth}>{parts.month}月</Text><Text style={styles.importantDateListDay}>{parts.day}</Text></> : <SymbolView name={{ android: 'event', ios: 'calendar', web: 'event' }} size={18} tintColor={colors.life} type="hierarchical" />}
                  </View>
                  <View style={styles.importantDateListCopy}>
                    <Text numberOfLines={1} style={styles.importantDateListName}>{item.name || '未命名日期'}</Text>
                    <View style={styles.importantDateListMeta}><Text style={styles.importantDateListValue}>{formatImportantDateDisplay(item.date)}</Text><Text style={[styles.importantDateListReminder, !item.reminderEnabled && styles.importantDateListReminderOff]}>{item.reminderEnabled ? '年度提醒' : '不提醒'}</Text></View>
                    {item.note ? <Text numberOfLines={1} style={styles.importantDateListNote}>{item.note}</Text> : null}
                  </View>
                  <Pressable accessibilityLabel={`编辑第 ${index + 1} 个重要日期`} accessibilityRole="button" onPress={() => openImportantDateEditor(item)} style={({ pressed }) => [styles.importantDateListAction, styles.importantDateListEdit, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable>
                  <Pressable accessibilityLabel={`删除第 ${index + 1} 个重要日期`} accessibilityRole="button" onPress={() => confirmDeleteImportantDate(item)} style={({ pressed }) => [styles.importantDateListAction, styles.importantDateListDelete, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={17} tintColor={colors.danger} type="hierarchical" /></Pressable>
                </View>
              </View>;
            })}
          </View> : <Text style={styles.importantDateEmpty}>还没有添加重要日期</Text>}
          <Pressable accessibilityRole="button" onPress={() => openImportantDateEditor()} style={({ pressed }) => [styles.dateAddButton, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.dateAddButtonText}>添加重要日期</Text></Pressable>

          <SectionHeader description="选择生日历法和日期，提醒会按该历法计算。" index="03" title="生日与提醒" />
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

          <SectionHeader description="用 MBTI 和自定义标签，更快找到关于 ta 的记录。" index="05" title="人物标签" />
          {tagSystemSettings.find((item) => item.system === 'mbti')?.enabled !== false ? <MbtiPickerField onChange={setMbti} value={mbti} /> : null}
          {tagSystemSettings.find((item) => item.system === 'custom')?.enabled !== false ? <><View style={styles.field}><Text style={styles.fieldLabel}>单条标签 / 可多选</Text><View style={styles.chips}>{tagDefinitions.filter((tag) => !tag.groupId).map((tag) => <Pressable key={tag.id} onPress={() => setCustomTagIds((current) => current.includes(tag.id) ? current.filter((id) => id !== tag.id) : [...current, tag.id])} style={[styles.chip, customTagIds.includes(tag.id) && styles.chipActive]}><Text style={[styles.chipText, customTagIds.includes(tag.id) && styles.chipTextActive]}>{tag.name}</Text></Pressable>)}</View><View style={styles.inlineCreate}><TextInput maxLength={24} onChangeText={setNewTagName} placeholder="输入新标签" placeholderTextColor={colors.inkFaint} style={styles.inlineInput} value={newTagName} /><Pressable onPress={() => void createTag(newTagName).then((tag) => { setCustomTagIds((current) => [...current, tag.id]); setNewTagName(''); }, (cause: unknown) => feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={styles.inlineButton}><Text style={styles.inlineButtonText}>添加</Text></Pressable></View></View>{tagGroups.map((group) => { const options = tagDefinitions.filter((tag) => tag.groupId === group.id); if (!options.length) return null; return <View key={group.id} style={styles.field}><Text style={styles.fieldLabel}>{group.name} / 单选</Text><View style={styles.chips}>{options.map((option) => <Pressable key={option.id} onPress={() => setCustomTagIds((current) => { const groupOptionIds = options.map((item) => item.id); const withoutGroup = current.filter((id) => !groupOptionIds.includes(id)); return current.includes(option.id) ? withoutGroup : [...withoutGroup, option.id]; })} style={[styles.chip, customTagIds.includes(option.id) && styles.chipActive]}><Text style={[styles.chipText, customTagIds.includes(option.id) && styles.chipTextActive]}>{option.name}</Text></Pressable>)}</View></View>; })}</> : null}
          <View style={styles.privacyCard}>
            <View style={styles.privacyCardHeader}>
              <View style={styles.reminderCopy}><Text style={styles.reminderTitle}>人物隐私</Text><Text style={styles.reminderStatus}>{privacyMode === 'private' ? '详情页默认隐藏联系方式、自定义资料和重要日期' : '资料正常展示'}</Text></View>
              <Pressable accessibilityRole="switch" accessibilityState={{ checked: privacyMode === 'private' }} onPress={() => setPrivacyMode((value) => value === 'private' ? 'normal' : 'private')} style={[styles.switchTrack, privacyMode === 'private' && styles.switchTrackOn]}><View style={[styles.switchThumb, privacyMode === 'private' && styles.switchThumbOn]} /></Pressable>
            </View>
          </View>
          <View style={styles.dangerZone}>
            <View style={styles.dangerHeader}>
              <View style={styles.dangerIcon}><SymbolView name={{ android: 'warning', ios: 'exclamationmark.triangle', web: 'warning' }} size={17} tintColor={colors.danger} type="hierarchical" /></View>
              <View style={styles.dangerCopy}><Text style={styles.dangerTitle}>危险操作</Text><Text style={styles.dangerHint}>删除人物不会删除历史记录，但会永久删除其相册及其中媒体。</Text></View>
            </View>
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={({ pressed }) => [styles.deleteButton, pressed && styles.deletePressed]}>
              <SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={17} tintColor={colors.danger} type="hierarchical" />
              <Text style={styles.deleteText}>删除这个人物</Text>
            </Pressable>
          </View>
        </ScrollView>
        <DraggableBottomSheet accessibilityLabel="编辑重要日期，向下拖动关闭" keyboardAvoiding onClose={() => setEditingImportantDate(null)} open={Boolean(editingImportantDate)} sheetStyle={styles.importantDateSheet}>
          {editingImportantDate ? <>
            <View style={styles.importantDateSheetHeader}>
              <View><Text style={styles.importantDateSheetEyebrow}>重要日期</Text><Text style={styles.importantDateSheetTitle}>{importantDates.some((item) => item.id === editingImportantDate.id) ? '编辑日期' : '新增日期'}</Text></View>
              <Pressable accessibilityLabel="关闭重要日期编辑" accessibilityRole="button" onPress={() => setEditingImportantDate(null)} style={({ pressed }) => [styles.importantDateSheetClose, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={19} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
            </View>
            <Text style={styles.importantDateModalLabel}>日期名称</Text>
            <TextInput autoFocus={!importantDates.some((item) => item.id === editingImportantDate.id)} maxLength={30} onChangeText={(value) => updateImportantDateDraft({ name: value })} placeholder="例如：认识日" placeholderTextColor={colors.inkFaint} style={styles.input} value={editingImportantDate.name} />
            <ImportantDatePickerField value={editingImportantDate.date} onChange={(value) => updateImportantDateDraft({ date: value })} />
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: editingImportantDate.reminderEnabled }} onPress={() => updateImportantDateDraft({ reminderEnabled: !editingImportantDate.reminderEnabled })} style={({ pressed }) => [styles.dateReminderRow, pressed && styles.importantDateListActionPressed]}>
              <View style={styles.dateReminderCopy}><Text style={styles.dateReminderLabel}>年度提醒</Text><Text style={styles.dateReminderHint}>{editingImportantDate.reminderEnabled ? '每年自动提醒一次' : '已关闭年度提醒'}</Text></View>
              <View style={[styles.switchTrack, editingImportantDate.reminderEnabled && styles.switchTrackOn]}><View style={[styles.switchThumb, editingImportantDate.reminderEnabled && styles.switchThumbOn]} /></View>
            </Pressable>
            <Text style={styles.importantDateModalLabel}>备注</Text>
            <TextInput maxLength={100} multiline onChangeText={(value) => updateImportantDateDraft({ note: value || null })} placeholder="补充一点说明（可选）" placeholderTextColor={colors.inkFaint} style={[styles.input, styles.importantDateModalNote]} textAlignVertical="top" value={editingImportantDate.note ?? ''} />
            <Pressable accessibilityRole="button" disabled={!editingImportantDate.name.trim() || !editingImportantDate.date.trim()} onPress={saveImportantDateDraft} style={[styles.importantDateSaveButton, (!editingImportantDate.name.trim() || !editingImportantDate.date.trim()) && styles.importantDateSaveDisabled]}><Text style={styles.importantDateSaveButtonText}>保存日期</Text></Pressable>
          </> : null}
        </DraggableBottomSheet>
        <DraggableBottomSheet accessibilityLabel="编辑自定义资料，向下拖动关闭" keyboardAvoiding onClose={() => setEditingCustomField(null)} open={Boolean(editingCustomField)} sheetStyle={styles.importantDateSheet}>
          {editingCustomField ? <>
            <View style={styles.importantDateSheetHeader}>
              <View><Text style={styles.importantDateSheetEyebrow}>自定义资料</Text><Text style={styles.importantDateSheetTitle}>{editingCustomField.index === null ? '新增资料' : '编辑资料'}</Text></View>
              <Pressable accessibilityLabel="关闭自定义资料编辑" accessibilityRole="button" onPress={() => setEditingCustomField(null)} style={({ pressed }) => [styles.importantDateSheetClose, pressed && styles.importantDateListActionPressed]}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={19} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
            </View>
            <Text style={styles.importantDateModalLabel}>资料名称</Text>
            <TextInput autoFocus={editingCustomField.index === null} maxLength={20} onChangeText={(value) => updateCustomFieldDraft({ key: value })} placeholder="例如：外号" placeholderTextColor={colors.inkFaint} style={styles.input} value={editingCustomField.draft.key} />
            <Text style={styles.importantDateModalLabel}>资料内容</Text>
            <TextInput accessibilityLabel="自定义资料内容" maxLength={PERSON_CUSTOM_FIELD_VALUE_MAX_LENGTH} multiline onChangeText={(value) => updateCustomFieldDraft({ value })} placeholder="例如：小笨蛋 / 喜欢拿铁" placeholderTextColor={colors.inkFaint} scrollEnabled style={[styles.input, styles.customFieldModalValue]} textAlignVertical="top" value={editingCustomField.draft.value} />
            <Pressable accessibilityRole="button" disabled={!editingCustomField.draft.key.trim() && !editingCustomField.draft.value.trim()} onPress={saveCustomFieldDraft} style={[styles.importantDateSaveButton, (!editingCustomField.draft.key.trim() && !editingCustomField.draft.value.trim()) && styles.importantDateSaveDisabled]}><Text style={styles.importantDateSaveButtonText}>保存资料</Text></Pressable>
          </> : null}
        </DraggableBottomSheet>
        <DraggableBottomSheet accessibilityLabel="选择头像来源，向下拖动关闭" accessibilityRole="menu" onClose={() => setAvatarSourcePickerOpen(false)} open={avatarSourcePickerOpen} sheetStyle={styles.sourceSheet}>
              <AvatarSourceOption label="拍摄" onPress={() => void takeAvatarPhoto()} />
              <AvatarSourceOption label="从手机相册选择" onPress={() => void pickAvatarPhoto()} />
              <Pressable accessibilityRole="button" onPress={() => setAvatarSourcePickerOpen(false)} style={styles.sourceCancel}><Text style={styles.sourceCancelText}>取消</Text></Pressable>
        </DraggableBottomSheet>
      </AppKeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createEmptyContact(): PersonContact {
  return { id: `contact_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, type: '', value: '' };
}

function Field({ label, wrapperStyle, ...props }: { label: string; wrapperStyle?: StyleProp<ViewStyle> } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={[styles.field, wrapperStyle]}>
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
  avatarCard: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet },
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
  sectionHeader: { marginTop: spacing.xl, paddingTop: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  sectionIndex: { width: 30, height: 24, paddingTop: 0, borderRadius: radius.sm, backgroundColor: colors.lifeLight, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1, lineHeight: 24, textAlign: 'center', textAlignVertical: 'center' },
  sectionCopy: { flex: 1 },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 21, letterSpacing: -0.2 },
  sectionDescription: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  field: { marginTop: spacing.lg },
  fieldRow: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  fieldRowItem: { flex: 1, marginTop: 0 },
  fieldLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 52, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 15 },
  contactItem: { marginTop: spacing.sm },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contactType: { width: 112, minHeight: 52, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet },
  contactTypeOpen: { borderColor: colors.lifeLine },
  contactTypePressed: { opacity: 0.72 },
  contactTypeText: { minWidth: 0, flex: 1, color: colors.ink, fontSize: 14 },
  contactTypePlaceholder: { color: colors.inkFaint },
  contactValue: { minWidth: 0, flex: 1 },
  contactRemove: { width: 34, height: 52, alignItems: 'center', justifyContent: 'center' },
  contactTypeMenu: { marginTop: spacing.sm, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.sheet },
  contactTypeMenuLabel: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  contactTypeOptions: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  contactTypeOption: { minHeight: 34, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: 17, backgroundColor: colors.paper },
  contactTypeOptionSelected: { borderColor: colors.life, backgroundColor: colors.life },
  contactTypeOptionPressed: { opacity: 0.72 },
  contactTypeOptionText: { color: colors.inkSoft, fontSize: 11 },
  contactTypeOptionTextSelected: { color: colors.onLife, fontWeight: '700' },
  contactTypeCustomInput: { minHeight: 44, marginTop: spacing.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 13 },
  customFieldList: { marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  customFieldListRow: { minHeight: 68, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  customFieldListDivider: { marginLeft: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  customFieldListCopy: { minWidth: 0, flex: 1 },
  customFieldListKey: { color: colors.ink, fontFamily: typography.display, fontSize: 14, lineHeight: 18 },
  customFieldListValue: { marginTop: 3, color: colors.inkSoft, fontSize: 11, lineHeight: 16 },
  customFieldEmpty: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 11 },
  customFieldModalValue: { minHeight: 112, paddingTop: spacing.md, lineHeight: 22 },
  importantDateList: { marginTop: spacing.md, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  importantDateListRow: { minHeight: 74, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  importantDateListDivider: { marginLeft: spacing.md + 40 + spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  importantDateListMarker: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 11, backgroundColor: colors.lifeLight },
  importantDateListMonth: { color: colors.life, fontFamily: typography.mono, fontSize: 7, letterSpacing: 0.5 },
  importantDateListDay: { marginTop: 1, color: colors.life, fontFamily: typography.display, fontSize: 16, lineHeight: 18 },
  importantDateListCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  importantDateListName: { color: colors.ink, fontFamily: typography.display, fontSize: 14, lineHeight: 18 },
  importantDateListMeta: { marginTop: 3, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  importantDateListValue: { color: colors.inkSoft, fontFamily: typography.mono, fontSize: 9 },
  importantDateListReminder: { color: colors.life, fontSize: 8 },
  importantDateListReminderOff: { color: colors.inkFaint },
  importantDateListNote: { marginTop: 3, color: colors.inkFaint, fontSize: 9, lineHeight: 14 },
  importantDateListAction: { width: 36, height: 40, marginLeft: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  importantDateListEdit: { backgroundColor: colors.lifeLight },
  importantDateListDelete: { backgroundColor: colors.dangerLight },
  importantDateListActionPressed: { opacity: 0.62 },
  importantDateEmpty: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 11 },
  dateAddButton: { minHeight: 48, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  dateAddButtonText: { color: colors.life, fontSize: 13, fontWeight: '700' },
  importantDateField: { marginTop: spacing.md },
  dateReminderRow: { minHeight: 58, marginTop: spacing.md, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft },
  dateReminderCopy: { flex: 1, paddingRight: spacing.md },
  dateReminderLabel: { color: colors.ink, fontSize: 12, fontWeight: '600' },
  dateReminderHint: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  importantDateSheet: { maxHeight: '92%', paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  importantDateSheetHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  importantDateSheetEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  importantDateSheetTitle: { marginTop: spacing.xs, color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  importantDateSheetClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.paper },
  importantDateModalLabel: { marginTop: spacing.md, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  importantDateModalNote: { minHeight: 80, paddingTop: spacing.md, lineHeight: 21 },
  importantDateSaveButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  importantDateSaveButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '800' },
  importantDateSaveDisabled: { opacity: 0.45 },
  addContact: { minHeight: 44, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  addContactText: { color: colors.life, fontSize: 13, fontWeight: '700' },
  inputMultiline: { minHeight: 96, paddingTop: spacing.md, lineHeight: 23 },
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
  privacyCard: { marginTop: spacing.xl, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet },
  privacyCardHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dangerZone: { marginTop: spacing.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.lg, backgroundColor: colors.dangerLight },
  dangerHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  dangerIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.paper },
  dangerCopy: { minWidth: 0, flex: 1, marginLeft: spacing.sm },
  dangerTitle: { color: colors.danger, fontFamily: typography.display, fontSize: 17 },
  dangerHint: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: 10, lineHeight: 17 },
  deleteButton: { minHeight: 48, marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine, borderRadius: radius.md, backgroundColor: colors.paper },
  deletePressed: { opacity: 0.58 },
  deleteText: { color: colors.danger, fontSize: typography.size.meta, fontWeight: '700' },
  missing: { margin: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
}));
