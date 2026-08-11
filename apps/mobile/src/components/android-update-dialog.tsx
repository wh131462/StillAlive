import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';
import {
  downloadAndInstallAndroidUpdate,
  getCurrentAndroidVersion,
  installDownloadedAndroidUpdate,
  type AndroidUpdateDownloadProgress,
  type AndroidUpdateManifest,
} from '../update/android-update';

interface AndroidUpdateDialogProps {
  manifest: AndroidUpdateManifest | null;
  onDismiss(): void;
  simulateDownload?: boolean;
}

type Phase = 'ready' | 'downloading' | 'permission' | 'error';

interface ProgressView extends AndroidUpdateDownloadProgress {
  bytesPerSecond: number | null;
}

const EMPTY_PROGRESS: ProgressView = { bytesWritten: 0, totalBytes: null, bytesPerSecond: null };

export function AndroidUpdateDialog({ manifest, onDismiss, simulateDownload = false }: AndroidUpdateDialogProps) {
  const [phase, setPhase] = useState<Phase>('ready');
  const [progress, setProgress] = useState<ProgressView>(EMPTY_PROGRESS);
  const [error, setError] = useState('');
  const [contentUri, setContentUri] = useState<string | null>(null);
  const abortController = useRef<AbortController | null>(null);
  const speedSample = useRef({ bytes: 0, time: 0 });

  useEffect(() => () => abortController.current?.abort(), []);
  useEffect(() => {
    if (!manifest) return;
    setPhase('ready');
    setProgress(EMPTY_PROGRESS);
    setError('');
    setContentUri(null);
  }, [manifest]);

  if (!manifest) return null;

  const handleProgress = (next: AndroidUpdateDownloadProgress) => {
    const now = Date.now();
    const elapsed = now - speedSample.current.time;
    const bytesPerSecond = elapsed >= 500 && speedSample.current.time > 0
      ? Math.max(0, (next.bytesWritten - speedSample.current.bytes) / (elapsed / 1_000))
      : null;
    if (elapsed >= 500 || speedSample.current.time === 0) speedSample.current = { bytes: next.bytesWritten, time: now };
    setProgress((current) => ({ ...next, bytesPerSecond: bytesPerSecond ?? current.bytesPerSecond }));
  };

  const startDownload = async () => {
    const controller = new AbortController();
    abortController.current = controller;
    speedSample.current = { bytes: 0, time: 0 };
    setProgress(EMPTY_PROGRESS);
    setError('');
    setPhase('downloading');
    try {
      if (simulateDownload) {
        await runSimulatedDownload(controller.signal, handleProgress);
        onDismiss();
        return;
      }
      const result = await downloadAndInstallAndroidUpdate(manifest, { onProgress: handleProgress, signal: controller.signal });
      setContentUri(result.contentUri);
      if (result.status === 'permission-required') setPhase('permission');
      else onDismiss();
    } catch (cause) {
      if (controller.signal.aborted) return;
      setError(errorMessage(cause));
      setPhase('error');
    } finally {
      if (abortController.current === controller) abortController.current = null;
    }
  };

  const continueInstall = async () => {
    if (!contentUri) return void startDownload();
    try {
      const result = await installDownloadedAndroidUpdate(contentUri);
      if (result === 'started') onDismiss();
    } catch (cause) {
      setError(errorMessage(cause));
      setPhase('error');
    }
  };

  const pauseDownload = () => {
    abortController.current?.abort();
    onDismiss();
  };
  const dismiss = () => phase === 'downloading' ? pauseDownload() : onDismiss();
  const currentVersion = getCurrentAndroidVersion();
  const fraction = progress.totalBytes ? Math.min(1, progress.bytesWritten / progress.totalBytes) : progress.bytesWritten === 0 ? 0 : null;
  const remainingSeconds = progress.totalBytes && progress.bytesPerSecond
    ? Math.max(0, (progress.totalBytes - progress.bytesWritten) / progress.bytesPerSecond)
    : null;

  return (
    <Modal animationType="slide" onRequestClose={dismiss} transparent visible>
      <Pressable accessible={false} onPress={phase === 'downloading' ? undefined : dismiss} style={styles.backdrop}>
        <Pressable accessibilityRole="none" accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.sheet}>
          <View style={styles.handle} />
          {phase === 'ready' ? (
            <>
              <Text style={styles.title}>发现新版本 v{manifest.versionName}</Text>
              <Text style={styles.subtitle}>当前版本 v{currentVersion.versionName}</Text>
              <ScrollView nestedScrollEnabled style={styles.notes}><Text style={styles.notesText}>{manifest.releaseNotes || '包含体验优化与稳定性改进。'}</Text></ScrollView>
              <PrimaryButton label="立即更新" onPress={() => void startDownload()} />
              <SecondaryButton label="稍后再说" onPress={onDismiss} />
            </>
          ) : null}

          {phase === 'downloading' ? (
            <>
              <View style={styles.downloadHeader}><Text style={styles.title}>正在下载更新</Text><Text style={styles.progressPercent}>{fraction === null ? '下载中' : `${Math.round(fraction * 100)}%`}</Text></View>
              <Text style={styles.subtitle}>v{manifest.versionName}</Text>
              <View accessibilityLabel="更新下载进度" accessibilityRole="progressbar" accessibilityValue={fraction === null ? { text: '正在下载' } : { min: 0, max: 100, now: Math.round(fraction * 100) }} style={styles.progressTrack}>
                <View style={[styles.progressFill, fraction === null ? styles.progressUnknown : { width: `${fraction * 100}%` }]} />
              </View>
              <View style={styles.downloadStats}><Text numberOfLines={1} style={styles.progressMeta}>{formatProgress(progress)}</Text><Text numberOfLines={1} style={[styles.progressMeta, styles.progressMetaEnd]}>{progress.bytesPerSecond ? `${formatBytes(progress.bytesPerSecond)}/秒${remainingSeconds === null ? '' : ` · 约 ${formatDuration(remainingSeconds)}`}` : '正在计算速度'}</Text></View>
              <SecondaryButton label="暂停下载" onPress={pauseDownload} />
            </>
          ) : null}

          {phase === 'permission' ? (
            <>
              <Text style={styles.title}>需要安装权限</Text>
              <Text style={styles.phaseText}>请允许“仍在”安装未知应用，返回后继续安装。无需重新下载。</Text>
              <PrimaryButton label="我已允许，继续安装" onPress={() => void continueInstall()} />
              <SecondaryButton label="稍后处理" onPress={onDismiss} />
            </>
          ) : null}

          {phase === 'error' ? (
            <>
              <Text style={styles.title}>更新失败</Text>
              <Text style={styles.errorText}>{error}</Text>
              <PrimaryButton label="继续下载" onPress={() => void startDownload()} />
              <SecondaryButton label="关闭" onPress={onDismiss} />
            </>
          ) : null}

        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PrimaryButton({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}><Text style={styles.primaryButtonText}>{label}</Text></Pressable>;
}

function SecondaryButton({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.secondaryButton, pressed && styles.buttonPressed]}><Text style={styles.secondaryButtonText}>{label}</Text></Pressable>;
}

