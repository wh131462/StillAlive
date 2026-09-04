import { useState } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { NameStyleId } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { TimePickerField } from '../people/date-time-picker';
import { StyledName } from '../people/styled-name';
import { NAME_STYLE_OPTIONS, THEME_OPTIONS, createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';

export default function SettingsScreen() {
  const router = useRouter();
  const { notificationPermission, openNotificationSettings, persistentNotificationSupported, preferences, retryBirthdayNotifications, retryMemoryNotifications, setBirthdayNotificationsEnabled, setMemoryNotificationsEnabled, setPersistentNotificationsEnabled, updatePreferences } = useAppState();
  const [retryingNotification, setRetryingNotification] = useState<'birthday' | 'memory' | null>(null);
  const [nameStyleTarget, setNameStyleTarget] = useState<'self' | 'friend' | null>(null);
  const showNotificationStatus = preferences.birthdayNotificationsEnabled || preferences.memoryNotificationsEnabled || preferences.persistentNotificationEnabled || Boolean(preferences.birthdayNotificationError) || Boolean(preferences.memoryNotificationError);
  const nameStyleSelection = nameStyleTarget === 'self'
    ? { label: '个人名字', sample: preferences.nickname || preferences.profileName || '我的名字', value: preferences.selfNameStyle }
    : nameStyleTarget === 'friend' ? { label: '朋友名字', sample: '朋友名字', value: preferences.friendNameStyle } : null;

  const savePreference = (changes: Parameters<typeof updatePreferences>[0]) => void updatePreferences(changes).catch((cause: unknown) => feedback.alert('设置失败', errorMessage(cause)));
  const saveNameStyle = (value: NameStyleId) => {
    if (nameStyleTarget === 'self') savePreference({ selfNameStyle: value });
    if (nameStyleTarget === 'friend') savePreference({ friendNameStyle: value });
  };
  const retryNotification = async (kind: 'birthday' | 'memory') => {
    if (retryingNotification) return;
    try {
      setRetryingNotification(kind);
      await (kind === 'birthday' ? retryBirthdayNotifications() : retryMemoryNotifications());
    } catch (cause) {
      feedback.alert('重试失败', errorMessage(cause));
    } finally {
      setRetryingNotification(null);
    }
  };

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="设置" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>APPEARANCE</Text>
      <View style={styles.appearanceGroup}>
        <View style={styles.appearanceSection}>
          <Text style={styles.appearanceTitle}>主题</Text>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map((option) => {
              const selected = preferences.appearanceTheme === option.id;
              return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => savePreference({ appearanceTheme: option.id })} style={({ pressed }) => [styles.themeOption, selected && styles.themeOptionSelected, pressed && styles.pressed]}>
                <View style={[styles.themePreview, { backgroundColor: option.colors.paper }]}><View style={[styles.themePreviewSheet, { backgroundColor: option.colors.sheet }]}><View style={[styles.themePreviewAccent, { backgroundColor: option.colors.life }]} /></View></View>
                <View style={styles.themeOptionMeta}><Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>{option.label}</Text>{selected ? <View style={styles.selectionMark}><SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={11} tintColor={colors.onLife} type="hierarchical" /></View> : null}</View>
                <Text style={styles.themeHint}>{option.hint}</Text>
              </Pressable>;
            })}
          </View>
        </View>
        <View style={styles.separator} />
        <NameStylePreview label="个人名字" onPress={() => setNameStyleTarget('self')} sample={preferences.nickname || preferences.profileName || '我的名字'} value={preferences.selfNameStyle} />
        <View style={styles.separator} />
        <NameStylePreview label="朋友名字" onPress={() => setNameStyleTarget('friend')} sample="朋友名字" value={preferences.friendNameStyle} />
      </View>

      <Text style={styles.eyebrow}>CONTENT</Text>
      <View style={styles.group}>
        <SwitchRow checked={preferences.globalMemoryEnabled} hint="控制那年今日和人物回忆在空间中出现" label="空间回忆" onPress={() => savePreference({ globalMemoryEnabled: !preferences.globalMemoryEnabled })} />
        <View style={styles.separator} />
        <Entry icon="tag" androidIcon="label" label="标签管理" onPress={() => router.push('/tag-management')} />
      </View>

      <Text style={styles.eyebrow}>NOTIFICATIONS</Text>
      <View style={styles.group}>
        {persistentNotificationSupported ? <>
          <SwitchRow checked={preferences.persistentNotificationEnabled} hint="显示打卡状态和快捷入口" label="常驻快捷栏" onPress={() => void setPersistentNotificationsEnabled(!preferences.persistentNotificationEnabled).catch((cause: unknown) => feedback.alert('快捷栏设置失败', errorMessage(cause)))} />
          <View style={styles.separator} />
        </> : null}
        <SwitchRow checked={preferences.birthdayNotificationsEnabled} hint="提前 3 天和生日当天提醒" label="人物生日提醒" onPress={() => void setBirthdayNotificationsEnabled(!preferences.birthdayNotificationsEnabled).catch((cause: unknown) => feedback.alert('提醒设置失败', errorMessage(cause)))} />
        <View style={styles.separator} />
        <SwitchRow checked={preferences.memoryNotificationsEnabled} hint="默认 20:00，提醒间隔至少 7 天" label="回忆通知" onPress={() => void setMemoryNotificationsEnabled(!preferences.memoryNotificationsEnabled).catch((cause: unknown) => feedback.alert('提醒设置失败', errorMessage(cause)))} />
      </View>
      {preferences.birthdayNotificationsEnabled ? <TimePickerField hour={preferences.birthdayReminderHour} label="通用生日提醒时间" minute={preferences.birthdayReminderMinute} onChange={(hour, minute) => savePreference({ birthdayReminderHour: hour, birthdayReminderMinute: minute })} /> : null}
      {showNotificationStatus && notificationPermission === 'denied' ? <Pressable onPress={() => void openNotificationSettings()} style={styles.inlineButton}><Text style={styles.inlineButtonText}>打开系统通知设置</Text></Pressable> : null}
      {preferences.birthdayNotificationError ? <><Pressable disabled={Boolean(retryingNotification)} onPress={() => void retryNotification('birthday')} style={[styles.inlineButton, retryingNotification && styles.disabled]}><Text style={styles.inlineButtonText}>{retryingNotification === 'birthday' ? '重试中…' : '重试通知调度'}</Text></Pressable><Text style={styles.error}>{preferences.birthdayNotificationError}</Text></> : null}
      {preferences.memoryNotificationError ? <><Pressable disabled={Boolean(retryingNotification)} onPress={() => void retryNotification('memory')} style={[styles.inlineButton, retryingNotification && styles.disabled]}><Text style={styles.inlineButtonText}>{retryingNotification === 'memory' ? '重试中…' : '重试回忆通知'}</Text></Pressable><Text style={styles.error}>{preferences.memoryNotificationError}</Text></> : null}

      <Text style={styles.eyebrow}>PERMISSIONS</Text>
      <View style={styles.group}>
        <Entry icon="lock.shield" androidIcon="shield" label="系统权限" hint="查看各权限用途和逐步开启方法" onPress={() => router.push('/permissions' as RelativePathString)} />
      </View>

      <Text style={styles.eyebrow}>DATA</Text>
      <View style={styles.group}>
        <Entry icon="archivebox" androidIcon="inventory_2" label="数据管理" hint="导入备份、导出与清理数据" onPress={() => router.push('/backup')} />
      </View>

      <Text style={styles.eyebrow}>ABOUT</Text>
      <View style={styles.group}>
        <Entry icon="info.circle" androidIcon="info" label="关于仍在" onPress={() => router.push('/about' as RelativePathString)} />
      </View>
    </ScrollView>
    {nameStyleSelection ? <NameStyleCarouselModal name={nameStyleSelection.label} onChange={saveNameStyle} onClose={() => setNameStyleTarget(null)} sample={nameStyleSelection.sample} value={nameStyleSelection.value} /> : null}
  </SafeAreaView>;
}

