import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Dimensions, PanResponder, Pressable, Text, View } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import type { MusicPlaybackMode, MusicTrack } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from './app-state';
import { createThemedStyles } from '../theme/app-theme';

export type MusicQueueSource = 'all' | 'self' | 'people';

interface MusicPlayerValue {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  queueSource: MusicQueueSource;
  playing: boolean;
  currentTime: number;
  duration: number;
  mode: MusicPlaybackMode;
  error: string | null;
  playTrack(trackId: string, queueTrackIds: string[], source: MusicQueueSource): Promise<void>;
  setQueueSource(source: MusicQueueSource): void;
  toggle(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  setMode(mode: MusicPlaybackMode): Promise<void>;
  close(): void;
}

const MusicPlayerContext = createContext<MusicPlayerValue | null>(null);

export function MusicPlayerProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { media, musicCollectionEntries, musicTracks, preferences, updatePreferences } = useAppState();
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([]);
  const [queueSource, setQueueSourceState] = useState<MusicQueueSource>('all');
  const [mode, setModeState] = useState<MusicPlaybackMode>('list');
  const [error, setError] = useState<string | null>(null);
  const shuffleRemainingRef = useRef<string[]>([]);
  const shuffleHistoryRef = useRef<string[]>([]);
  const playing = Boolean(status.playing);

  const playableTracks = useMemo(() => musicTracks.filter((track) => media.some((item) => item.id === track.mediaId)), [media, musicTracks]);
  const playableTrackIds = useMemo(() => new Set(playableTracks.map((track) => track.id)), [playableTracks]);
  const trackIdsBySource = useMemo(() => {
    const selfIds = new Set(musicCollectionEntries.filter((entry) => entry.targetType === 'self').map((entry) => entry.trackId));
    const peopleIds = new Set(musicCollectionEntries.filter((entry) => entry.targetType === 'person').map((entry) => entry.trackId));
    const select = (ids: Set<string>) => playableTracks.filter((track) => ids.has(track.id)).map((track) => track.id);
    return { all: select(new Set([...selfIds, ...peopleIds])), self: select(selfIds), people: select(peopleIds) };
  }, [musicCollectionEntries, playableTracks]);
  const validQueueTrackIds = useMemo(() => queueTrackIds.filter((id) => playableTrackIds.has(id)), [playableTrackIds, queueTrackIds]);
  const currentTrack = useMemo(() => playableTracks.find((track) => track.id === currentTrackId) ?? null, [currentTrackId, playableTracks]);
  const queue = useMemo(() => validQueueTrackIds.map((id) => playableTracks.find((track) => track.id === id)).filter((track): track is MusicTrack => Boolean(track)), [playableTracks, validQueueTrackIds]);

  useEffect(() => setModeState(preferences.musicPlaybackMode ?? 'list'), [preferences.musicPlaybackMode]);

  useEffect(() => {
    if (queueTrackIds.length === validQueueTrackIds.length) return;
    setQueueTrackIds(validQueueTrackIds);
    shuffleRemainingRef.current = shuffleRemainingRef.current.filter((id) => playableTrackIds.has(id));
    shuffleHistoryRef.current = shuffleHistoryRef.current.filter((id) => playableTrackIds.has(id));
  }, [playableTrackIds, queueTrackIds.length, validQueueTrackIds]);

  const loadTrack = useCallback(async (trackId: string) => {
    const track = musicTracks.find((item) => item.id === trackId);
    const asset = track ? media.find((item) => item.id === track.mediaId) : null;
    if (!track || !asset) throw new Error('音乐文件不存在');
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    player.replace(asset.localPath);
    setCurrentTrackId(trackId);
    setError(null);
    player.play();
  }, [media, musicTracks, player]);

  const playTrack = useCallback(async (trackId: string, nextQueueTrackIds: string[], source: MusicQueueSource) => {
    const nextIds = [...new Set(nextQueueTrackIds)].filter((id) => playableTrackIds.has(id));
    if (!nextIds.includes(trackId)) return;
    setQueueTrackIds(nextIds);
    setQueueSourceState(source);
    shuffleRemainingRef.current = mode === 'shuffle' ? nextIds.filter((id) => id !== trackId) : [];
    shuffleHistoryRef.current = [];
    try {
      await loadTrack(trackId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '音乐无法播放');
    }
  }, [loadTrack, mode, playableTrackIds]);

