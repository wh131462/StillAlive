import { useState } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { NameStyleId } from '@still-alive/types';
import { useAppState } from '../src/state/app-state';
import { TimePickerField } from '../src/components/date-time-picker';
import { StyledName } from '../src/components/styled-name';
import { NAME_STYLE_OPTIONS, THEME_OPTIONS, createThemedStyles } from '../src/theme/app-theme';
import { openAppSettings } from '../src/data/app-permissions';

export default function SettingsScreen() {
  const router = useRouter();
  const { notificationPermission, openNotificationSettings, persistentNotificationRunning, persistentNotificationSupported, preferences, retryBirthdayNotifications, retryMemoryNotifications, setBirthdayNotificationsEnabled, setMemoryNotificationsEnabled, setPersistentNotificationsEnabled, updatePreferences } = useAppState();
  const [retryingNotification, setRetryingNotification] = useState<'birthday' | 'memory' | null>(null);
  const showNotificationStatus = preferences.birthdayNotificationsEnabled || preferences.memoryNotificationsEnabled || preferences.persistentNotificationEnabled || Boolean(preferences.birthdayNotificationError) || Boolean(preferences.memoryNotificationError);

  const savePreference = (changes: Parameters<typeof updatePreferences>[0]) => void updatePreferences(changes).catch((cause: unknown) => Alert.alert('设置失败', errorMessage(cause)));
  const retryNotification = async (kind: 'birthday' | 'memory') => {
    if (retryingNotification) return;
    try {
      setRetryingNotification(kind);
      await (kind === 'birthday' ? retryBirthdayNotifications() : retryMemoryNotifications());
    } catch (cause) {
      Alert.alert('重试失败', errorMessage(cause));
    } finally {
      setRetryingNotification(null);
    }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      <Text style={styles.headerTitle}>设置</Text><View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>APPEARANCE</Text>
      <View style={styles.appearanceGroup}>
        <View style={styles.appearanceSection}>
          <Text style={styles.appearanceTitle}>主题</Text>
          <View style={styles.themeOptions}>
            {THEME_OPTIONS.map((option) => {
              const selected = preferences.appearanceTheme === option.id;
              return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => savePreference({ appearanceTheme: option.id })} style={[styles.themeOption, selected && styles.themeOptionSelected]}>
                <View style={[styles.themePreview, { backgroundColor: option.colors.paper }]}><View style={[styles.themePreviewSheet, { backgroundColor: option.colors.sheet }]}><View style={[styles.themePreviewAccent, { backgroundColor: option.colors.life }]} /></View></View>
                <Text style={[styles.themeLabel, selected && styles.themeLabelSelected]}>{option.label}</Text>
                <Text style={styles.themeHint}>{option.hint}</Text>
              </Pressable>;
            })}
          </View>
        </View>
        <View style={styles.separator} />
        <NameStylePicker includePersonalOnly label="个人名字" onChange={(value) => savePreference({ selfNameStyle: value })} sample={preferences.nickname || '我的名字'} value={preferences.selfNameStyle} />
        <View style={styles.separator} />
        <NameStylePicker label="朋友名字" onChange={(value) => savePreference({ friendNameStyle: value })} sample="朋友名字" value={preferences.friendNameStyle} />
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
          <SwitchRow checked={preferences.persistentNotificationEnabled} hint="显示打卡状态和快捷入口" label="常驻快捷栏" onPress={() => void setPersistentNotificationsEnabled(!preferences.persistentNotificationEnabled).catch((cause: unknown) => Alert.alert('快捷栏设置失败', errorMessage(cause)))} />
          <View style={styles.separator} />
        </> : null}
        <SwitchRow checked={preferences.birthdayNotificationsEnabled} hint="提前 3 天和生日当天提醒" label="人物生日提醒" onPress={() => void setBirthdayNotificationsEnabled(!preferences.birthdayNotificationsEnabled).catch((cause: unknown) => Alert.alert('提醒设置失败', errorMessage(cause)))} />
        <View style={styles.separator} />
        <SwitchRow checked={preferences.memoryNotificationsEnabled} hint="默认 20:00，提醒间隔至少 7 天" label="回忆通知" onPress={() => void setMemoryNotificationsEnabled(!preferences.memoryNotificationsEnabled).catch((cause: unknown) => Alert.alert('提醒设置失败', errorMessage(cause)))} />
      </View>
      {preferences.birthdayNotificationsEnabled ? <TimePickerField hour={preferences.birthdayReminderHour} label="通用生日提醒时间" minute={preferences.birthdayReminderMinute} onChange={(hour, minute) => savePreference({ birthdayReminderHour: hour, birthdayReminderMinute: minute })} /> : null}
      {showNotificationStatus ? <Text style={styles.permissionState}>系统权限 {notificationPermission === 'granted' ? '已允许' : notificationPermission === 'denied' ? '未允许' : '尚未询问'}</Text> : null}
      {preferences.persistentNotificationEnabled ? <Text style={styles.permissionState}>常驻服务 {persistentNotificationRunning ? '正在运行' : '等待系统启动'}</Text> : null}
      {showNotificationStatus && notificationPermission === 'denied' ? <Pressable onPress={() => void openNotificationSettings()} style={styles.inlineButton}><Text style={styles.inlineButtonText}>打开系统通知设置</Text></Pressable> : null}
      {preferences.birthdayNotificationError ? <><Pressable disabled={Boolean(retryingNotification)} onPress={() => void retryNotification('birthday')} style={[styles.inlineButton, retryingNotification && styles.disabled]}><Text style={styles.inlineButtonText}>{retryingNotification === 'birthday' ? '重试中…' : '重试通知调度'}</Text></Pressable><Text style={styles.error}>{preferences.birthdayNotificationError}</Text></> : null}
      {preferences.memoryNotificationError ? <><Pressable disabled={Boolean(retryingNotification)} onPress={() => void retryNotification('memory')} style={[styles.inlineButton, retryingNotification && styles.disabled]}><Text style={styles.inlineButtonText}>{retryingNotification === 'memory' ? '重试中…' : '重试回忆通知'}</Text></Pressable><Text style={styles.error}>{preferences.memoryNotificationError}</Text></> : null}

      <Text style={styles.eyebrow}>PERMISSIONS</Text>
      <View style={styles.group}>
        <Entry icon="lock.shield" androidIcon="shield" label="系统权限" hint="通知、位置、相机、照片与麦克风可在系统中统一管理" onPress={() => void openAppSettings()} />
      </View>

      <Text style={styles.eyebrow}>DATA</Text>
      <View style={styles.group}>
        <Entry icon="archivebox" androidIcon="inventory_2" label="数据管理" onPress={() => router.push('/backup')} />
      </View>

      <Text style={styles.eyebrow}>ABOUT</Text>
      <View style={styles.group}>
        <Entry icon="info.circle" androidIcon="info" label="关于仍在" onPress={() => router.push('/about' as RelativePathString)} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function Entry({ icon, androidIcon, label, hint, onPress }: { icon: SFSymbol; androidIcon: AndroidSymbol; label: string; hint?: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.entry, !hint && styles.entryCompact, pressed && styles.pressed]}><View style={styles.entryIcon}><SymbolView name={{ android: androidIcon, ios: icon, web: androidIcon }} size={21} tintColor={colors.life} type="hierarchical" /></View><View style={styles.entryCopy}><Text style={styles.entryTitle}>{label}</Text>{hint ? <Text numberOfLines={1} style={styles.entryHint}>{hint}</Text> : null}</View><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>;
}

