import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../src/state/app-state';
import { TimePickerField } from '../src/components/date-time-picker';

export default function SettingsScreen() {
  const router = useRouter();
  const { deleteAllLocalData, notificationPermission, openNotificationSettings, preferences, retryBirthdayNotifications, retryMemoryNotifications, setBirthdayNotificationsEnabled, setMemoryNotificationsEnabled, updatePreferences } = useAppState();

  const savePreference = (changes: Parameters<typeof updatePreferences>[0]) => void updatePreferences(changes).catch((cause: unknown) => Alert.alert('设置失败', errorMessage(cause)));
  const confirmDeleteAll = () => {
    Alert.alert('删除这台设备上的全部内容？', '日记、草稿、人物、图片和设置都会被真实删除。之前导出的备份文件不会被删除。', [
      { text: '取消', style: 'cancel' },
      { text: '继续', onPress: () => Alert.alert('最后确认', '这个操作无法撤销。确定清空“仍在”的全部本地数据吗？', [
        { text: '保留数据', style: 'cancel' },
        { text: '全部删除', style: 'destructive', onPress: () => void deleteAllLocalData().then(() => router.replace('/'), (cause: unknown) => Alert.alert('删除失败', errorMessage(cause))) },
      ]) },
    ]);
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      <Text style={styles.headerTitle}>设置</Text><View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <Text style={styles.eyebrow}>ORGANIZE</Text>
      <View style={styles.group}>
        <Entry icon="tag" androidIcon="label" label="标签管理" hint="标签集合、排序与自定义标签" onPress={() => router.push('/tag-management')} />
      </View>

      <Text style={styles.eyebrow}>DATA</Text>
      <View style={styles.group}>
        <Entry icon="archivebox" androidIcon="inventory_2" label="备份与恢复" hint="导出或恢复本地完整数据" onPress={() => router.push('/backup')} />
      </View>

      <Text style={styles.eyebrow}>MEMORIES</Text>
      <View style={styles.group}>
        <SwitchRow checked={preferences.globalMemoryEnabled} hint="控制那年今日和人物回忆在今日页出现" label="今日回忆" onPress={() => savePreference({ globalMemoryEnabled: !preferences.globalMemoryEnabled })} />
        <View style={styles.separator} />
        <SwitchRow checked={preferences.memoryNotificationsEnabled} hint="在记忆逐渐模糊时，偶尔推荐以前的记录" label="回忆通知" onPress={() => void setMemoryNotificationsEnabled(!preferences.memoryNotificationsEnabled).catch((cause: unknown) => Alert.alert('提醒设置失败', errorMessage(cause)))} />
      </View>

      <Text style={styles.eyebrow}>REMINDERS</Text>
      <View style={styles.group}>
        <SwitchRow checked={preferences.birthdayNotificationsEnabled} hint="提前 3 天和生日当天提醒" label="人物生日提醒" onPress={() => void setBirthdayNotificationsEnabled(!preferences.birthdayNotificationsEnabled).catch((cause: unknown) => Alert.alert('提醒设置失败', errorMessage(cause)))} />
      </View>
      {preferences.birthdayNotificationsEnabled ? <TimePickerField hour={preferences.birthdayReminderHour} label="提醒时间" minute={preferences.birthdayReminderMinute} onChange={(hour, minute) => savePreference({ birthdayReminderHour: hour, birthdayReminderMinute: minute })} /> : null}
      <Text style={styles.permissionState}>系统权限 {notificationPermission === 'granted' ? '已允许' : notificationPermission === 'denied' ? '未允许' : '尚未询问'}</Text>
      {notificationPermission === 'denied' ? <Pressable onPress={() => void openNotificationSettings()} style={styles.inlineButton}><Text style={styles.inlineButtonText}>打开系统通知设置</Text></Pressable> : null}
      {preferences.birthdayNotificationError ? <><Pressable onPress={() => void retryBirthdayNotifications().catch((cause: unknown) => Alert.alert('重试失败', errorMessage(cause)))} style={styles.inlineButton}><Text style={styles.inlineButtonText}>重试通知调度</Text></Pressable><Text style={styles.error}>{preferences.birthdayNotificationError}</Text></> : null}
      {preferences.memoryNotificationError ? <><Pressable onPress={() => void retryMemoryNotifications().catch((cause: unknown) => Alert.alert('重试失败', errorMessage(cause)))} style={styles.inlineButton}><Text style={styles.inlineButtonText}>重试回忆通知</Text></Pressable><Text style={styles.error}>{preferences.memoryNotificationError}</Text></> : null}

      <Text style={styles.eyebrow}>PRIVACY</Text>
      <View style={styles.privacyCard}><Text style={styles.privacyTitle}>数据只保存在这台设备</Text><Text style={styles.privacyText}>没有账号、后台同步或第三方行为追踪。只有主动导出时，内容才会通过系统分享面板离开应用。</Text><Text style={styles.location}>当前设备 应用私有目录</Text></View>
      <Pressable accessibilityRole="button" onPress={confirmDeleteAll} style={styles.deleteButton}><Text style={styles.deleteTitle}>删除全部本地数据</Text><Text style={styles.deleteHint}>不会删除已经保存到其他位置的备份</Text></Pressable>
      <Text style={styles.version}>仍在 Still Alive 0.1.0</Text>
    </ScrollView>
  </SafeAreaView>;
}

function Entry({ icon, androidIcon, label, hint, onPress }: { icon: SFSymbol; androidIcon: AndroidSymbol; label: string; hint: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.entry, pressed && styles.pressed]}><View style={styles.entryIcon}><SymbolView name={{ android: androidIcon, ios: icon, web: androidIcon }} size={21} tintColor={colors.life} type="hierarchical" /></View><View style={styles.entryCopy}><Text style={styles.entryTitle}>{label}</Text><Text numberOfLines={1} style={styles.entryHint}>{hint}</Text></View><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>;
}