  const setQueueSource = useCallback((source: MusicQueueSource) => {
    const nextIds = trackIdsBySource[source];
    setQueueSourceState(source);
    setQueueTrackIds(nextIds);
    shuffleRemainingRef.current = mode === 'shuffle' ? nextIds.filter((id) => id !== currentTrackId) : [];
    shuffleHistoryRef.current = [];
  }, [currentTrackId, mode, trackIdsBySource]);

  const loadNextId = useCallback(async (trackId: string) => {
    try {
      await loadTrack(trackId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '音乐无法播放');
    }
  }, [loadTrack]);

  const next = useCallback(async () => {
    if (!validQueueTrackIds.length) return;
    if (!currentTrackId) return loadNextId(validQueueTrackIds[0]);
    const index = validQueueTrackIds.indexOf(currentTrackId);
    if (mode === 'shuffle' && validQueueTrackIds.length > 1) {
      if (!shuffleRemainingRef.current.length) shuffleRemainingRef.current = validQueueTrackIds.filter((id) => id !== currentTrackId);
      const randomIndex = Math.floor(Math.random() * shuffleRemainingRef.current.length);
      const nextId = shuffleRemainingRef.current.splice(randomIndex, 1)[0];
      shuffleHistoryRef.current.push(currentTrackId);
      return loadNextId(nextId);
    }
    return loadNextId(validQueueTrackIds[index < 0 ? 0 : (index + 1) % validQueueTrackIds.length]);
  }, [currentTrackId, loadNextId, mode, validQueueTrackIds]);

  const previous = useCallback(async () => {
    if (!validQueueTrackIds.length) return;
    if (mode === 'shuffle' && shuffleHistoryRef.current.length) {
      const previousId = shuffleHistoryRef.current.pop();
      if (previousId) return loadNextId(previousId);
    }
    const index = currentTrackId ? validQueueTrackIds.indexOf(currentTrackId) : 0;
    if (index < 0) return loadNextId(validQueueTrackIds[validQueueTrackIds.length - 1]);
    return loadNextId(validQueueTrackIds[(index - 1 + validQueueTrackIds.length) % validQueueTrackIds.length]);
  }, [currentTrackId, loadNextId, mode, validQueueTrackIds]);

  const close = useCallback(() => {
    player.pause();
    setCurrentTrackId(null);
    setQueueTrackIds([]);
    setError(null);
    shuffleRemainingRef.current = [];
    shuffleHistoryRef.current = [];
  }, [player]);

  useEffect(() => {
    if (!currentTrackId || currentTrack) return;
    player.pause();
    const nextId = validQueueTrackIds[0];
    if (nextId) void loadNextId(nextId);
    else close();
  }, [close, currentTrack, currentTrackId, loadNextId, player, validQueueTrackIds]);

  useEffect(() => {
    if (!currentTrackId || !status.didJustFinish) return;
    if (mode === 'single') {
      void player.seekTo(0).then(() => player.play());
      return;
    }
    void next();
  }, [currentTrackId, mode, next, player, status.didJustFinish]);

  const toggle = useCallback(() => {
    if (!currentTrackId) return;
    if (playing) player.pause();
    else player.play();
  }, [currentTrackId, player, playing]);
  const seek = useCallback((seconds: number) => player.seekTo(Math.max(0, seconds)), [player]);
  const setMode = useCallback(async (value: MusicPlaybackMode) => {
    setModeState(value);
    shuffleRemainingRef.current = value === 'shuffle' ? validQueueTrackIds.filter((id) => id !== currentTrackId) : [];
    shuffleHistoryRef.current = [];
    await updatePreferences({ musicPlaybackMode: value });
  }, [currentTrackId, updatePreferences, validQueueTrackIds]);

  const value = useMemo(() => ({ currentTrack, queue, queueSource, playing, currentTime: status.currentTime, duration: status.duration, mode, error, playTrack, setQueueSource, toggle, next, previous, seekTo: seek, setMode, close }), [close, currentTrack, error, mode, next, playTrack, playing, previous, queue, queueSource, seek, setMode, setQueueSource, status.currentTime, status.duration, toggle]);
  const showMiniPlayer = Boolean(currentTrackId) && pathname !== '/music-player' && pathname !== '/reader';
  return <MusicPlayerContext.Provider value={value}>{children}{showMiniPlayer ? <MiniPlayer onOpen={() => router.push('/music-player' as never)} onOpenQueue={() => router.push({ pathname: '/music-player', params: { queue: '1' } } as never)} /> : null}</MusicPlayerContext.Provider>;
}

