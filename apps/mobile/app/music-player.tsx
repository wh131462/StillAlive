import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { MusicPlaybackMode, MusicTrack } from '@still-alive/types';
import { useMusicPlayer } from '../src/state/music-player';
import type { MusicQueueSource } from '../src/state/music-player';
import { createThemedStyles } from '../src/theme/app-theme';

const SOURCES: Array<{ id: MusicQueueSource; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'self', label: '我的音乐' },
  { id: 'people', label: '人物喜欢' },
];

export default function MusicPlayerScreen() {
  const router = useRouter();
  const { queue: queueParam } = useLocalSearchParams<{ queue?: string }>();
  const player = useMusicPlayer();
  const [queueOpen, setQueueOpen] = useState(queueParam === '1');
  const [progressWidth, setProgressWidth] = useState(1);
  const current = player.currentTrack;
  const duration = player.duration || (current?.durationMs ?? 0) / 1000;
  const progress = duration ? Math.min(1, player.currentTime / duration) : 0;
  const mode = playbackModePresentation(player.mode);
  const currentQueueIndex = current ? player.queue.findIndex((track) => track.id === current.id) : -1;

  useEffect(() => {
    if (queueParam === '1') setQueueOpen(true);
  }, [queueParam]);

  useEffect(() => {
    if (!current && player.queue.length === 0) player.setQueueSource(player.queueSource);
  }, [current, player.queue.length, player.queueSource, player.setQueueSource]);

  const selectTrack = (track: MusicTrack) => {
    void player.playTrack(track.id, player.queue.map((item) => item.id), player.queueSource);
  };

  const minimize = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/music-box' as RelativePathString);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="最小化播放器" onPress={minimize} style={styles.headerButton}><SymbolView name={{ android: 'keyboard_arrow_down', ios: 'chevron.down', web: 'keyboard_arrow_down' }} size={24} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>播放详情</Text><Text numberOfLines={1} style={styles.headerMeta}>{current ? currentQueueIndex >= 0 ? `${currentQueueIndex + 1} / ${player.queue.length}` : '当前曲目' : '未开始播放'}</Text></View>
        <Pressable accessibilityLabel="打开播放队列" onPress={() => setQueueOpen(true)} style={styles.headerButton}><SymbolView name={{ android: 'queue_music', ios: 'list.bullet', web: 'queue_music' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      </View>

      {current ? (
        <View style={styles.playerBody}>
          <View style={styles.record}><View style={styles.recordRing}><View style={styles.recordLabel}><SymbolView name={{ android: 'music_note', ios: 'music.note', web: 'music_note' }} size={34} tintColor={colors.onLife} type="hierarchical" /></View></View></View>
          <View style={styles.trackIdentity}><Text numberOfLines={2} style={styles.title}>{current.title}</Text><Text numberOfLines={1} style={styles.artist}>{current.artist || '未知艺术家'}{current.album ? ` · ${current.album}` : ''}</Text></View>

          <View style={styles.timeline}>
            <Pressable accessibilityRole="adjustable" onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)} onPress={(event) => { if (duration) void player.seekTo(duration * Math.max(0, Math.min(1, event.nativeEvent.locationX / progressWidth))); }} style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%` }]}><View style={styles.progressThumb} /></View></Pressable>
            <View style={styles.timeRow}><Text style={styles.timeText}>{formatTime(player.currentTime)}</Text><Text style={styles.timeText}>{formatTime(duration)}</Text></View>
          </View>

          {player.error ? <Pressable onPress={() => void player.next()} style={styles.error}><Text style={styles.errorText}>{player.error}</Text><Text style={styles.errorAction}>跳过</Text></Pressable> : null}

          <View style={styles.controls}>
            <PlayerIcon accessibilityLabel={mode.label} icon={mode.icon} onPress={() => void player.setMode(nextPlaybackMode(player.mode))} />
            <PlayerIcon accessibilityLabel="上一首" icon={{ android: 'skip_previous', ios: 'backward.end.fill', web: 'skip_previous' }} large onPress={() => void player.previous()} />
            <Pressable accessibilityLabel={player.playing ? '暂停' : '播放'} onPress={player.toggle} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}><SymbolView name={{ android: player.playing ? 'pause' : 'play_arrow', ios: player.playing ? 'pause.fill' : 'play.fill', web: player.playing ? 'pause' : 'play_arrow' }} size={32} tintColor={colors.onLife} type="hierarchical" /></Pressable>
            <PlayerIcon accessibilityLabel="下一首" icon={{ android: 'skip_next', ios: 'forward.end.fill', web: 'skip_next' }} large onPress={() => void player.next()} />
            <PlayerIcon accessibilityLabel="播放队列" icon={{ android: 'queue_music', ios: 'list.bullet', web: 'queue_music' }} onPress={() => setQueueOpen(true)} />
          </View>
          <Text style={styles.modeLabel}>{mode.label}</Text>
        </View>
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyDisc}><SymbolView name={{ android: 'music_note', ios: 'music.note', web: 'music_note' }} size={34} tintColor={colors.life} type="hierarchical" /></View>
          <Text style={styles.emptyTitle}>还没有正在播放的音乐</Text>
          <Text style={styles.emptyText}>从播放队列选择一首，或返回音乐盒开始播放。</Text>
          <View style={styles.emptyActions}><Pressable onPress={() => setQueueOpen(true)} style={styles.emptyPrimary}><Text style={styles.emptyPrimaryText}>打开队列</Text></Pressable><Pressable onPress={() => router.replace('/music-box' as RelativePathString)} style={styles.emptySecondary}><Text style={styles.emptySecondaryText}>返回音乐盒</Text></Pressable></View>
        </View>
      )}

      <QueueSheet currentTrackId={current?.id ?? null} onClose={() => setQueueOpen(false)} onSelect={selectTrack} open={queueOpen} />
    </SafeAreaView>
  );
}

function QueueSheet({ currentTrackId, onClose, onSelect, open }: { currentTrackId: string | null; onClose(): void; onSelect(track: MusicTrack): void; open: boolean }) {
  const insets = useSafeAreaInsets();
  const player = useMusicPlayer();
  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={open}>
      <Pressable onPress={onClose} style={styles.backdrop}>
        <Pressable accessibilityLabel="播放队列" accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={[styles.queueSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
          <View style={styles.handle} />
          <View style={styles.queueHeader}><View><Text style={styles.queueTitle}>播放队列</Text><Text style={styles.queueCount}>{player.queue.length} 首</Text></View><Pressable accessibilityLabel="关闭播放队列" onPress={onClose} style={styles.queueClose}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={19} tintColor={colors.inkSoft} type="hierarchical" /></Pressable></View>
          <View style={styles.sources}>{SOURCES.map((source) => <Pressable key={source.id} accessibilityState={{ selected: player.queueSource === source.id }} onPress={() => player.setQueueSource(source.id)} style={[styles.source, player.queueSource === source.id && styles.sourceActive]}><Text style={[styles.sourceText, player.queueSource === source.id && styles.sourceTextActive]}>{source.label}</Text></Pressable>)}</View>
          <ScrollView contentContainerStyle={styles.queueContent} style={styles.queueList}>{player.queue.map((track) => <Pressable key={track.id} onPress={() => onSelect(track)} style={({ pressed }) => [styles.queueRow, track.id === currentTrackId && styles.queueRowActive, pressed && styles.pressed]}><View style={styles.queueState}>{track.id === currentTrackId ? <SymbolView name={{ android: player.playing ? 'graphic_eq' : 'pause', ios: player.playing ? 'waveform' : 'pause.fill', web: player.playing ? 'graphic_eq' : 'pause' }} size={17} tintColor={colors.life} type="hierarchical" /> : <SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={15} tintColor={colors.inkFaint} type="hierarchical" />}</View><View style={styles.queueCopy}><Text numberOfLines={1} style={[styles.queueTrackTitle, track.id === currentTrackId && styles.queueTrackTitleActive]}>{track.title}</Text><Text numberOfLines={1} style={styles.queueTrackMeta}>{track.artist || '未知艺术家'}{track.album ? ` · ${track.album}` : ''}</Text></View></Pressable>)}{player.queue.length === 0 ? <View style={styles.queueEmpty}><Text style={styles.emptyText}>当前来源没有音乐</Text></View> : null}</ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function PlayerIcon({ accessibilityLabel, icon, large = false, onPress }: { accessibilityLabel: string; icon: ComponentProps<typeof SymbolView>['name']; large?: boolean; onPress(): void }) {
  return <Pressable accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [large ? styles.transportButton : styles.utilityButton, pressed && styles.pressed]}><SymbolView name={icon} size={large ? 28 : 21} tintColor={large ? colors.ink : colors.inkSoft} type="hierarchical" /></Pressable>;
}

function nextPlaybackMode(mode: MusicPlaybackMode): MusicPlaybackMode {
  return mode === 'list' ? 'shuffle' : mode === 'shuffle' ? 'single' : 'list';
}

function playbackModePresentation(mode: MusicPlaybackMode): { icon: ComponentProps<typeof SymbolView>['name']; label: string } {
  if (mode === 'shuffle') return { icon: { android: 'shuffle', ios: 'shuffle', web: 'shuffle' }, label: '随机播放' };
  if (mode === 'single') return { icon: { android: 'repeat_one', ios: 'repeat.1', web: 'repeat_one' }, label: '单曲循环' };
  return { icon: { android: 'repeat', ios: 'repeat', web: 'repeat' }, label: '列表循环' };
}

function formatTime(value: number) {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => ({
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 58, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  headerMeta: { marginTop: 2, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  playerBody: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, alignItems: 'center', justifyContent: 'space-evenly' },
  record: { width: 246, height: 246, alignItems: 'center', justifyContent: 'center', borderRadius: 123, backgroundColor: colors.codeBackground, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 18, elevation: 7 },
  recordRing: { width: 172, height: 172, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.onLifeLine, borderRadius: 86 },
  recordLabel: { width: 82, height: 82, alignItems: 'center', justifyContent: 'center', borderRadius: 41, backgroundColor: colors.life },
  trackIdentity: { width: '100%', alignItems: 'center' },
  title: { maxWidth: '100%', color: colors.ink, fontFamily: typography.display, fontSize: 25, lineHeight: 34, textAlign: 'center' },
  artist: { maxWidth: '100%', marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  timeline: { width: '100%' },
  progressTrack: { width: '100%', height: 20, justifyContent: 'center' },
  progressFill: { height: 4, minWidth: 4, justifyContent: 'center', alignItems: 'flex-end', borderRadius: 2, backgroundColor: colors.life },
  progressThumb: { width: 12, height: 12, marginRight: -6, borderRadius: 6, backgroundColor: colors.life },
  timeRow: { marginTop: 2, flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  controls: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  utilityButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  transportButton: { width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, backgroundColor: colors.life },
  modeLabel: { marginTop: -spacing.md, color: colors.inkFaint, fontSize: 9 },
  pressed: { opacity: 0.58 },
  error: { width: '100%', minHeight: 42, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.sm, backgroundColor: colors.dangerLight },
  errorText: { flex: 1, color: colors.danger, fontSize: 10 },
  errorAction: { marginLeft: spacing.md, color: colors.danger, fontSize: 10, fontWeight: '700' },
  empty: { flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  emptyDisc: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', borderRadius: 48, backgroundColor: colors.lifeLight },
  emptyTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  emptyActions: { marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  emptyPrimary: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  emptyPrimaryText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  emptySecondary: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md },
  emptySecondaryText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  queueSheet: { maxHeight: '78%', paddingTop: spacing.md, paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  handle: { width: 36, height: 4, marginBottom: spacing.md, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line },
  queueHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  queueTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  queueCount: { marginTop: 3, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  queueClose: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  sources: { marginTop: spacing.sm, padding: 3, flexDirection: 'row', borderRadius: radius.md, backgroundColor: colors.paper },
  source: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  sourceActive: { backgroundColor: colors.sheet },
  sourceText: { color: colors.inkFaint, fontSize: 10 },
  sourceTextActive: { color: colors.life, fontWeight: '700' },
  queueList: { marginTop: spacing.md },
  queueContent: { paddingBottom: spacing.md },
  queueRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  queueRowActive: { backgroundColor: colors.lifeLight },
  queueState: { width: 38, alignItems: 'center', justifyContent: 'center' },
  queueCopy: { flex: 1, minWidth: 0, paddingRight: spacing.md },
  queueTrackTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  queueTrackTitleActive: { color: colors.life },
  queueTrackMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  queueEmpty: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
}));