function SwitchRow({ checked, label, hint, onPress }: { checked: boolean; label: string; hint: string; onPress(): void }) {
  return <Pressable accessibilityRole="switch" accessibilityState={{ checked }} onPress={onPress} style={styles.switchRow}><View style={styles.entryCopy}><Text style={styles.entryTitle}>{label}</Text><Text style={styles.entryHint}>{hint}</Text></View><View style={[styles.switchTrack, checked && styles.switchTrackOn]}><View style={[styles.switchThumb, checked && styles.switchThumbOn]} /></View></Pressable>;
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl }, eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 },
  group: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, separator: { height: StyleSheet.hairlineWidth, marginLeft: spacing.md, backgroundColor: colors.line }, entry: { minHeight: 72, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, entryIcon: { width: 38, height: 38, marginRight: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.lifeLight }, entryCopy: { flex: 1 }, entryTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' }, entryHint: { marginTop: 5, color: colors.inkFaint, fontSize: 9, lineHeight: 15 },
  switchRow: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, switchTrack: { width: 44, height: 26, marginLeft: spacing.md, padding: 2, borderRadius: 13, backgroundColor: colors.line }, switchTrackOn: { backgroundColor: colors.life }, switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.paper }, switchThumbOn: { alignSelf: 'flex-end' },
  permissionState: { marginTop: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 }, inlineButton: { minHeight: 42, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, inlineButtonText: { color: colors.life, fontSize: 10, fontWeight: '700' }, error: { marginTop: spacing.sm, color: '#9B493F', fontSize: 9, lineHeight: 16 },
  privacyCard: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet }, privacyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 }, privacyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 19 }, location: { marginTop: spacing.md, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  deleteButton: { minHeight: 72, marginTop: spacing.xl, padding: spacing.md, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(155,73,63,0.35)', borderRadius: radius.md }, deleteTitle: { color: '#9B493F', fontSize: 11, fontWeight: '700' }, deleteHint: { marginTop: 5, color: colors.inkFaint, fontSize: 9 }, version: { marginTop: spacing.xxl, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, textAlign: 'center' }, pressed: { opacity: 0.7 },
});
