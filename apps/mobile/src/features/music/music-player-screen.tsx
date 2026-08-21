import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Easing, Image, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Media, MusicPlaybackMode, MusicTrack } from '@still-alive/types';
import { useMusicPlayer } from './music-player-state';
import type { MusicQueueSource } from './music-player-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { useAppState } from '../../application/state/app-state';
import { MusicCover } from './music-cover';

type QueueSourceControl = MusicQueueSource | 'people';

const SOURCES: Array<{ id: QueueSourceControl; label: string }> = [
  { id: 'all', label: '全部' },
  { id: 'self', label: '我的音乐' },
  { id: 'people', label: '人物喜欢' },
];

const RECORD_ROTATION_DURATION = 16000;
const TONEARM_ANIMATION_DURATION = 380;
const QUEUE_SHEET_ENTRY_OFFSET = 520;
const QUEUE_SHEET_DISMISS_THRESHOLD = 110;
const QUEUE_SHEET_ANIMATION_DURATION = 240;

export default function MusicPlayerScreen() {
  const router = useRouter();
  const window = useWindowDimensions();
  const { queue: queueParam } = useLocalSearchParams<{ queue?: string }>();
  const player = useMusicPlayer();
  const { media } = useAppState();
  const [queueOpen, setQueueOpen] = useState(queueParam === '1');
  const [progressWidth, setProgressWidth] = useState(1);
  const current = player.currentTrack;
  const duration = player.duration || (current?.durationMs ?? 0) / 1000;
  const progress = duration ? Math.min(1, player.currentTime / duration) : 0;
  const mode = playbackModePresentation(player.mode);
  const currentQueueIndex = current ? player.queue.findIndex((track) => track.id === current.id) : -1;
  const recordScale = Math.min(
    1,
    Math.max(0.78, 0.78 + (window.height - 640) * 0.001375),
    Math.max(0.72, (window.width - spacing.xl * 2) / 274),
  );

  useEffect(() => {
    if (queueParam === '1') setQueueOpen(true);
  }, [queueParam]);

  useEffect(() => {
    if (!current && player.queue.length === 0) player.setQueueSource(player.queueSource);
  }, [current, player.queue.length, player.queueSource, player.setQueueSource]);

  const selectTrack = (track: MusicTrack) => {
    const sourceId = player.queueSource === 'person' ? player.queuePersonId : player.queueSource === 'playlist' ? player.queuePlaylistId : null;
    void player.playTrack(track.id, player.queue.map((item) => item.id), player.queueSource, sourceId);
  };

  const minimize = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/music-box' as RelativePathString);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <View style={styles.headerSide}><Pressable accessibilityLabel="最小化播放器" onPress={minimize} style={styles.headerButton}><SymbolView name={{ android: 'keyboard_arrow_down', ios: 'chevron.down', web: 'keyboard_arrow_down' }} size={24} tintColor={colors.inkSoft} type="hierarchical" /></Pressable></View>
        <View style={styles.headerCopy}><Text style={styles.headerTitle}>播放详情</Text><Text numberOfLines={1} style={styles.headerMeta}>{current ? currentQueueIndex >= 0 ? `${currentQueueIndex + 1} / ${player.queue.length}` : '当前曲目' : '未开始播放'}</Text></View>
        <View style={styles.headerSide} />
      </View>

      {current ? (
        <View style={styles.playerBody}>
          <View style={styles.recordArea}><RecordPlayer cover={media.find((item) => item.id === current.coverMediaId)} playing={player.playing} scale={recordScale} /></View>
          <View style={styles.controlPanel}>
            <View style={styles.trackIdentity}><Text numberOfLines={2} style={styles.title}>{current.title}</Text><Text numberOfLines={1} style={styles.artist}>{current.artist || '未知艺术家'}{current.album ? ` / ${current.album}` : ''}</Text></View>

            <View style={styles.timeline}>
              <Pressable accessibilityRole="adjustable" onLayout={(event) => setProgressWidth(event.nativeEvent.layout.width)} onPress={(event) => { if (duration) void player.seekTo(duration * Math.max(0, Math.min(1, event.nativeEvent.locationX / progressWidth))); }} style={styles.progressTrack}>
                <View style={styles.progressRail}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%` }]}><View style={styles.progressThumb} /></View>
                </View>
              </Pressable>
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
        </View>
      ) : (
        <View style={styles.empty}>
          <MusicCover size={96} style={styles.emptyDisc} />
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
  const { media, musicCollectionEntries, musicTracks, people } = useAppState();
  const [selectingPerson, setSelectingPerson] = useState(false);
  const playableTrackIds = useMemo(() => {
    const mediaIds = new Set(media.map((item) => item.id));
    return new Set(musicTracks.filter((track) => mediaIds.has(track.mediaId)).map((track) => track.id));
  }, [media, musicTracks]);
  const peopleWithMusic = useMemo(() => people.map((person) => ({
    person,
    count: new Set(musicCollectionEntries.filter((entry) => entry.targetType === 'person' && entry.targetId === person.id && playableTrackIds.has(entry.trackId)).map((entry) => entry.trackId)).size,
  })).filter((item) => item.count > 0), [musicCollectionEntries, people, playableTrackIds]);
  const selectedPerson = people.find((person) => person.id === player.queuePersonId) ?? null;
  const sources: Array<{ id: QueueSourceControl; label: string }> = player.queuePlaylistId
    ? [{ id: 'playlist', label: '当前歌单' }, ...SOURCES]
    : SOURCES;
  const translateY = useRef(new Animated.Value(0)).current;
  const dismissing = useRef(false);

  useEffect(() => {
    if (!open) return;
    setSelectingPerson(false);
    dismissing.current = false;
    translateY.setValue(QUEUE_SHEET_ENTRY_OFFSET);
    Animated.timing(translateY, {
      toValue: 0,
      duration: QUEUE_SHEET_ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [open, translateY]);

  const dismiss = useCallback(() => {
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.timing(translateY, {
      toValue: QUEUE_SHEET_ENTRY_OFFSET,
      duration: QUEUE_SHEET_ANIMATION_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [onClose, translateY]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderGrant: () => {
      translateY.stopAnimation();
    },
    onPanResponderMove: (_, gesture) => {
      translateY.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > QUEUE_SHEET_DISMISS_THRESHOLD || gesture.vy > 0.85) {
        dismiss();
        return;
      }
      Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
    },
  }), [dismiss, translateY]);

  const selectSource = (source: QueueSourceControl) => {
    if (source === 'people') {
      setSelectingPerson(true);
      return;
    }
    setSelectingPerson(false);
    player.setQueueSource(source);
  };

  const selectPerson = (personId: string) => {
    player.setQueueSource('person', personId);
    setSelectingPerson(false);
  };

  return (
    <Modal animationType="fade" onRequestClose={dismiss} transparent visible={open}>
      <Pressable onPress={dismiss} style={styles.backdrop}>
        <Animated.View style={[styles.queueSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md), transform: [{ translateY }] }]}>
          <Pressable accessibilityLabel="播放队列" accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.queueSheetTouch}>
            <View {...pan.panHandlers} style={styles.queueGrabber}><View style={styles.handle} /></View>
            <View style={styles.queueHeader}>
              {selectingPerson ? <Pressable accessibilityLabel="返回播放队列" onPress={() => setSelectingPerson(false)} style={styles.queueBack}><SymbolView name={{ android: 'arrow_back', ios: 'chevron.left', web: 'arrow_back' }} size={20} tintColor={colors.inkSoft} type="hierarchical" /></Pressable> : null}
              <View style={styles.queueHeaderCopy}><Text style={styles.queueTitle}>{selectingPerson ? '选择人物' : selectedPerson && player.queueSource === 'person' ? `${selectedPerson.name}喜欢的音乐` : '播放队列'}</Text><Text style={styles.queueCount}>{selectingPerson ? `${peopleWithMusic.length} 个人物有收藏` : `${player.queue.length} 首`}</Text></View>
            </View>
            {selectingPerson ? (
              <ScrollView contentContainerStyle={styles.peopleContent} style={styles.queueList}>
                {peopleWithMusic.map(({ person, count }) => {
                  const avatar = person.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
                  const selected = person.id === player.queuePersonId;
                  return <Pressable key={person.id} accessibilityLabel={`查看${person.name}喜欢的音乐`} accessibilityState={{ selected }} onPress={() => selectPerson(person.id)} style={({ pressed }) => [styles.personChoice, selected && styles.personChoiceSelected, pressed && styles.pressed]}><View style={styles.personAvatar}>{avatar ? <Image resizeMode="cover" source={{ uri: avatar.localPath }} style={styles.personAvatarImage} /> : <Text style={styles.personAvatarText}>{person.name.slice(0, 1)}</Text>}</View><View style={styles.personChoiceCopy}><Text numberOfLines={1} style={[styles.personChoiceName, selected && styles.personChoiceNameSelected]}>{person.name}</Text><Text style={styles.personChoiceMeta}>{count} 首喜欢的音乐</Text></View><SymbolView name={{ android: selected ? 'check' : 'chevron_right', ios: selected ? 'checkmark' : 'chevron.right', web: selected ? 'check' : 'chevron_right' }} size={18} tintColor={selected ? colors.life : colors.inkFaint} type="hierarchical" /></Pressable>;
                })}
                {peopleWithMusic.length === 0 ? <View style={styles.queueEmpty}><Text style={styles.emptyText}>还没有人物收藏音乐</Text></View> : null}
              </ScrollView>
            ) : (
              <>
                <View style={styles.sources}>{sources.map((source) => {
                  const selected = source.id === 'people' ? player.queueSource === 'person' : player.queueSource === source.id;
                  return <Pressable key={source.id} accessibilityState={{ selected }} onPress={() => selectSource(source.id)} style={[styles.source, selected && styles.sourceActive]}><Text style={[styles.sourceText, selected && styles.sourceTextActive]}>{source.label}</Text></Pressable>;
                })}</View>
                <ScrollView contentContainerStyle={styles.queueContent} style={styles.queueList}>{player.queue.map((track, index) => <Pressable key={track.id} onPress={() => onSelect(track)} style={({ pressed }) => [styles.queueRow, pressed && styles.pressed]}><View style={styles.queueState}><Text style={styles.queueIndex}>{index + 1}</Text></View><MusicCover media={media.find((item) => item.id === track.coverMediaId)} size={42} style={styles.queueCover} /><View style={styles.queueCopy}><Text numberOfLines={1} style={[styles.queueTrackTitle, track.id === currentTrackId && styles.queueTrackTitleActive]}>{track.title}</Text><Text numberOfLines={1} style={styles.queueTrackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text></View></Pressable>)}{player.queue.length === 0 ? <View style={styles.queueEmpty}><Text style={styles.emptyText}>当前来源没有音乐</Text></View> : null}</ScrollView>
              </>
            )}
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function RecordPlayer({ cover, playing, scale }: { cover?: Media | null; playing: boolean; scale: number }) {
  const rotation = useRef(new Animated.Value(0)).current;
  const animationRef = useRef<Animated.CompositeAnimation | null>(null);
  const tonearmPose = useRef(new Animated.Value(playing ? 1 : 0)).current;

  useEffect(() => {
    let mounted = true;
    const spin = (from: number) => {
      if (!mounted) return;
      const duration = Math.max(220, Math.round((1 - from) * RECORD_ROTATION_DURATION));
      rotation.setValue(from);
      const animation = Animated.timing(rotation, { toValue: 1, duration, easing: Easing.linear, useNativeDriver: true });
      animationRef.current = animation;
      animation.start(({ finished }) => {
        if (!mounted || !finished) return;
        rotation.setValue(0);
        spin(0);
      });
    };

    if (playing) {
      rotation.stopAnimation((value) => spin(value % 1));
    } else {
      animationRef.current?.stop();
      rotation.stopAnimation();
    }
    return () => {
      mounted = false;
      animationRef.current?.stop();
      rotation.stopAnimation();
    };
  }, [playing, rotation]);

  useEffect(() => {
    Animated.timing(tonearmPose, {
      toValue: playing ? 1 : 0,
      duration: TONEARM_ANIMATION_DURATION,
      easing: Easing.inOut(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [playing, tonearmPose]);

  const recordRotation = rotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  // The pivot is at the top-right of the assembly. Keep it stationary while
  // the arm swings down-right when playback is paused.
  const tonearmRotation = tonearmPose.interpolate({ inputRange: [0, 1], outputRange: ['-58deg', '0deg'] });
  const tonearmOpacity = tonearmPose.interpolate({ inputRange: [0, 1], outputRange: [0.68, 1] });
  return (
    <View style={[styles.recordViewport, { width: 274 * scale, height: 270 * scale }]}>
      <View style={[styles.recordStage, { transform: [{ scale }] }]}>
        <Animated.View style={[styles.record, { transform: [{ rotate: recordRotation }] }]}>
          <View pointerEvents="none" style={styles.recordShine} />
          <View pointerEvents="none" style={styles.recordGrooveOuter} />
          <View pointerEvents="none" style={styles.recordGrooveWide} />
          <View pointerEvents="none" style={styles.recordGrooveMiddle} />
          <View pointerEvents="none" style={styles.recordGrooveInner} />
          <View style={styles.recordRing}>
            <View style={styles.recordLabel}>
              <MusicCover media={cover} size={76} style={styles.recordCover} />
              <View style={styles.recordLabelRim}>
                <View style={styles.recordHole} />
              </View>
            </View>
          </View>
        </Animated.View>
        <View pointerEvents="none" style={styles.tonearm}>
          <Animated.View style={[styles.tonearmAssembly, { opacity: tonearmOpacity, transform: [{ rotate: tonearmRotation }] }]}>
            <View style={styles.tonearmPivot} />
            <View style={styles.tonearmArm} />
            <View style={styles.tonearmHead}><View style={styles.tonearmNeedle} /></View>
          </Animated.View>
        </View>
      </View>
    </View>
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
  headerSide: { width: 88, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCopy: { flex: 1, alignItems: 'center' },
  headerTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  headerMeta: { marginTop: 2, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  playerBody: { flex: 1, paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, alignItems: 'center' },
  recordArea: { flex: 1, minHeight: 218, width: '100%', alignItems: 'center', justifyContent: 'center' },
  recordViewport: { alignItems: 'center', justifyContent: 'center' },
  recordStage: { width: 274, height: 270, alignItems: 'center', justifyContent: 'center' },
  record: { width: 246, height: 246, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 123, backgroundColor: colors.codeBackground, shadowColor: colors.ink, shadowOpacity: 0.2, shadowRadius: 20, elevation: 8 },
  recordShine: { position: 'absolute', top: -20, left: 65, width: 116, height: 286, borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', transform: [{ rotate: '-28deg' }] },
  recordGrooveOuter: { position: 'absolute', top: 10, left: 10, width: 226, height: 226, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.12)', borderRadius: 113 },
  recordGrooveWide: { position: 'absolute', top: 19, left: 19, width: 208, height: 208, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.07)', borderRadius: 104 },
  recordGrooveMiddle: { position: 'absolute', top: 29, left: 29, width: 188, height: 188, borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.11)', borderRadius: 94 },
  recordGrooveInner: { position: 'absolute', top: 41, left: 41, width: 164, height: 164, borderWidth: 1, borderColor: 'rgba(0, 0, 0, 0.34)', borderRadius: 82 },
  recordRing: { width: 178, height: 178, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.onLifeLine, borderRadius: 89 },
  recordLabel: { width: 88, height: 88, alignItems: 'center', justifyContent: 'center', borderRadius: 44, backgroundColor: colors.life },
  recordCover: { position: 'absolute', borderRadius: 38, opacity: 0.92 },
  recordLabelRim: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.onLifeLine, borderRadius: 36 },
  recordHole: { position: 'absolute', top: 32, left: 32, width: 8, height: 8, borderWidth: 2, borderColor: colors.onLife, borderRadius: 4, backgroundColor: colors.codeBackground },
  tonearm: { position: 'absolute', top: 5, right: 3, width: 94, height: 150 },
  tonearmAssembly: { position: 'absolute', top: 0, right: 0, width: 94, height: 150, transformOrigin: [81.5, 12.5, 0] },
  tonearmPivot: { position: 'absolute', top: 3, right: 3, width: 19, height: 19, borderWidth: 3, borderColor: colors.inkSoft, borderRadius: 10, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 3, elevation: 2 },
  tonearmArm: { position: 'absolute', top: 34, right: 3, width: 75, height: 6, borderRadius: 3, backgroundColor: colors.inkSoft, transform: [{ rotate: '-43deg' }] },
  tonearmHead: { position: 'absolute', top: 57, right: 65, width: 23, height: 13, borderRadius: 3, backgroundColor: colors.ink, transform: [{ rotate: '-43deg' }] },
  tonearmNeedle: { position: 'absolute', bottom: -7, left: 10, width: 2, height: 9, backgroundColor: colors.life },
  controlPanel: { width: '100%', maxWidth: 480, alignItems: 'center' },
  trackIdentity: { width: '100%', minHeight: 62, alignItems: 'center', justifyContent: 'center' },
  title: { maxWidth: '100%', color: colors.ink, fontFamily: typography.display, fontSize: 24, lineHeight: 31, textAlign: 'center' },
  artist: { maxWidth: '100%', marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  timeline: { width: '100%', marginTop: spacing.md },
  progressTrack: { width: '100%', height: 24, justifyContent: 'center' },
  progressRail: { width: '100%', height: 5, justifyContent: 'center', borderRadius: 3, backgroundColor: colors.line },
  progressFill: { height: 5, minWidth: 4, justifyContent: 'center', alignItems: 'flex-end', borderRadius: 3, backgroundColor: colors.life },
  progressThumb: { width: 14, height: 14, marginRight: -7, borderWidth: 2, borderColor: colors.sheet, borderRadius: 7, backgroundColor: colors.life, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 3, elevation: 2 },
  timeRow: { marginTop: 2, flexDirection: 'row', justifyContent: 'space-between' },
  timeText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10 },
  controls: { width: '100%', marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  utilityButton: { width: 42, height: 48, alignItems: 'center', justifyContent: 'center' },
  transportButton: { width: 52, height: 56, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, backgroundColor: colors.life },
  modeLabel: { minHeight: 18, marginTop: spacing.xs, color: colors.inkFaint, fontSize: 10 },
  pressed: { opacity: 0.58 },
  error: { width: '100%', minHeight: 42, marginTop: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.sm, backgroundColor: colors.dangerLight },
  errorText: { flex: 1, color: colors.danger, fontSize: 10 },
  errorAction: { marginLeft: spacing.md, color: colors.danger, fontSize: 10, fontWeight: '700' },
  empty: { flex: 1, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  emptyDisc: { borderRadius: 48 },
  emptyTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 18, textAlign: 'center' },
  emptyActions: { marginTop: spacing.lg, flexDirection: 'row', gap: spacing.sm },
  emptyPrimary: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  emptyPrimaryText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  emptySecondary: { minHeight: 44, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md },
  emptySecondaryText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  queueSheet: { maxHeight: '78%', paddingTop: spacing.md, paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  queueSheetTouch: { flexShrink: 1 },
  queueGrabber: { minHeight: 24, alignItems: 'center', justifyContent: 'center' },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  queueHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center' },
  queueBack: { width: 40, height: 44, marginLeft: -spacing.sm, alignItems: 'center', justifyContent: 'center' },
  queueHeaderCopy: { flex: 1, minWidth: 0 },
  queueTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  queueCount: { marginTop: 3, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  sources: { marginTop: spacing.sm, padding: 3, flexDirection: 'row', borderRadius: radius.md, backgroundColor: colors.paper },
  source: { flex: 1, minHeight: 38, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  sourceActive: { backgroundColor: colors.sheet },
  sourceText: { color: colors.inkFaint, fontSize: 10 },
  sourceTextActive: { color: colors.life, fontWeight: '700' },
  queueList: { marginTop: spacing.md },
  queueContent: { paddingBottom: spacing.md },
  queueRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  queueState: { width: 38, alignItems: 'center', justifyContent: 'center' },
  queueIndex: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  queueCover: { marginRight: spacing.sm, borderRadius: radius.sm },
  queueCopy: { flex: 1, minWidth: 0, paddingRight: spacing.md },
  queueTrackTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  queueTrackTitleActive: { color: colors.life },
  queueTrackMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  queueEmpty: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  peopleContent: { paddingBottom: spacing.md },
  personChoice: { minHeight: 66, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  personChoiceSelected: { backgroundColor: colors.lifeLight },
  personAvatar: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 22, backgroundColor: colors.lifeLight },
  personAvatarImage: { width: '100%', height: '100%' },
  personAvatarText: { color: colors.life, fontFamily: typography.display, fontSize: 17 },
  personChoiceCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  personChoiceName: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  personChoiceNameSelected: { color: colors.life },
  personChoiceMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
}));