function Entry({ icon, androidIcon, label, hint, onPress }: { icon: SFSymbol; androidIcon: AndroidSymbol; label: string; hint?: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.entry, !hint && styles.entryCompact, pressed && styles.pressed]}><View style={styles.entryIcon}><SymbolView name={{ android: androidIcon, ios: icon, web: androidIcon }} size={21} tintColor={colors.life} type="hierarchical" /></View><View style={styles.entryCopy}><Text style={styles.entryTitle}>{label}</Text>{hint ? <Text numberOfLines={1} style={styles.entryHint}>{hint}</Text> : null}</View><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>;
}

function SwitchRow({ checked, label, hint, onPress }: { checked: boolean; label: string; hint: string; onPress(): void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={styles.switchRow}><View style={styles.entryCopy}><Text style={styles.entryTitle}>{label}</Text><Text style={styles.entryHint}>{hint}</Text></View><View style={[styles.switchTrack, checked && styles.switchTrackOn]}><View style={[styles.switchThumb, checked && styles.switchThumbOn]} /></View></Pressable>;
}

function NameStylePreview({ label, onPress, sample, value }: { label: string; onPress(): void; sample: string; value: NameStyleId }) {
  const option = NAME_STYLE_OPTIONS.find((item) => item.id === value) ?? NAME_STYLE_OPTIONS[0];
  return <View style={styles.nameStylePreviewRow}>
    <View style={styles.nameStylePreviewCopy}><Text style={styles.nameStylePreviewLabel}>{label}</Text><StyledName numberOfLines={1} style={styles.nameStylePreviewValue} value={sample} variant={value} /><Text style={styles.nameStylePreviewMeta}>{option.label} · {option.hint}</Text></View>
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.nameStyleAction, pressed && styles.pressed]}><Text style={styles.nameStyleActionText}>设置主题</Text><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={16} tintColor={colors.life} type="hierarchical" /></Pressable>
  </View>;
}

