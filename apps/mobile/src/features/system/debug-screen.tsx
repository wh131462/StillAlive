import { isRunningInExpoGo } from 'expo';
import * as Battery from 'expo-battery';
import * as Sharing from 'expo-sharing';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { Directory, Paths } from 'expo-file-system';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { SymbolViewProps } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { getLastBirthdayNotificationResponse, getScheduledNotificationCount, expoBirthdayNotificationAdapter, scheduleDebugNotification } from '../../infrastructure/notifications/expo-notifications';
import { AndroidUpdateDialog } from './android-update-dialog';
import { checkForAndroidUpdate, getCurrentAndroidVersion } from './android-update';
import type { AndroidUpdateCheckResult, AndroidUpdateManifest } from './android-update';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';
import { clearPersistentLog, getPersistentLogFile, writePersistentError, writePersistentLog } from '../../infrastructure/platform/persistent-log';
import { clearDirectoryContents, inspectDatabase, inspectMediaHealth, inspectStorage, readLogTail } from './developer-diagnostics';

type Permission = 'granted' | 'denied' | 'undetermined';
type PowerState = Awaited<ReturnType<typeof Battery.getPowerStateAsync>>;
type LogFilter = 'ALL' | 'INFO' | 'WARN' | 'ERROR';

const DEBUG_UPDATE_MANIFEST: AndroidUpdateManifest = {
  versionCode: 999_999,
  versionName: '9.9.9',
  apkUrl: '',
  releaseNotes: '全新更新下载面板\n实时展示下载进度、速度与剩余时间\n优化安装授权和失败重试提示',
};
const DEBUG_PERSON_NAME = '[开发者测试人物]';
const DEBUG_POST_MARKER = '<!-- still-alive-developer-fixture -->';