function SwitchRow({ checked, label, hint, onPress }: { checked: boolean; label: string; hint: string; onPress(): void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={styles.switchRow}><View style={styles.entryCopy}><Text style={styles.entryTitle}>{label}</Text><Text style={styles.entryHint}>{hint}</Text></View><View style={[styles.switchTrack, checked && styles.switchTrackOn]}><View style={[styles.switchThumb, checked && styles.switchThumbOn]} /></View></Pressable>;
}

function NameStylePicker({ includePersonalOnly = false, label, onChange, sample, value }: { includePersonalOnly?: boolean; label: string; onChange(value: NameStyleId): void; sample: string; value: NameStyleId }) {
  const options = NAME_STYLE_OPTIONS.filter((option) => includePersonalOnly || !option.personalOnly);
  return <View style={styles.nameStyleSection}>
    <Text style={styles.appearanceTitle}>{label}</Text>
    <ScrollView horizontal contentContainerStyle={styles.nameStyleOptions} showsHorizontalScrollIndicator={false}>
      {options.map((option) => {
        const selected = value === option.id;
        return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => onChange(option.id)} style={[styles.nameStyleOption, selected && styles.nameStyleOptionSelected]}>
          <StyledName numberOfLines={1} style={styles.nameStylePreview} value={sample} variant={option.id} />
          <Text style={[styles.nameStyleLabel, selected && styles.nameStyleLabelSelected]}>{option.label}</Text>
        </Pressable>;
      })}
    </ScrollView>
  </View>;
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl }, eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  appearanceGroup: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, appearanceSection: { padding: spacing.md }, appearanceTitle: { color: colors.ink, fontSize: 13, fontWeight: '700' }, themeOptions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm }, themeOption: { flex: 1, minWidth: 0, padding: 7, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md }, themeOptionSelected: { borderColor: colors.life, backgroundColor: colors.lifeLight }, themePreview: { height: 48, padding: 6, justifyContent: 'flex-end', overflow: 'hidden', borderRadius: radius.sm }, themePreviewSheet: { height: 25, padding: 5, justifyContent: 'flex-end', borderTopRightRadius: 9, borderBottomLeftRadius: 9 }, themePreviewAccent: { width: '58%', height: 5, borderRadius: 3 }, themeLabel: { marginTop: 7, color: colors.inkSoft, fontSize: 11, fontWeight: '600' }, themeLabelSelected: { color: colors.life }, themeHint: { marginTop: 2, color: colors.inkFaint, fontSize: 8 },
  nameStyleSection: { padding: spacing.md }, nameStyleOptions: { marginTop: spacing.md, gap: spacing.sm }, nameStyleOption: { width: 96, minHeight: 70, paddingHorizontal: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper }, nameStyleOptionSelected: { borderColor: colors.life, backgroundColor: colors.lifeLight }, nameStylePreview: { maxWidth: '100%', fontSize: 14 }, nameStyleLabel: { marginTop: 7, color: colors.inkFaint, fontSize: 9 }, nameStyleLabelSelected: { color: colors.life, fontWeight: '700' },
  group: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md, backgroundColor: colors.line }, entry: { minHeight: 72, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, entryCompact: { minHeight: 64 }, entryIcon: { width: 38, height: 38, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lifeLight }, entryCopy: { flex: 1 }, entryTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' }, entryHint: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 },
  switchRow: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, switchTrack: { width: 44, height: 26, marginLeft: spacing.md, padding: 2, borderRadius: 13, backgroundColor: colors.line }, switchTrackOn: { backgroundColor: colors.life }, switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper }, switchThumbOn: { alignSelf: 'flex-end' },
  permissionState: { marginTop: spacing.md, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta }, inlineButton: { minHeight: 44, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, inlineButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' }, error: { marginTop: spacing.sm, color: colors.danger, fontSize: typography.size.meta, lineHeight: 17 },
  disabled: { opacity: 0.55 },
  pressed: { opacity: 0.7 },
}));