function NameStyleCarouselModal({ name, onChange, onClose, sample, value }: { name: string; onChange(value: NameStyleId): void; onClose(): void; sample: string; value: NameStyleId }) {
  return <Modal animationType="fade" onRequestClose={onClose} transparent visible>
    <View style={styles.nameStyleModalBackdrop}>
      <Pressable accessibilityLabel="关闭主题设置" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View accessibilityViewIsModal style={styles.nameStyleModalCard}>
        <View style={styles.nameStyleModalHeader}>
          <View style={styles.nameStyleModalCopy}><Text style={styles.sheetEyebrow}>NAME STYLE</Text><Text style={styles.sheetTitle}>{name}</Text></View>
          <Pressable accessibilityLabel="关闭主题设置" accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.nameStyleClose, pressed && styles.pressed]}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={18} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
        </View>
        <View style={styles.nameStyleSample}><Text style={styles.nameStyleSampleLabel}>当前预览</Text><StyledName style={styles.nameStyleSampleValue} value={sample} variant={value} /></View>
        <NameStyleCarousel onChange={onChange} sample={sample} value={value} />
        <Pressable accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.nameStyleDone, pressed && styles.pressed]}><Text style={styles.nameStyleDoneText}>完成</Text></Pressable>
      </View>
    </View>
  </Modal>;
}

