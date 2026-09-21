import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { AndroidSymbol, SFSymbol } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { getAppPermissionStatus, openAppSettings } from '../../infrastructure/platform/app-permissions';
import type { AppPermission, AppPermissionStatus } from '../../infrastructure/platform/app-permissions';
import { expoBirthdayNotificationAdapter } from '../../infrastructure/notifications/expo-notifications';

type PermissionKey = AppPermission | 'notifications';
type PermissionState = AppPermissionStatus | { canAskAgain: boolean; granted: boolean; status: 'denied' | 'granted' | 'undetermined' };

interface PermissionGuide {
  androidIcon: AndroidSymbol;
  description: string;
  icon: SFSymbol;
  key: PermissionKey;
  title: string;
}

const permissionGuides: PermissionGuide[] = [
  {
    androidIcon: 'notifications',
    description: Platform.OS === 'android' ? '生日、回忆和常驻快捷栏提醒。' : '生日和回忆提醒。',
    icon: 'bell.badge',
    key: 'notifications',
    title: '通知',
  },
  { androidIcon: 'location_on', description: '保存你主动添加的城市，不保存经纬度。', icon: 'location', key: 'location', title: '位置' },
  { androidIcon: 'photo_camera', description: '拍摄头像或记录中的图片。', icon: 'camera', key: 'camera', title: '相机' },
  { androidIcon: 'photo_library', description: '选择头像、图片或视频。', icon: 'photo.on.rectangle', key: 'photos', title: '照片' },
  { androidIcon: 'mic', description: '在记录中录制语音。', icon: 'mic', key: 'microphone', title: '麦克风' },
];

export default function PermissionsScreen() {
  const router = useRouter();
  const [states, setStates] = useState<Partial<Record<PermissionKey, PermissionState>>>({});
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setFailed(false);
    try {
      const entries = await Promise.all(permissionGuides.map(async ({ key }) => {
        const state = key === 'notifications'
          ? notificationState(await expoBirthdayNotificationAdapter.getPermission())
          : await getAppPermissionStatus(key);
        return [key, state] as const;
      }));
      setStates(Object.fromEntries(entries) as Record<PermissionKey, PermissionState>);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
  }, [refresh]));

  const summary = useMemo(() => summarizePermissions(states), [states]);

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="系统权限" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <View style={styles.introIcon}><SymbolView name={{ android: 'verified_user', ios: 'checkmark.shield', web: 'verified_user' }} size={25} tintColor={colors.life} type="hierarchical" /></View>
        <View style={styles.introCopy}>
          <Text style={styles.introTitle}>用到哪项，再开启哪项</Text>
          <Text style={styles.introText}>不需要一次全部允许。拒绝某项权限，不影响其他记录功能。</Text>
        </View>
      </View>

      <View style={styles.sectionHeader}>
        <View>
          <Text style={styles.eyebrow}>STATUS</Text>
          <Text style={styles.sectionTitle}>当前状态</Text>
        </View>
        <Text style={styles.summary}>{loading ? '正在检查…' : summary}</Text>
      </View>

      <View style={styles.permissionList}>
        {permissionGuides.map((guide, index) => <View key={guide.key}>
          <PermissionRow guide={guide} state={states[guide.key]} />
          {index < permissionGuides.length - 1 ? <View style={styles.separator} /> : null}
        </View>)}
      </View>

      {failed ? <Pressable accessibilityRole="button" onPress={() => void refresh()} style={({ pressed }) => [styles.retry, pressed && styles.pressed]}><Text style={styles.retryText}>重新检查权限</Text></Pressable> : null}

      <Text style={styles.eyebrow}>PRIVACY</Text>
      <View style={styles.note}>
        <SymbolView name={{ android: 'info', ios: 'info.circle', web: 'info' }} size={17} tintColor={colors.inkFaint} type="hierarchical" />
        <Text style={styles.noteText}>这些权限只服务于对应功能。记录、人物和媒体默认只保存在这台设备。</Text>
      </View>
    </ScrollView>
  </SafeAreaView>;
}