export default function DebugScreen() {
  const router = useRouter();
  const database = useSQLiteContext();
  const state = useAppState();
  const [permission, setPermission] = useState<Permission>('undetermined');
  const [powerState, setPowerState] = useState<PowerState | null>(null);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const [logSize, setLogSize] = useState(0);
  const [logLines, setLogLines] = useState<string[]>([]);
  const [logFilter, setLogFilter] = useState<LogFilter>('ALL');
  const [updatePreviewVisible, setUpdatePreviewVisible] = useState(false);
  const [databaseDiagnostics, setDatabaseDiagnostics] = useState<Awaited<ReturnType<typeof inspectDatabase>> | null>(null);
  const [mediaHealth, setMediaHealth] = useState<Awaited<ReturnType<typeof inspectMediaHealth>> | null>(null);
  const [storageDiagnostics, setStorageDiagnostics] = useState<ReturnType<typeof inspectStorage> | null>(null);
  const [scheduledNotificationCount, setScheduledNotificationCount] = useState<number | null>(null);
  const [updateDiagnostic, setUpdateDiagnostic] = useState<{ label: string; durationMs: number } | null>(null);
  const [updateChecking, setUpdateChecking] = useState(false);
  const currentVersion = getCurrentAndroidVersion();

  const refreshPermission = async () => setPermission(await expoBirthdayNotificationAdapter.getPermission());

  const refreshDiagnostics = async () => {
    setRefreshing(true);
    const startedAt = Date.now();
    try {
      const [nextPowerState, nextDatabase, nextScheduledCount] = await Promise.all([
        Battery.getPowerStateAsync().catch(() => null),
        inspectDatabase(database),
        getScheduledNotificationCount(),
      ]);
      await refreshPermission();
      setPowerState(nextPowerState);
      setDatabaseDiagnostics(nextDatabase);
      setMediaHealth(inspectMediaHealth(state.media, state.posts, state.people, state.albums, state.albumMedia, state.musicTracks, state.books, state.preferences));
      setStorageDiagnostics(inspectStorage());
      setScheduledNotificationCount(nextScheduledCount);
      setMessage(`诊断完成 · ${Date.now() - startedAt} ms`);
      writePersistentLog('INFO', 'diagnostic.full-scan.finished', { durationMs: Date.now() - startedAt, foreignKeyViolations: nextDatabase.foreignKeyViolations });
      await refreshLogs();
    } catch (cause) {
      writePersistentError('diagnostic.full-scan.failed', cause);
      setMessage(errorMessage(cause));
    } finally {
      setRefreshing(false);
    }
  };

  const refreshLogs = async () => {
    try {
      const file = getPersistentLogFile();
      setLogSize(file.size);
      setLogLines(await readLogTail(file, logFilter));
    } catch (cause) {
      setMessage(errorMessage(cause));
    }
  };

  useEffect(() => {
    if (state.ready) void refreshDiagnostics();
  }, [state.ready]);
  useEffect(() => { void refreshLogs(); }, [logFilter]);

  const testNotification = async () => {
    setBusy(true);
    setMessage('正在安排测试通知…');
    try {
      await scheduleDebugNotification();
      setPermission('granted');
      setMessage('已安排，约 1 秒后检查系统通知栏。');
      writePersistentLog('INFO', 'diagnostic.notification.tested');
      await refreshLogs();
    } catch (cause: unknown) {
      await refreshPermission();
      setMessage(errorMessage(cause, '通知测试失败，请稍后重试。'));
      writePersistentError('diagnostic.notification.test.failed', cause);
    } finally {
      setBusy(false);
    }
  };

  const shareLog = async () => {
    try {
      writePersistentLog('INFO', 'diagnostic.share.requested', { platform: Platform.OS, versionCode: currentVersion.versionCode, versionName: currentVersion.versionName });
      if (!await Sharing.isAvailableAsync()) {
        feedback.alert('当前设备不支持分享', '诊断日志已保存在应用目录中，但无法打开系统分享面板。');
        return;
      }
      await Sharing.shareAsync(getPersistentLogFile().uri, { dialogTitle: '分享“仍在”诊断日志', mimeType: 'text/plain', UTI: 'public.plain-text' });
      writePersistentLog('INFO', 'diagnostic.share.finished');
      await refreshLogs();
    } catch (cause) {
      writePersistentError('diagnostic.share.failed', cause);
      feedback.alert('分享日志失败', errorMessage(cause));
    }
  };

  const clearLog = () => feedback.alert('清空诊断日志？', '这只会删除本机诊断日志，不会影响你的记录、媒体或备份。', [
    { text: '取消', style: 'cancel' },
    { text: '清空日志', style: 'destructive', onPress: () => { clearPersistentLog(); writePersistentLog('INFO', 'diagnostic.log.cleared'); setLogSize(0); setLogLines([]); setMessage('诊断日志已清空'); } },
  ]);

  const inspectUpdate = async () => {
    setUpdateChecking(true);
    const startedAt = Date.now();
    try {
      const result = await checkForAndroidUpdate();
      setUpdateDiagnostic({ label: updateResultLabel(result), durationMs: Date.now() - startedAt });
      setMessage('更新源诊断完成');
    } catch (cause) {
      setUpdateDiagnostic({ label: `失败：${errorMessage(cause)}`, durationMs: Date.now() - startedAt });
      setMessage('更新源诊断失败');
    } finally {
      setUpdateChecking(false);
    }
  };

  const runDatabaseMaintenance = async () => {
    try {
      const startedAt = Date.now();
      await database.execAsync('PRAGMA optimize; REINDEX;');
      const next = await inspectDatabase(database);
      setDatabaseDiagnostics(next);
      setMessage(`数据库维护完成 · ${Date.now() - startedAt} ms`);
      writePersistentLog('INFO', 'diagnostic.database.maintenance.finished', { durationMs: Date.now() - startedAt });
    } catch (cause) {
      writePersistentError('diagnostic.database.maintenance.failed', cause);
      feedback.alert('数据库维护失败', errorMessage(cause));
    }
  };

  const clearCache = () => feedback.alert('清理应用缓存？', '只会删除临时缓存和已下载的更新文件，不会删除记录、媒体或备份。', [
    { text: '取消', style: 'cancel' },
    { text: '清理缓存', style: 'destructive', onPress: () => {
      const removed = clearDirectoryContents(new Directory(Paths.cache));
      setStorageDiagnostics(inspectStorage());
      setMessage(`已清理 ${removed} 个缓存项`);
    } },
  ]);

  const toggleFeature = async (kind: 'birthday' | 'memory' | 'persistent', value: boolean) => {
    try {
      if (kind === 'birthday') await state.setBirthdayNotificationsEnabled(value);
      else if (kind === 'memory') await state.setMemoryNotificationsEnabled(value);
      else await state.setPersistentNotificationsEnabled(value);
      setMessage('功能开关已更新');
    } catch (cause) {
      feedback.alert('功能开关更新失败', errorMessage(cause));
    }
  };

  const createFixture = async () => {
    setBusy(true);
    try {
      const person = state.people.find((item) => item.name === DEBUG_PERSON_NAME) ?? await state.createPerson(DEBUG_PERSON_NAME);
      await state.savePost(`${DEBUG_POST_MARKER}\n这是一条开发者模式生成的测试记录，用于验证时间线、搜索和备份流程。`, [person.id], state.today);
      setMessage('测试人物与记录已生成');
      writePersistentLog('INFO', 'diagnostic.fixture.created');
    } catch (cause) {
      feedback.alert('生成测试数据失败', errorMessage(cause));
    } finally {
      setBusy(false);
    }
  };

  const removeFixture = () => feedback.alert('清理开发者测试数据？', '只会删除带有开发者标记的测试记录和测试人物。', [
    { text: '取消', style: 'cancel' },
    { text: '清理', style: 'destructive', onPress: () => { void (async () => {
      try {
        for (const post of state.posts.filter((item) => item.bodyMarkdown.includes(DEBUG_POST_MARKER))) await state.deletePost(post.id);
        for (const person of state.people.filter((item) => item.name === DEBUG_PERSON_NAME)) await state.deletePerson(person.id);
        setMessage('开发者测试数据已清理');
        writePersistentLog('INFO', 'diagnostic.fixture.removed');
      } catch (cause) {
        feedback.alert('清理测试数据失败', errorMessage(cause));
      }
    })(); } },
  ]);

  const lastResponse = getLastBirthdayNotificationResponse();
  const counts = databaseDiagnostics?.counts ?? [];
  const count = (table: string) => counts.find((item) => item.table === table)?.count ?? 0;
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="开发者模式" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.hero}>
        <View style={styles.heroIcon}><SymbolView name={{ android: 'code', ios: 'chevron.left.forwardslash.chevron.right', web: 'code' }} size={25} tintColor={colors.onLife} type="hierarchical" /></View>
        <View style={styles.heroCopy}><Text style={styles.eyebrow}>DEVELOPER CONSOLE</Text><Text style={styles.title}>本地诊断控制台</Text><Text style={styles.subtitle}>只在本机运行，不会改变正式数据。</Text></View>
        <View style={styles.liveBadge}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
      </View>

      <SectionHeading eyebrow="RUNTIME" title="运行概览" action={refreshing ? <ActivityIndicator color={colors.life} size="small" /> : <Pressable accessibilityLabel="刷新运行状态" onPress={() => void refreshDiagnostics()} hitSlop={8}><SymbolView name={{ android: 'refresh', ios: 'arrow.clockwise', web: 'refresh' }} size={19} tintColor={colors.life} type="hierarchical" /></Pressable>} />
      <View style={styles.runtimeCard}>
        <StatusRow icon="device" label="平台" value={Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : Platform.OS} />
        <View style={styles.separator} /><StatusRow icon="layers" label="运行方式" value={Platform.OS === 'android' && isRunningInExpoGo() ? 'Expo Go（受限）' : '开发构建 / 独立构建'} />
        <View style={styles.separator} /><StatusRow icon="tag" label="应用版本" value={`v${currentVersion.versionName} · ${currentVersion.versionCode}`} />
        <View style={styles.separator} /><StatusRow icon="database" label="数据库" value={`v${databaseDiagnostics?.version ?? '—'} · ${databaseDiagnostics?.durationMs ?? '—'} ms`} tone={databaseDiagnostics?.foreignKeyViolations ? 'danger' : 'positive'} />
        <View style={styles.separator} /><StatusRow icon="bell" label="通知权限" value={permission === 'granted' ? '已允许' : permission === 'denied' ? '未允许' : '尚未询问'} tone={permission === 'granted' ? 'positive' : permission === 'denied' ? 'danger' : 'neutral'} />
        <View style={styles.separator} /><StatusRow icon="battery" label="电量" value={formatPowerState(powerState)} tone={powerState?.lowPowerMode ? 'warning' : 'neutral'} />
      </View>

      <SectionHeading eyebrow="DATA HEALTH" title="数据健康" action={<Pressable accessibilityRole="button" onPress={() => void refreshDiagnostics()}><Text style={styles.sectionAction}>运行检查</Text></Pressable>} />
      <View style={styles.healthCard}><View style={styles.countGrid}><Metric label="记录" value={count('posts')} /><Metric label="人物" value={count('persons')} /><Metric label="媒体" value={count('media')} /><Metric label="书籍" value={count('books')} /></View><View style={styles.separator} /><StatusRow icon="shield" label="外键完整性" value={databaseDiagnostics ? databaseDiagnostics.foreignKeyViolations ? `${databaseDiagnostics.foreignKeyViolations} 个问题` : '通过' : '未检查'} tone={databaseDiagnostics?.foreignKeyViolations ? 'danger' : 'positive'} /><View style={styles.separator} /><StatusRow icon="image" label="媒体完整性" value={mediaHealth ? mediaHealth.missingFiles ? `${mediaHealth.missingFiles} 个文件缺失` : mediaHealth.orphanedRecords ? `${mediaHealth.orphanedRecords} 条孤立记录` : '通过' : '未检查'} tone={mediaHealth && (mediaHealth.missingFiles || mediaHealth.orphanedRecords) ? 'warning' : 'positive'} /></View>

      <SectionHeading eyebrow="NOTIFICATION LAB" title="通知检查器" />
      <View style={styles.runtimeCard}><StatusRow icon="bell" label="数据库计划" value={`${count('birthday_notification_schedules')} 个生日 · ${count('memory_notification_schedules')} 个回忆`} /><View style={styles.separator} /><StatusRow icon="calendar" label="系统计划" value={scheduledNotificationCount === null ? '不可用' : `${scheduledNotificationCount} 个`} /><View style={styles.separator} /><StatusRow icon="info" label="最近响应" value={lastResponse ? '有记录' : '暂无记录'} /><View style={styles.separator} /><View style={styles.inlineActions}><ActionButton title="同步生日" onPress={() => void state.retryBirthdayNotifications().then(() => setMessage('生日通知已同步')).catch((cause) => feedback.alert('同步失败', errorMessage(cause)))} /><ActionButton title="同步回忆" onPress={() => void state.retryMemoryNotifications().then(() => setMessage('回忆通知已同步')).catch((cause) => feedback.alert('同步失败', errorMessage(cause)))} /></View></View>

      <SectionHeading eyebrow="TOOLS" title="快速诊断" />
      <View style={styles.toolGrid}><ToolButton icon="bell" title="测试通知" hint="本机安排" onPress={() => void testNotification()} disabled={busy} primary /><ToolButton icon="download" title="模拟更新" hint="预览完整流程" onPress={() => setUpdatePreviewVisible(true)} /><ToolButton icon="refresh" title="刷新状态" hint="重新读取设备" onPress={() => void refreshDiagnostics()} disabled={refreshing} /><ToolButton icon="share" title="分享日志" hint="包含完整诊断上下文" onPress={() => void shareLog()} /></View>

      <SectionHeading eyebrow="UPDATE PROBE" title="更新诊断" action={updateChecking ? <ActivityIndicator color={colors.life} size="small" /> : null} />
      <View style={styles.logCard}><View style={styles.updateRow}><View style={styles.logCopy}><Text style={styles.logTitle}>更新源与 Manifest</Text><Text style={styles.logHint}>{updateDiagnostic ? `${updateDiagnostic.label} · ${updateDiagnostic.durationMs} ms` : '尚未执行更新源检查'}</Text></View><ActionButton title={updateChecking ? '检查中…' : '检查'} disabled={updateChecking} onPress={() => void inspectUpdate()} /></View></View>

      <SectionHeading eyebrow="STORAGE" title="存储诊断" />
      <View style={styles.runtimeCard}><StatusRow icon="folder" label="文档目录" value={formatBytes(storageDiagnostics?.documentBytes ?? 0)} /><View style={styles.separator} /><StatusRow icon="archive" label="缓存目录" value={formatBytes(storageDiagnostics?.cacheBytes ?? 0)} /><View style={styles.separator} /><StatusRow icon="image" label="媒体文件" value={formatBytes(mediaHealth?.totalBytes ?? 0)} /><View style={styles.separator} /><View style={styles.inlineActions}><ActionButton title="清理缓存" danger onPress={clearCache} /><ActionButton title="刷新占用" onPress={() => { setStorageDiagnostics(inspectStorage()); setMessage('存储占用已刷新'); }} /></View></View>

      <SectionHeading eyebrow="PERFORMANCE" title="性能面板" />
      <View style={styles.healthCard}><View style={styles.countGrid}><Metric label="数据库查询" value={databaseDiagnostics?.durationMs ?? 0} suffix="ms" /><Metric label="更新探测" value={updateDiagnostic?.durationMs ?? 0} suffix="ms" /><Metric label="日志条数" value={logLines.length} /><Metric label="媒体记录" value={state.media.length} /></View><Text style={styles.performanceHint}>当前数据用于定位慢查询、更新源延迟和日志异常，不代表正式用户体验指标。</Text></View>

      <SectionHeading eyebrow="LOG CENTER" title="事件日志" action={<Pressable accessibilityRole="button" onPress={() => void refreshLogs()}><Text style={styles.sectionAction}>{formatBytes(logSize)}</Text></Pressable>} />
      <View style={styles.logCard}><View style={styles.filterRow}>{(['ALL', 'INFO', 'WARN', 'ERROR'] as LogFilter[]).map((filter) => <Pressable key={filter} onPress={() => setLogFilter(filter)} style={[styles.filter, logFilter === filter && styles.filterSelected]}><Text style={[styles.filterText, logFilter === filter && styles.filterTextSelected]}>{filter}</Text></Pressable>)}</View><View style={styles.logViewer}>{logLines.length ? logLines.slice(0, 10).map((line, index) => <Text key={`${line}-${index}`} numberOfLines={2} style={styles.logLine}>{line}</Text>) : <Text style={styles.emptyText}>暂无日志</Text>}</View><View style={styles.logActions}><Pressable accessibilityRole="button" onPress={() => void shareLog()} style={({ pressed }) => [styles.logAction, pressed && styles.pressed]}><SymbolView name={{ android: 'share', ios: 'square.and.arrow.up', web: 'share' }} size={17} tintColor={colors.life} type="hierarchical" /><Text style={styles.logActionText}>导出日志</Text></Pressable><Pressable accessibilityRole="button" onPress={clearLog} style={({ pressed }) => [styles.logAction, pressed && styles.pressed]}><SymbolView name={{ android: 'delete', ios: 'trash', web: 'delete' }} size={17} tintColor={colors.danger} type="hierarchical" /><Text style={styles.logActionDangerText}>清空</Text></Pressable></View></View>

      <SectionHeading eyebrow="FEATURE FLAGS" title="功能开关" />
      <View style={styles.runtimeCard}><ToggleRow label="生日通知" hint="重新同步本地生日提醒" value={state.preferences.birthdayNotificationsEnabled} onValueChange={(value) => void toggleFeature('birthday', value)} /><View style={styles.separator} /><ToggleRow label="回忆通知" hint="重新计算旧日记录提醒" value={state.preferences.memoryNotificationsEnabled} onValueChange={(value) => void toggleFeature('memory', value)} /><View style={styles.separator} /><ToggleRow label="常驻快捷栏" hint={state.persistentNotificationSupported ? 'Android 快捷状态' : '当前平台不可用'} value={state.preferences.persistentNotificationEnabled} disabled={!state.persistentNotificationSupported} onValueChange={(value) => void toggleFeature('persistent', value)} /></View>

      <SectionHeading eyebrow="MAINTENANCE" title="安全维护" />
      <View style={styles.toolGrid}><ToolButton icon="database" title="校验数据库" hint="外键与索引" onPress={() => void refreshDiagnostics()} /><ToolButton icon="build" title="重建索引" hint="SQLite 安全优化" onPress={() => void runDatabaseMaintenance()} /><ToolButton icon="science" title="生成测试数据" hint="人物 + 记录" onPress={() => void createFixture()} disabled={busy} /><ToolButton icon="delete" title="清理测试数据" hint="只清理开发标记" onPress={removeFixture} /></View>

      <View style={styles.notice}><SymbolView name={{ android: 'info', ios: 'info.circle', web: 'info' }} size={16} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.noticeText}>{message || '开发者工具只影响本机环境'}{state.error ? ` · 应用状态：${state.error}` : ''}</Text></View>
    </ScrollView>
    <AndroidUpdateDialog manifest={updatePreviewVisible ? DEBUG_UPDATE_MANIFEST : null} onDismiss={() => setUpdatePreviewVisible(false)} simulateDownload />
  </SafeAreaView>;
}