function NameStyleCarousel({ onChange, sample, value }: { onChange(value: NameStyleId): void; sample: string; value: NameStyleId }) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(240, width - spacing.lg * 2);
  const initialIndex = Math.max(0, NAME_STYLE_OPTIONS.findIndex((option) => option.id === value));
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  return <View style={styles.nameStyleCarousel}>
    <FlatList
      data={NAME_STYLE_OPTIONS}
      getItemLayout={(_data, index) => ({ index, length: pageWidth, offset: pageWidth * index })}
      horizontal
      initialScrollIndex={initialIndex}
      keyExtractor={(option) => option.id}
      onMomentumScrollEnd={(event) => {
        const nextIndex = Math.max(0, Math.min(NAME_STYLE_OPTIONS.length - 1, Math.round(event.nativeEvent.contentOffset.x / pageWidth)));
        setCurrentIndex(nextIndex);
        const nextOption = NAME_STYLE_OPTIONS[nextIndex];
        if (nextOption.id !== value) onChange(nextOption.id);
      }}
      pagingEnabled
      renderItem={({ item }) => <View style={[styles.nameStyleCarouselPage, { width: pageWidth }]}><View style={styles.nameStyleCarouselCard}><StyledName style={styles.nameStyleCarouselValue} value={sample} variant={item.id} /><Text style={styles.nameStyleCarouselLabel}>{item.label}</Text><Text style={styles.nameStyleCarouselHint}>{item.hint}</Text></View></View>}
      showsHorizontalScrollIndicator={false}
      style={styles.nameStyleCarouselList}
    />
    <View accessibilityLabel={`${currentIndex + 1} / ${NAME_STYLE_OPTIONS.length}`} accessibilityRole="adjustable" style={styles.nameStyleDots}>{NAME_STYLE_OPTIONS.map((option, index) => <View key={option.id} style={[styles.nameStyleDot, index === currentIndex && styles.nameStyleDotActive]} />)}</View>
  </View>;
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl }, eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  appearanceGroup: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, appearanceSection: { padding: spacing.md }, appearanceTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' }, themeOptions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }, themeOption: { flex: 1, minWidth: 0, minHeight: 112, padding: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md }, themeOptionSelected: { borderColor: colors.life, backgroundColor: colors.lifeLight }, themePreview: { height: 56, padding: 6, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: radius.sm }, themePreviewSheet: { height: 29, padding: 5, justifyContent: 'flex-end', borderTopRightRadius: 9, borderBottomLeftRadius: 9 }, themePreviewAccent: { width: '58%', height: 5, borderRadius: 3 }, themeOptionMeta: { minHeight: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, themeLabel: { flex: 1, marginTop: 5, color: colors.inkSoft, fontSize: 12, fontWeight: '600' }, themeLabelSelected: { color: colors.life }, themeHint: { marginTop: 1, color: colors.inkFaint, fontSize: 10, lineHeight: 13 }, selectionMark: { width: 18, height: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 9, backgroundColor: colors.life },
  nameStylePreviewRow: { minHeight: 82, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, nameStylePreviewCopy: { minWidth: 0, flex: 1 }, nameStylePreviewLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' }, nameStylePreviewValue: { maxWidth: '100%', marginTop: 6, fontSize: 17 }, nameStylePreviewMeta: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta }, nameStyleAction: { minHeight: 36, marginLeft: spacing.sm, paddingHorizontal: spacing.sm, flexDirection: 'row', gap: 3, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.lifeLight }, nameStyleActionText: { color: colors.life, fontSize: typography.size.meta, fontWeight: '800' }, nameStyleModalBackdrop: { flex: 1, padding: spacing.lg, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.backdrop }, nameStyleModalCard: { width: '100%', maxWidth: 420, overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.sheet }, nameStyleModalHeader: { minHeight: 68, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nameStyleModalCopy: { minWidth: 0, flex: 1 }, sheetEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, sheetTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 21 }, nameStyleClose: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.lifeLight }, nameStyleSample: { minHeight: 72, marginHorizontal: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.paper }, nameStyleSampleLabel: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta }, nameStyleSampleValue: { maxWidth: '68%', fontSize: 18, textAlign: 'right' }, nameStyleCarousel: { minHeight: 148, marginTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft, backgroundColor: colors.paper }, nameStyleCarouselList: { width: '100%', minHeight: 126 }, nameStyleCarouselPage: { minHeight: 126, padding: spacing.md, alignItems: 'center', justifyContent: 'center' }, nameStyleCarouselCard: { width: '100%', minHeight: 98, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight }, nameStyleCarouselValue: { maxWidth: '90%', fontSize: 22, textAlign: 'center' }, nameStyleCarouselLabel: { marginTop: 7, color: colors.life, fontSize: typography.size.body, fontWeight: '800' }, nameStyleCarouselHint: { marginTop: 3, color: colors.inkSoft, fontSize: typography.size.meta }, nameStyleDots: { minHeight: 18, flexDirection: 'row', gap: spacing.xs, alignItems: 'center', justifyContent: 'center' }, nameStyleDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.line }, nameStyleDotActive: { width: 16, backgroundColor: colors.life }, nameStyleDone: { minHeight: 44, margin: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, nameStyleDoneText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' },
  group: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md, backgroundColor: colors.line }, entry: { minHeight: 72, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, entryCompact: { minHeight: 64 }, entryIcon: { width: 38, height: 38, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lifeLight }, entryCopy: { flex: 1 }, entryTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' }, entryHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 },
  switchRow: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, switchTrack: { width: 44, height: 26, marginLeft: spacing.md, padding: 2, borderRadius: 13, backgroundColor: colors.line }, switchTrackOn: { backgroundColor: colors.life }, switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper }, switchThumbOn: { alignSelf: 'flex-end' },
  inlineButton: { minHeight: 44, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, inlineButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' }, error: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.size.meta, lineHeight: 17 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
}));
