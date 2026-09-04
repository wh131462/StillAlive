import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Animated, LayoutAnimation, PanResponder, Pressable, Text, useWindowDimensions, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { usePathname, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import type { MusicPlaybackMode, MusicTrack } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { orderMusicTracksByCollectionEntries } from './music-library';
import { MusicCover, resolveMusicCoverUri } from './music-cover';
import { writePersistentError } from '../../infrastructure/platform/persistent-log';

export type MusicQueueSource = 'all' | 'self' | 'person' | 'playlist';

interface MusicPlayerValue {
  currentTrack: MusicTrack | null;
  queue: MusicTrack[];
  queueSource: MusicQueueSource;
  queuePersonId: string | null;
  queuePlaylistId: string | null;
  playing: boolean;
  currentTime: number;
  duration: number;
  mode: MusicPlaybackMode;
  error: string | null;
  sleepTimerEndsAt: number | null;
  sleepAfterTrack: boolean;
  playTrack(trackId: string, queueTrackIds: string[], source: MusicQueueSource, personId?: string | null): Promise<void>;
  setQueueSource(source: MusicQueueSource, sourceId?: string | null): void;
  toggle(): void;
  next(): Promise<void>;
  previous(): Promise<void>;
  seekTo(seconds: number): Promise<void>;
  setMode(mode: MusicPlaybackMode): Promise<void>;
  setSleepTimer(minutes: number | null): void;
  setSleepAfterTrack(enabled: boolean): void;
  close(): void;
}

const MusicPlayerContext = createContext<MusicPlayerValue | null>(null);

type MiniPlayerEdge = 'left' | 'right';

const MINI_PLAYER_EXPANDED_WIDTH = 320;
const MINI_PLAYER_EXPANDED_HEIGHT = 44;
const MINI_PLAYER_COLLAPSED_SIZE = 44;
const MINI_PLAYER_DRAG_SIZE = 56;
const MINI_PLAYER_EDGE_PEEK = 9;
const MINI_PLAYER_ANIMATION_DURATION = 200;
const PLAY_COUNT_THRESHOLD = 0.8;
const PLAYBACK_POSITION_TOLERANCE_SECONDS = 1;

interface PlayCountSession {
  trackId: string;
  listenedSeconds: number;
  lastPosition: number;
  lastObservedAt: number;
  counted: boolean;
  pending: boolean;
}

export function MusicPlayerProvider({ children }: PropsWithChildren) {
  const router = useRouter();
  const pathname = usePathname();
  const { incrementMusicTrackPlayCount, media, musicCollectionEntries, musicPlaylistEntries, musicTracks, preferences, updatePreferences } = useAppState();
  const player = useAudioPlayer(null, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const [currentTrackId, setCurrentTrackId] = useState<string | null>(null);
  const [queueTrackIds, setQueueTrackIds] = useState<string[]>([]);
  const [queueSource, setQueueSourceState] = useState<MusicQueueSource>('all');
  const [queuePersonId, setQueuePersonId] = useState<string | null>(null);
  const [queuePlaylistId, setQueuePlaylistId] = useState<string | null>(null);
  const [mode, setModeState] = useState<MusicPlaybackMode>('list');
  const [error, setError] = useState<string | null>(null);
  const [sleepTimerEndsAt, setSleepTimerEndsAt] = useState<number | null>(null);
  const [sleepAfterTrack, setSleepAfterTrack] = useState(false);
  const [miniPlayerCollapsed, setMiniPlayerCollapsed] = useState(true);
  const loadRequestRef = useRef(0);
  const audioModePromiseRef = useRef<Promise<void> | null>(null);
  const shuffleRemainingRef = useRef<string[]>([]);
  const shuffleHistoryRef = useRef<string[]>([]);
  const playCountSessionRef = useRef<PlayCountSession | null>(null);
  const playing = Boolean(status.playing);

  useEffect(() => {
    if (sleepTimerEndsAt === null) return;
    const remaining = sleepTimerEndsAt - Date.now();
    if (remaining <= 0) {
      player.pause();
      setSleepTimerEndsAt(null);
      return;
    }
    const timer = setTimeout(() => {
      player.pause();
      setSleepTimerEndsAt(null);
    }, remaining);
    return () => clearTimeout(timer);
  }, [player, sleepTimerEndsAt]);

  const mediaIds = useMemo(() => new Set(media.map((item) => item.id)), [media]);
  const playableTracks = useMemo(() => musicTracks.filter((track) => mediaIds.has(track.mediaId)), [mediaIds, musicTracks]);
  const playableTrackIds = useMemo(() => new Set(playableTracks.map((track) => track.id)), [playableTracks]);
  const trackIdsBySource = useMemo(() => {
    const select = (entries: typeof musicCollectionEntries) => orderMusicTracksByCollectionEntries(playableTracks, entries).map((track) => track.id);
    return {
      all: select(musicCollectionEntries),
      self: select(musicCollectionEntries.filter((entry) => entry.targetType === 'self')),
    };
  }, [musicCollectionEntries, playableTracks]);
  const validQueueTrackIds = useMemo(() => queueTrackIds.filter((id) => playableTrackIds.has(id)), [playableTrackIds, queueTrackIds]);
  const currentTrack = useMemo(() => playableTracks.find((track) => track.id === currentTrackId) ?? null, [currentTrackId, playableTracks]);
  const queue = useMemo(() => validQueueTrackIds.map((id) => playableTracks.find((track) => track.id === id)).filter((track): track is MusicTrack => Boolean(track)), [playableTracks, validQueueTrackIds]);

  useEffect(() => {
    if (!currentTrack) return;
    let active = true;
    const coverAsset = currentTrack.coverMediaId ? media.find((item) => item.id === currentTrack.coverMediaId) : null;
    void resolveMusicCoverUri(coverAsset).then((artworkUrl) => {
      if (!active) return;
      player.updateLockScreenMetadata({ title: currentTrack.title, artist: currentTrack.artist || '未知艺术家', albumTitle: currentTrack.album || undefined, artworkUrl });
    }).catch(() => undefined);
    return () => { active = false; };
  }, [currentTrack, media, player]);

  useEffect(() => setModeState(preferences.musicPlaybackMode ?? 'list'), [preferences.musicPlaybackMode]);

  useEffect(() => {
    if (queueTrackIds.length === validQueueTrackIds.length) return;
    setQueueTrackIds(validQueueTrackIds);
    shuffleRemainingRef.current = shuffleRemainingRef.current.filter((id) => playableTrackIds.has(id));
    shuffleHistoryRef.current = shuffleHistoryRef.current.filter((id) => playableTrackIds.has(id));
  }, [playableTrackIds, queueTrackIds.length, validQueueTrackIds]);

  const ensureAudioMode = useCallback(() => {
    if (!audioModePromiseRef.current) {
      audioModePromiseRef.current = setAudioModeAsync({
        playsInSilentMode: true,
        allowsRecording: false,
        shouldPlayInBackground: true,
        interruptionMode: 'doNotMix',
      }).catch((cause) => {
        audioModePromiseRef.current = null;
        throw cause;
      });
    }
    return audioModePromiseRef.current;
  }, []);

  const loadTrack = useCallback(async (trackId: string) => {
    const requestId = ++loadRequestRef.current;
    const track = musicTracks.find((item) => item.id === trackId);
    const asset = track ? media.find((item) => item.id === track.mediaId) : null;
    if (!track || !asset) throw new Error('音乐文件不存在');
    // Select the track before waiting for the audio session/source to load so the
    // player screen never renders an empty state during the first playback.
    setCurrentTrackId(trackId);
    setError(null);
    playCountSessionRef.current = createPlayCountSession(trackId, 0);
    try {
      await ensureAudioMode();
      if (requestId !== loadRequestRef.current) return;
      player.replace(asset.localPath);
      player.setActiveForLockScreen(true, {
        title: track.title,
        artist: track.artist || '未知艺术家',
        albumTitle: track.album || undefined,
      }, {
        showPrevious: true,
        showNext: true,
        showClose: true,
      });
      player.play();
    } catch (cause) {
      if (requestId === loadRequestRef.current) throw cause;
    }
  }, [ensureAudioMode, media, musicTracks, player]);

  const playTrack = useCallback(async (trackId: string, nextQueueTrackIds: string[], source: MusicQueueSource, sourceId: string | null = null) => {
    if ((source === 'person' || source === 'playlist') && !sourceId) return;
    const nextIds = [...new Set(nextQueueTrackIds)].filter((id) => playableTrackIds.has(id));
    if (!nextIds.includes(trackId)) return;
    setQueueTrackIds(nextIds);
    setQueueSourceState(source);
    setQueuePersonId(source === 'person' ? sourceId : null);
    setQueuePlaylistId(source === 'playlist' ? sourceId : null);
    shuffleRemainingRef.current = mode === 'shuffle' ? nextIds.filter((id) => id !== trackId) : [];
    shuffleHistoryRef.current = [];
    try {
      await loadTrack(trackId);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '音乐无法播放');
    }
  }, [loadTrack, mode, playableTrackIds]);

  const setQueueSource = useCallback((source: MusicQueueSource, sourceId: string | null = null) => {
    const nextPersonId = sourceId ?? queuePersonId;
    const nextPlaylistId = sourceId ?? queuePlaylistId;
    const nextIds = source === 'person'
      ? nextPersonId ? orderMusicTracksByCollectionEntries(playableTracks, musicCollectionEntries.filter((entry) => entry.targetType === 'person' && entry.targetId === nextPersonId)).map((track) => track.id) : []
      : source === 'playlist' ? nextPlaylistId ? musicPlaylistEntries.filter((entry) => entry.playlistId === nextPlaylistId && playableTrackIds.has(entry.trackId)).map((entry) => entry.trackId) : []
      : trackIdsBySource[source];
    if ((source === 'person' && !nextPersonId) || (source === 'playlist' && !nextPlaylistId)) return;
    setQueueSourceState(source);
    if (source === 'person') setQueuePersonId(nextPersonId);
    if (source === 'playlist') setQueuePlaylistId(nextPlaylistId);
    setQueueTrackIds((currentIds) => arraysEqual(currentIds, nextIds) ? currentIds : nextIds);
    shuffleRemainingRef.current = mode === 'shuffle' ? nextIds.filter((id) => id !== currentTrackId) : [];
    shuffleHistoryRef.current = [];
  }, [currentTrackId, mode, musicCollectionEntries, musicPlaylistEntries, playableTrackIds, playableTracks, queuePersonId, queuePlaylistId, trackIdsBySource]);

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
    loadRequestRef.current += 1;
    player.pause();
    player.setActiveForLockScreen(false);
    setCurrentTrackId(null);
    setQueueTrackIds([]);
    setQueuePersonId(null);
    setQueuePlaylistId(null);
    setError(null);
    setSleepTimerEndsAt(null);
    setSleepAfterTrack(false);
    setMiniPlayerCollapsed(true);
    playCountSessionRef.current = null;
    shuffleRemainingRef.current = [];
    shuffleHistoryRef.current = [];
  }, [player]);

  useEffect(() => {
    const subscription = player.addListener('remoteControl', ({ action }) => {
      if (action === 'previous') void previous();
      else if (action === 'next') void next();
      else close();
    });
    return () => subscription.remove();
  }, [close, next, player, previous]);

  useEffect(() => {
    if (status.error) setError(status.error);
  }, [status.error]);

  useEffect(() => {
    if (!currentTrackId || currentTrack) return;
    player.pause();
    const nextId = validQueueTrackIds[0];
    if (nextId) void loadNextId(nextId);
    else close();
  }, [close, currentTrack, currentTrackId, loadNextId, player, validQueueTrackIds]);

  useEffect(() => {
    if (!currentTrackId || !currentTrack) {
      playCountSessionRef.current = null;
      return;
    }
    const now = Date.now();
    let session = playCountSessionRef.current;
    if (!session || session.trackId !== currentTrackId) {
      session = createPlayCountSession(currentTrackId, status.currentTime, now);
      playCountSessionRef.current = session;
      return;
    }

    const elapsedSeconds = Math.max(0, (now - session.lastObservedAt) / 1_000);
    const positionDelta = status.currentTime - session.lastPosition;
    session.lastObservedAt = now;
    session.lastPosition = status.currentTime;
    if (session.counted || session.pending || (!status.playing && !status.didJustFinish)) return;
    if (!Number.isFinite(positionDelta) || positionDelta <= 0 || positionDelta > elapsedSeconds + PLAYBACK_POSITION_TOLERANCE_SECONDS) return;

    session.listenedSeconds += positionDelta;
    const durationSeconds = status.duration > 0 ? status.duration : (currentTrack.durationMs ?? 0) / 1_000;
    if (durationSeconds <= 0 || session.listenedSeconds < durationSeconds * PLAY_COUNT_THRESHOLD) return;

    session.pending = true;
    void incrementMusicTrackPlayCount(currentTrackId).then(() => {
      session.counted = true;
      session.pending = false;
    }).catch(() => {
      session.pending = false;
    });
  }, [currentTrack, currentTrackId, incrementMusicTrackPlayCount, status.currentTime, status.didJustFinish, status.duration, status.playing]);

  useEffect(() => {
    if (!currentTrackId || !status.didJustFinish) return;
    if (sleepAfterTrack) {
      player.pause();
      setSleepAfterTrack(false);
      return;
    }
    if (mode === 'single') {
      playCountSessionRef.current = createPlayCountSession(currentTrackId, 0);
      void player.seekTo(0).then(() => player.play());
      return;
    }
    void next();
  }, [currentTrackId, mode, next, player, sleepAfterTrack, status.didJustFinish]);

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
  const setSleepTimer = useCallback((minutes: number | null) => {
    setSleepTimerEndsAt(minutes === null ? null : Date.now() + minutes * 60_000);
    if (minutes !== null) setSleepAfterTrack(false);
  }, []);
  const setSleepAfterTrackMode = useCallback((enabled: boolean) => {
    setSleepAfterTrack(enabled);
    if (enabled) setSleepTimerEndsAt(null);
  }, []);
  const collapseMiniPlayer = useCallback(() => setMiniPlayerCollapsed(true), []);
  const expandMiniPlayer = useCallback(() => setMiniPlayerCollapsed(false), []);
  const openMusicPlayer = useCallback(() => router.push('/music-player' as never), [router]);

  const value = useMemo(() => ({ currentTrack, queue, queueSource, queuePersonId, queuePlaylistId, playing, currentTime: status.currentTime, duration: status.duration, mode, error, sleepTimerEndsAt, sleepAfterTrack, playTrack, setQueueSource, toggle, next, previous, seekTo: seek, setMode, setSleepTimer, setSleepAfterTrack: setSleepAfterTrackMode, close }), [close, currentTrack, error, mode, next, playTrack, playing, previous, queue, queuePersonId, queuePlaylistId, queueSource, seek, setMode, setQueueSource, setSleepAfterTrackMode, setSleepTimer, sleepAfterTrack, sleepTimerEndsAt, status.currentTime, status.duration, toggle]);
  const showMiniPlayer = Boolean(currentTrackId) && pathname !== '/music-player' && pathname !== '/reader';
  return <MusicPlayerContext.Provider value={value}>{children}{showMiniPlayer ? <MiniPlayer collapsed={miniPlayerCollapsed} onCollapse={collapseMiniPlayer} onExpand={expandMiniPlayer} onOpen={openMusicPlayer} /> : null}</MusicPlayerContext.Provider>;
}