function SectionHeading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) { return <View style={styles.sectionHeading}><View><Text style={styles.sectionEyebrow}>{eyebrow}</Text><Text style={styles.sectionTitle}>{title}</Text></View>{action}</View>; }
function Metric({ label, value, suffix = '' }: { label: string; value: number; suffix?: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}<Text style={styles.metricSuffix}>{suffix}</Text></Text><Text style={styles.metricLabel}>{label}</Text></View>; }
function StatusRow({ icon, label, value, tone = 'neutral' }: { icon: string; label: string; value: string; tone?: 'neutral' | 'positive' | 'warning' | 'danger' }) { return <View style={styles.statusRow}><View style={styles.statusLabelWrap}><View style={styles.statusIcon}><SymbolView name={statusSymbol(icon)} size={16} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.statusLabel}>{label}</Text></View><Text style={[styles.statusValue, tone === 'positive' && styles.positive, tone === 'warning' && styles.warning, tone === 'danger' && styles.danger]}>{value}</Text></View>; }
function ActionButton({ title, onPress, disabled, danger }: { title: string; onPress(): void; disabled?: boolean; danger?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionButton, danger && styles.actionButtonDanger, disabled && styles.disabled, pressed && styles.pressed]}><Text style={danger ? styles.actionButtonDangerText : styles.actionButtonText}>{title}</Text></Pressable>; }
function ToggleRow({ label, hint, value, onValueChange, disabled }: { label: string; hint: string; value: boolean; onValueChange(value: boolean): void; disabled?: boolean }) { return <View style={[styles.toggleRow, disabled && styles.disabled]}><View style={styles.toggleCopy}><Text style={styles.toggleLabel}>{label}</Text><Text style={styles.toggleHint}>{hint}</Text></View><Switch accessibilityLabel={label} disabled={disabled} onValueChange={onValueChange} thumbColor={value ? colors.onLife : colors.inkFaint} trackColor={{ false: colors.line, true: colors.life }} value={value} /></View>; }
function ToolButton({ icon, title, hint, onPress, disabled, primary }: { icon: string; title: string; hint: string; onPress(): void; disabled?: boolean; primary?: boolean }) { return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.toolButton, primary && styles.toolButtonPrimary, disabled && styles.disabled, pressed && styles.pressed]}><View style={[styles.toolIcon, primary && styles.toolIconPrimary]}><SymbolView name={toolSymbol(icon)} size={19} tintColor={primary ? colors.onLife : colors.life} type="hierarchical" /></View><Text style={[styles.toolTitle, primary && styles.toolTitlePrimary]}>{title}</Text><Text style={[styles.toolHint, primary && styles.toolHintPrimary]}>{hint}</Text></Pressable>; }