export function useMusicPlayer(): MusicPlayerValue {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error('useMusicPlayer must be used inside MusicPlayerProvider');
  return value;
}

function MiniPlayer({ onOpen, onOpenQueue }: { onOpen(): void; onOpenQueue(): void }) {
  const { close, currentTrack, playing, toggle } = useMusicPlayer();
  const insets = useSafeAreaInsets();
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const positionRef = useRef(position);
  const [measured, setMeasured] = useState({ width: 0, height: 0 });
  const gestureStart = useRef(position);
  const { preferences, updatePreferences } = useAppState();
  const initialised = useRef(false);
  useEffect(() => {
    if (initialised.current) return;
    const storedPosition = { x: preferences.miniPlayerX, y: preferences.miniPlayerY };
    positionRef.current = storedPosition;
    setPosition(storedPosition);
    initialised.current = true;
  }, [preferences.miniPlayerX, preferences.miniPlayerY]);
  const clamp = useCallback((x: number, y: number) => {
    const screen = Dimensions.get('window');
    const baseBottom = Math.max(84, insets.bottom + spacing.md);
    const maxX = Math.max(0, screen.width - (measured.width || 340) - spacing.md * 2);
    const maxY = Math.max(0, screen.height - (measured.height || 64) - insets.top - spacing.sm - baseBottom);
    return { x: Math.max(0, Math.min(maxX, x)), y: Math.max(0, Math.min(maxY, y)) };
  }, [insets.bottom, insets.top, measured.height, measured.width]);
  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 4 || Math.abs(gesture.dy) > 4,
    onPanResponderGrant: () => { gestureStart.current = positionRef.current; },
    onPanResponderMove: (_, gesture) => {
      const nextPosition = clamp(gestureStart.current.x + gesture.dx, gestureStart.current.y - gesture.dy);
      positionRef.current = nextPosition;
      setPosition(nextPosition);
    },
    onPanResponderRelease: () => {
      const nextPosition = clamp(positionRef.current.x, positionRef.current.y);
      positionRef.current = nextPosition;
      setPosition(nextPosition);
      void updatePreferences({ miniPlayerX: nextPosition.x, miniPlayerY: nextPosition.y });
    },
  }), [clamp, updatePreferences]);
  if (!currentTrack) return null;
  return <View onLayout={(event) => setMeasured({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })} {...pan.panHandlers} style={[styles.mini, { maxWidth: Dimensions.get('window').width - spacing.md * 2, bottom: Math.max(84, insets.bottom + spacing.md), transform: [{ translateX: position.x }, { translateY: -position.y }] }]}><Pressable onPress={onOpen} style={styles.miniInfo}><View style={styles.disc}><SymbolView name={{ android: 'music_note', ios: 'music.note', web: 'music_note' }} size={18} tintColor={colors.life} type="hierarchical" /></View><View style={styles.copy}><Text numberOfLines={1} style={styles.title}>{currentTrack.title}</Text><Text numberOfLines={1} style={styles.artist}>{currentTrack.artist || '未知艺术家'}</Text></View></Pressable><Pressable accessibilityLabel={playing ? '暂停音乐' : '播放音乐'} onPress={toggle} style={styles.action}><SymbolView name={{ android: playing ? 'pause' : 'play_arrow', ios: playing ? 'pause.fill' : 'play.fill', web: playing ? 'pause' : 'play_arrow' }} size={18} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel="打开播放队列" onPress={onOpenQueue} style={styles.action}><SymbolView name={{ android: 'queue_music', ios: 'list.bullet', web: 'queue_music' }} size={18} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Pressable accessibilityLabel="关闭音乐播放器" onPress={close} style={styles.action}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /></Pressable></View>;
}

const styles = createThemedStyles(() => ({ mini: { position: 'absolute', left: spacing.md, width: 320, minHeight: 64, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 }, miniInfo: { flex: 1, flexDirection: 'row', alignItems: 'center' }, disc: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.lifeLight }, copy: { flex: 1, marginLeft: spacing.sm }, title: { color: colors.ink, fontFamily: typography.display, fontSize: 14 }, artist: { marginTop: 2, color: colors.inkFaint, fontSize: 10 }, action: { width: 38, height: 44, alignItems: 'center', justifyContent: 'center' } }));