function createPlayCountSession(trackId: string, position: number, observedAt = Date.now()): PlayCountSession {
  return { trackId, listenedSeconds: 0, lastPosition: position, lastObservedAt: observedAt, counted: false, pending: false };
}

export function useMusicPlayer(): MusicPlayerValue {
  const value = useContext(MusicPlayerContext);
  if (!value) throw new Error('useMusicPlayer must be used inside MusicPlayerProvider');
  return value;
}

function MiniPlayer({ collapsed, onCollapse, onExpand, onOpen }: { collapsed: boolean; onCollapse(): void; onExpand(): void; onOpen(): void }) {
  const { close, currentTime, currentTrack, duration, next, playing, previous, toggle } = useMusicPlayer();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const { media, preferences, updatePreferences } = useAppState();
  const [edge, setEdge] = useState<MiniPlayerEdge>(preferences.miniPlayerEdge ?? 'left');
  const [yRatio, setYRatio] = useState(preferences.miniPlayerYRatio ?? 0);
  const [placementReady, setPlacementReady] = useState(false);
  const [dragging, setDragging] = useState(false);
  const positionRef = useRef({ x: 0, y: 0 });
  const gestureStart = useRef(positionRef.current);
  const initialised = useRef(false);
  const animatedPosition = useRef(new Animated.ValueXY()).current;
  const animatedTranslateY = useMemo(() => Animated.multiply(animatedPosition.y, -1), [animatedPosition.y]);
  const baseBottom = Math.max(84, insets.bottom + spacing.md);

  const metricsFor = useCallback((isCollapsed: boolean, isDragging = false) => {
    const compactSize = isDragging ? MINI_PLAYER_DRAG_SIZE : MINI_PLAYER_COLLAPSED_SIZE;
    const width = isCollapsed
      ? compactSize
      : Math.min(MINI_PLAYER_EXPANDED_WIDTH, Math.max(MINI_PLAYER_COLLAPSED_SIZE, window.width - spacing.md * 2));
    const height = isCollapsed ? compactSize : MINI_PLAYER_EXPANDED_HEIGHT;
    const minX = isDragging ? spacing.sm : isCollapsed ? -MINI_PLAYER_EDGE_PEEK : spacing.md;
    const maxX = isCollapsed
      ? Math.max(minX, window.width - width + (isDragging ? -spacing.sm : MINI_PLAYER_EDGE_PEEK))
      : Math.max(minX, window.width - width - spacing.md);
    const maxY = Math.max(0, window.height - height - insets.top - spacing.sm - baseBottom);
    return { width, height, minX, maxX, maxY };
  }, [baseBottom, insets.top, window.height, window.width]);

  const positionFor = useCallback((nextEdge: MiniPlayerEdge, nextYRatio: number, isCollapsed: boolean) => {
    const metrics = metricsFor(isCollapsed);
    return {
      x: nextEdge === 'left' ? metrics.minX : metrics.maxX,
      y: metrics.maxY * clampRatio(nextYRatio),
    };
  }, [metricsFor]);

  const animatePosition = useCallback((position: { x: number; y: number }) => {
    positionRef.current = position;
    Animated.timing(animatedPosition, {
      toValue: position,
      duration: MINI_PLAYER_ANIMATION_DURATION,
      useNativeDriver: true,
    }).start();
  }, [animatedPosition]);

  const persistPlacement = useCallback((nextEdge: MiniPlayerEdge, nextYRatio: number) => {
    const ratio = clampRatio(nextYRatio);
    setEdge(nextEdge);
    setYRatio(ratio);
    void updatePreferences({ miniPlayerEdge: nextEdge, miniPlayerYRatio: ratio }).catch((cause) => {
      writePersistentError('music.mini-player.placement.persist.failed', cause);
    });
  }, [updatePreferences]);

  useEffect(() => {
    if (initialised.current) return;
    const metrics = metricsFor(collapsed);
    const storedEdge = preferences.miniPlayerEdge
      ?? (preferences.miniPlayerX + metrics.width / 2 > window.width / 2 ? 'right' : 'left');
    const storedYRatio = preferences.miniPlayerYRatio
      ?? (metrics.maxY > 0 ? preferences.miniPlayerY / metrics.maxY : 0);
    const ratio = clampRatio(storedYRatio);
    const position = positionFor(storedEdge, ratio, collapsed);
    positionRef.current = position;
    animatedPosition.setValue(position);
    setEdge(storedEdge);
    setYRatio(ratio);
    initialised.current = true;
    setPlacementReady(true);
    if (!preferences.miniPlayerEdge || preferences.miniPlayerYRatio === null) {
      void updatePreferences({ miniPlayerEdge: storedEdge, miniPlayerYRatio: ratio }).catch((cause) => {
        writePersistentError('music.mini-player.placement.initialize.failed', cause);
      });
    }
  }, [animatedPosition, collapsed, metricsFor, positionFor, preferences.miniPlayerEdge, preferences.miniPlayerX, preferences.miniPlayerY, preferences.miniPlayerYRatio, updatePreferences, window.width]);

  useEffect(() => {
    if (!placementReady) return;
    animatePosition(positionFor(edge, yRatio, collapsed));
  }, [animatePosition, collapsed, edge, placementReady, positionFor, yRatio]);

  const settlePosition = useCallback(() => {
    const metrics = metricsFor(true, true);
    const nextEdge: MiniPlayerEdge = positionRef.current.x + metrics.width / 2 <= window.width / 2 ? 'left' : 'right';
    const nextYRatio = metrics.maxY > 0 ? positionRef.current.y / metrics.maxY : 0;
    persistPlacement(nextEdge, nextYRatio);
    if (!collapsed) {
      animateMiniPlayerLayout();
      onCollapse();
    }
    setDragging(false);
    animatePosition(positionFor(nextEdge, nextYRatio, true));
  }, [animatePosition, collapsed, metricsFor, onCollapse, persistPlacement, positionFor, window.width]);

  const collapse = useCallback(() => {
    const metrics = metricsFor(false);
    const nextEdge: MiniPlayerEdge = positionRef.current.x + metrics.width / 2 <= window.width / 2 ? 'left' : 'right';
    const nextYRatio = metrics.maxY > 0 ? positionRef.current.y / metrics.maxY : 0;
    animateMiniPlayerLayout();
    persistPlacement(nextEdge, nextYRatio);
    onCollapse();
    animatePosition(positionFor(nextEdge, nextYRatio, true));
  }, [animatePosition, metricsFor, onCollapse, persistPlacement, positionFor, window.width]);

  const expand = useCallback(() => {
    animateMiniPlayerLayout();
    onExpand();
    animatePosition(positionFor(edge, yRatio, false));
  }, [animatePosition, edge, onExpand, positionFor, yRatio]);

  const requestClose = useCallback(() => {
    feedback.alert('结束播放？', '当前播放队列会被清空。', [
      { text: '取消', style: 'cancel' },
      { text: '结束播放', style: 'destructive', onPress: close },
    ]);
  }, [close]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
    onPanResponderGrant: (_, gesture) => {
      animatedPosition.stopAnimation();
      const metrics = metricsFor(true, true);
      const position = {
        x: Math.max(metrics.minX, Math.min(metrics.maxX, gesture.x0 - metrics.width / 2)),
        y: Math.max(0, Math.min(metrics.maxY, window.height - baseBottom - metrics.height / 2 - gesture.y0)),
      };
      animateMiniPlayerLayout();
      setDragging(true);
      gestureStart.current = position;
      positionRef.current = position;
      animatedPosition.setValue(position);
    },
    onPanResponderMove: (_, gesture) => {
      const metrics = metricsFor(true, true);
      const position = {
        x: Math.max(metrics.minX, Math.min(metrics.maxX, gestureStart.current.x + gesture.dx)),
        y: Math.max(0, Math.min(metrics.maxY, gestureStart.current.y - gesture.dy)),
      };
      positionRef.current = position;
      animatedPosition.setValue(position);
    },
    onPanResponderRelease: settlePosition,
    onPanResponderTerminate: settlePosition,
  }), [animatedPosition, baseBottom, metricsFor, settlePosition, window.height]);

  if (!currentTrack) return null;
  const compact = collapsed || dragging;
  const metrics = metricsFor(compact, dragging);
  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0;
  return (
    <>
      {!collapsed && !dragging ? <Pressable accessibilityLabel="收起迷你播放器" onPress={collapse} style={styles.miniDismissLayer} /> : null}
      <Animated.View
        {...pan.panHandlers}
        style={[styles.mini, compact ? styles.miniCollapsed : styles.miniExpanded, dragging ? styles.miniDragging : collapsed && (edge === 'left' ? styles.miniCollapsedLeft : styles.miniCollapsedRight), {
          width: metrics.width,
          height: metrics.height,
          bottom: baseBottom,
          transform: [{ translateX: animatedPosition.x }, { translateY: animatedTranslateY }],
        }]}
      >
        {compact ? (
          dragging ? <View style={styles.collapsedEntry}><MusicCover media={media.find((item) => item.id === currentTrack.coverMediaId)} size={38} style={styles.collapsedCover} /></View> : (
            <Pressable accessibilityLabel={`展开迷你播放器，${playing ? '正在播放' : '已暂停'} ${currentTrack.title}`} onPress={expand} style={({ pressed }) => [styles.collapsedEntry, pressed && styles.pressed]}>
              <MusicCover media={media.find((item) => item.id === currentTrack.coverMediaId)} size={38} style={styles.collapsedCover} />
            </Pressable>
          )
        ) : (
          <>
            <Pressable accessibilityLabel="打开音乐播放页" onPress={onOpen} style={({ pressed }) => [styles.miniInfo, pressed && styles.pressed]}>
              <MusicCover media={media.find((item) => item.id === currentTrack.coverMediaId)} size={34} style={styles.disc} />
              <View style={styles.copy}>
                <Text numberOfLines={1} style={styles.title}>{currentTrack.title}</Text>
                <Text numberOfLines={1} style={styles.artist}>{currentTrack.artist || '未知艺术家'}</Text>
              </View>
            </Pressable>
            <Pressable accessibilityLabel="上一首" hitSlop={5} onPress={() => void previous()} style={({ pressed }) => [styles.skipAction, pressed && styles.pressed]}>
              <SymbolView name={{ android: 'skip_previous', ios: 'backward.end.fill', web: 'skip_previous' }} size={17} tintColor={colors.inkSoft} type="hierarchical" />
            </Pressable>
            <Pressable accessibilityLabel={playing ? '暂停音乐' : '播放音乐'} hitSlop={5} onPress={toggle} style={({ pressed }) => [styles.playAction, pressed && styles.pressed]}>
              <SymbolView name={{ android: playing ? 'pause' : 'play_arrow', ios: playing ? 'pause.fill' : 'play.fill', web: playing ? 'pause' : 'play_arrow' }} size={17} tintColor={colors.onLife} type="hierarchical" />
            </Pressable>
            <Pressable accessibilityLabel="下一首" hitSlop={5} onPress={() => void next()} style={({ pressed }) => [styles.skipAction, pressed && styles.pressed]}>
              <SymbolView name={{ android: 'skip_next', ios: 'forward.end.fill', web: 'skip_next' }} size={17} tintColor={colors.inkSoft} type="hierarchical" />
            </Pressable>
            <Pressable accessibilityLabel="关闭音乐播放器" hitSlop={5} onPress={requestClose} style={({ pressed }) => [styles.closeAction, pressed && styles.pressed]}>
              <SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={16} tintColor={colors.danger} type="hierarchical" />
            </Pressable>
            <View pointerEvents="none" style={styles.miniProgressTrack}><View style={[styles.miniProgressFill, { width: `${progress * 100}%` }]} /></View>
          </>
        )}
      </Animated.View>
    </>
  );
}