function statusSymbol(icon: string): SymbolViewProps['name'] {
  if (icon === 'device') return { android: 'phone_android', ios: 'iphone', web: 'phone_android' };
  if (icon === 'layers') return { android: 'layers', ios: 'square.stack.3d.up', web: 'layers' };
  if (icon === 'tag') return { android: 'label', ios: 'tag', web: 'label' };
  if (icon === 'database') return { android: 'storage', ios: 'cylinder', web: 'storage' };
  if (icon === 'bell') return { android: 'notifications', ios: 'bell', web: 'notifications' };
  if (icon === 'calendar') return { android: 'event', ios: 'calendar', web: 'event' };
  if (icon === 'shield') return { android: 'verified_user', ios: 'checkmark.shield', web: 'verified_user' };
  if (icon === 'image') return { android: 'image', ios: 'photo', web: 'image' };
  if (icon === 'folder') return { android: 'folder', ios: 'folder', web: 'folder' };
  if (icon === 'archive') return { android: 'archive', ios: 'archivebox', web: 'archive' };
  if (icon === 'info') return { android: 'info', ios: 'info.circle', web: 'info' };
  return { android: 'battery_full', ios: 'battery.100', web: 'battery_full' };
}
function toolSymbol(icon: string): SymbolViewProps['name'] {
  if (icon === 'download') return { android: 'download', ios: 'arrow.down.circle', web: 'download' };
  if (icon === 'share') return { android: 'share', ios: 'square.and.arrow.up', web: 'share' };
  if (icon === 'refresh') return { android: 'refresh', ios: 'arrow.clockwise', web: 'refresh' };
  if (icon === 'database') return { android: 'storage', ios: 'cylinder', web: 'storage' };
  if (icon === 'build') return { android: 'build', ios: 'wrench.and.screwdriver', web: 'build' };
  if (icon === 'science') return { android: 'science', ios: 'testtube.2', web: 'science' };
  if (icon === 'delete') return { android: 'delete', ios: 'trash', web: 'delete' };
  return { android: 'notifications', ios: 'bell', web: 'notifications' };
}
function formatPowerState(powerState: PowerState | null) { if (!powerState || powerState.batteryLevel < 0) return '不可用'; const percentage = `${Math.round(powerState.batteryLevel * 100)}%`; if (powerState.lowPowerMode) return `${percentage} · 低电量模式`; if (powerState.batteryState === Battery.BatteryState.CHARGING) return `${percentage} · 充电中`; if (powerState.batteryState === Battery.BatteryState.FULL) return `${percentage} · 已充满`; return percentage; }
function formatBytes(bytes: number) { if (!bytes) return '0 B'; if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / (1024 * 1024)).toFixed(1)} MB`; }
function errorMessage(cause: unknown, fallback = '请稍后重试。') { return cause instanceof Error ? cause.message : fallback; }
function updateResultLabel(result: AndroidUpdateCheckResult) { if (result.status === 'available') return `发现 v${result.manifest.versionName}`; if (result.status === 'current') return '已是最新版本'; if (result.status === 'unsupported') return '当前平台不支持'; return '更新服务未配置'; }

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { minHeight: 116, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: radius.xl, backgroundColor: colors.codeBackground }, heroIcon: { width: 54, height: 54, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: colors.life }, heroCopy: { flex: 1, marginLeft: spacing.md }, eyebrow: { color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, title: { marginTop: spacing.xs, color: colors.codeForeground, fontFamily: typography.display, fontSize: 25 }, subtitle: { marginTop: spacing.xs, color: colors.onLifeMuted, fontSize: typography.size.meta }, liveBadge: { position: 'absolute', top: spacing.md, right: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 5 }, liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.sun }, liveText: { color: colors.sun, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  sectionHeading: { marginTop: spacing.xl, marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }, sectionEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, sectionTitle: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 22 }, sectionAction: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta }, runtimeCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, healthCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, countGrid: { padding: spacing.md, flexDirection: 'row', justifyContent: 'space-between' }, metric: { minWidth: '22%', alignItems: 'center' }, metricValue: { color: colors.life, fontFamily: typography.mono, fontSize: 20, fontWeight: '700' }, metricSuffix: { fontSize: 10, fontWeight: '500' }, metricLabel: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta }, performanceHint: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 },
  statusRow: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, statusLabelWrap: { flexDirection: 'row', alignItems: 'center' }, statusIcon: { width: 30, height: 30, marginRight: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: colors.lifeLight }, statusLabel: { color: colors.inkSoft, fontSize: typography.size.caption }, statusValue: { maxWidth: '62%', color: colors.ink, fontFamily: typography.mono, fontSize: typography.size.meta, textAlign: 'right' }, positive: { color: colors.life }, warning: { color: colors.sun }, danger: { color: colors.danger }, separator: { height: StyleSheet.hairlineWidth, marginLeft: 54, backgroundColor: colors.lineSoft },
  inlineActions: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: spacing.sm }, actionButton: { minHeight: 36, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.lifeLight }, actionButtonText: { color: colors.life, fontSize: typography.size.meta, fontWeight: '700' }, actionButtonDanger: { backgroundColor: colors.dangerLight }, actionButtonDangerText: { color: colors.danger, fontSize: typography.size.meta, fontWeight: '700' }, updateRow: { minHeight: 72, padding: spacing.md, flexDirection: 'row', alignItems: 'center' },
  toolGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }, toolButton: { width: '48%', minHeight: 112, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.sheet }, toolButtonPrimary: { backgroundColor: colors.life }, toolIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: colors.lifeLight }, toolIconPrimary: { backgroundColor: colors.lifeDeep }, toolTitle: { marginTop: spacing.sm, color: colors.ink, fontSize: typography.size.caption, fontWeight: '700' }, toolTitlePrimary: { color: colors.onLife }, toolHint: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta }, toolHintPrimary: { color: colors.onLifeMuted },
  logCard: { overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet }, logCopy: { flex: 1 }, logTitle: { color: colors.ink, fontFamily: typography.mono, fontSize: typography.size.meta }, logHint: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta }, filterRow: { padding: spacing.sm, flexDirection: 'row', gap: spacing.xs }, filter: { paddingHorizontal: spacing.sm, paddingVertical: 6, borderRadius: radius.sm }, filterSelected: { backgroundColor: colors.lifeLight }, filterText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 }, filterTextSelected: { color: colors.life }, logViewer: { minHeight: 150, padding: spacing.md, backgroundColor: colors.codeBackground }, logLine: { marginBottom: 6, color: colors.codeForeground, fontFamily: typography.mono, fontSize: 9, lineHeight: 14 }, emptyText: { color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: typography.size.meta }, logActions: { minHeight: 50, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, logAction: { minHeight: 40, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.sm }, logActionText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' }, logActionDangerText: { color: colors.danger, fontSize: typography.size.caption, fontWeight: '700' },
  toggleRow: { minHeight: 64, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, toggleCopy: { flex: 1 }, toggleLabel: { color: colors.ink, fontSize: typography.size.caption, fontWeight: '700' }, toggleHint: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta }, notice: { marginTop: spacing.lg, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.sm }, noticeText: { flex: 1, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, lineHeight: 16 }, disabled: { opacity: 0.45 }, pressed: { opacity: 0.72, transform: [{ scale: 0.98 }] },
}));