function PermissionRow({ guide, state }: { guide: PermissionGuide; state?: PermissionState }) {
  const status = describeStatus(guide.key, state);
  const action = status.action;
  const content = <>
    <View style={styles.permissionIcon}><SymbolView name={{ android: guide.androidIcon, ios: guide.icon, web: guide.androidIcon }} size={21} tintColor={colors.life} type="hierarchical" /></View>
    <View style={styles.permissionCopy}>
      <View style={styles.permissionTitleRow}><Text style={styles.permissionTitle}>{guide.title}</Text><Text style={[styles.permissionStatus, styles[`status_${status.tone}`]]}>{status.label}</Text></View>
      <Text style={styles.permissionDescription}>{guide.description}</Text>
    </View>
    {action ? <View style={styles.permissionAction}><Text style={styles.permissionActionText}>{action}</Text><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={16} tintColor={colors.life} type="hierarchical" /></View> : null}
  </>;
  return action
    ? <Pressable accessibilityRole="button" onPress={() => void openAppSettings()} style={({ pressed }) => [styles.permissionRow, pressed && styles.pressed]}>{content}</Pressable>
    : <View style={styles.permissionRow}>{content}</View>;
}

function describeStatus(key: PermissionKey, state?: PermissionState): { action: string | null; label: string; tone: 'danger' | 'neutral' | 'positive' | 'warning' } {
  if (!state) return { action: null, label: '正在检查', tone: 'neutral' };
  if (key === 'photos' && 'accessPrivileges' in state && state.accessPrivileges === 'limited') return { action: '去设置', label: '部分允许', tone: 'warning' };
  if (state.granted) return { action: null, label: '已允许', tone: 'positive' };
  if (state.status === 'denied') return { action: '去设置', label: '已拒绝', tone: 'danger' };
  return { action: null, label: '尚未使用', tone: 'neutral' };
}

function notificationState(permission: 'granted' | 'denied' | 'undetermined'): PermissionState {
  return { canAskAgain: permission !== 'denied', granted: permission === 'granted', status: permission };
}

function summarizePermissions(states: Partial<Record<PermissionKey, PermissionState>>): string {
  const values = permissionGuides.map(({ key }) => states[key]).filter((state): state is PermissionState => Boolean(state));
  const granted = values.filter((state) => state.granted).length;
  const denied = values.filter((state) => state.status === 'denied').length;
  const pending = permissionGuides.length - values.length - denied - granted;
  if (denied) return `${denied} 项需要处理`;
  if (pending) return `${granted} 项已允许 · ${pending} 项尚未使用`;
  return `${granted} 项已允许`;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { padding: spacing.lg, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.lifeLight },
  introIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.sheet },
  introCopy: { flex: 1, marginLeft: spacing.md },
  introTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  introText: { marginTop: 5, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18 },
  sectionHeader: { marginTop: spacing.xl, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.3 },
  sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  summary: { maxWidth: '48%', color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17, textAlign: 'right' },
  permissionList: { marginTop: spacing.lg, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  permissionRow: { minHeight: 88, padding: spacing.md, flexDirection: 'row', alignItems: 'center' },
  permissionIcon: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.lifeLight },
  permissionCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  permissionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  permissionTitle: { color: colors.ink, fontSize: typography.size.label, fontWeight: '700' },
  permissionStatus: { fontSize: typography.size.meta, fontWeight: '700' },
  status_positive: { color: colors.life },
  status_warning: { color: colors.sun },
  status_danger: { color: colors.danger },
  status_neutral: { color: colors.inkFaint },
  permissionDescription: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.caption, lineHeight: 18 },
  permissionAction: { marginLeft: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  permissionActionText: { color: colors.life, fontSize: typography.size.meta, fontWeight: '800' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 72, backgroundColor: colors.line },
  retry: { minHeight: 44, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  retryText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  note: { padding: spacing.md, flexDirection: 'row', alignItems: 'flex-start', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md },
  noteText: { flex: 1, marginLeft: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  pressed: { opacity: 0.7 },
}));