function formatProgress(progress: ProgressView) {
  if (!progress.totalBytes) return `${formatBytes(progress.bytesWritten)} 已下载`;
  return `${formatBytes(progress.bytesWritten)} / ${formatBytes(progress.totalBytes)}`;
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${Math.round(bytes)} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

function formatDuration(seconds: number) {
  if (seconds < 60) return `${Math.max(1, Math.round(seconds))} 秒`;
  return `${Math.ceil(seconds / 60)} 分钟`;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : '请检查网络后重试。';
}

function runSimulatedDownload(signal: AbortSignal, onProgress: (progress: AndroidUpdateDownloadProgress) => void) {
  const totalBytes = 42 * 1_048_576;
  const startedAt = Date.now();
  return new Promise<void>((resolve, reject) => {
    const tick = () => {
      if (signal.aborted) {
        const error = new Error('下载已取消');
        error.name = 'AbortError';
        reject(error);
        return;
      }
      const fraction = Math.min(1, (Date.now() - startedAt) / 5_000);
      onProgress({ bytesWritten: Math.round(totalBytes * fraction), totalBytes });
      if (fraction === 1) resolve();
      else setTimeout(tick, 120);
    };
    tick();
  });
}

const styles = createThemedStyles(() => ({
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  sheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOffset: { width: 0, height: -8 }, shadowOpacity: 0.16, shadowRadius: 24, elevation: 20 },
  handle: { width: 36, height: 4, marginTop: spacing.md, marginBottom: spacing.md, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  subtitle: { marginTop: 5, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  notes: { maxHeight: 92, marginTop: spacing.lg },
  notesText: { color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19 },
  primaryButton: { minHeight: 50, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  primaryButtonText: { color: colors.onLife, fontSize: typography.size.label, fontWeight: '700' },
  secondaryButton: { minHeight: 42, marginTop: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  secondaryButtonText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '600' },
  buttonPressed: { opacity: 0.76, transform: [{ scale: 0.98 }] },
  downloadHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  progressPercent: { color: colors.life, fontFamily: typography.mono, fontSize: 16, fontWeight: '700' },
  progressMeta: { flexShrink: 1, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta },
  progressMetaEnd: { textAlign: 'right' },
  progressTrack: { height: 8, marginTop: spacing.lg, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: colors.lifeLight },
  progressFill: { height: '100%', alignSelf: 'flex-start', borderRadius: 4, backgroundColor: colors.life },
  progressUnknown: { width: '34%', opacity: 0.72 },
  downloadStats: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm, justifyContent: 'space-between' },
  phaseText: { marginTop: spacing.md, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19 },
  errorText: { marginTop: spacing.md, color: colors.danger, fontSize: typography.size.caption, lineHeight: 18 },
}));