function clampRatio(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function animateMiniPlayerLayout(): void {
  LayoutAnimation.configureNext({
    duration: MINI_PLAYER_ANIMATION_DURATION,
    create: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
    update: { type: LayoutAnimation.Types.easeInEaseOut },
    delete: { type: LayoutAnimation.Types.easeInEaseOut, property: LayoutAnimation.Properties.opacity },
  });
}

const styles = createThemedStyles(() => ({
  miniDismissLayer: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 1 },
  mini: { position: 'absolute', left: 0, zIndex: 2, flexDirection: 'row', alignItems: 'center', backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOpacity: 0.14, shadowRadius: 12, elevation: 6 },
  miniExpanded: { padding: spacing.xs, overflow: 'hidden', borderWidth: 1, borderColor: colors.lineSoft, borderRadius: radius.lg },
  miniCollapsed: { justifyContent: 'center', borderWidth: 1, borderColor: colors.lifeLine, backgroundColor: colors.lifeDeep, shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
  miniCollapsedLeft: { borderTopLeftRadius: 0, borderTopRightRadius: 22, borderBottomRightRadius: 22, borderBottomLeftRadius: 0 },
  miniCollapsedRight: { borderTopLeftRadius: 22, borderTopRightRadius: 0, borderBottomRightRadius: 0, borderBottomLeftRadius: 22 },
  miniDragging: { borderRadius: 28 },
  collapsedEntry: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 },
  collapsedCover: { borderRadius: 19 },
  miniInfo: { minWidth: 0, flex: 1, flexDirection: 'row', alignItems: 'center' },
  disc: { borderRadius: 17, borderWidth: 1, borderColor: colors.lifeLine },
  copy: { minWidth: 0, flex: 1, marginLeft: spacing.sm },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 12 },
  artist: { marginTop: 1, color: colors.inkFaint, fontSize: 9 },
  playAction: { width: 34, height: 34, marginLeft: spacing.xs, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.life },
  skipAction: { width: 28, height: 34, alignItems: 'center', justifyContent: 'center' },
  closeAction: { width: 34, height: 42, alignItems: 'center', justifyContent: 'center' },
  miniProgressTrack: { position: 'absolute', right: spacing.md, bottom: 0, left: spacing.md, height: 2, backgroundColor: colors.lifeLight },
  miniProgressFill: { height: 2, backgroundColor: colors.life },
  pressed: { opacity: 0.62 },
}));
