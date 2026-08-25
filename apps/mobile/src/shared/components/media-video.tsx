import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { SymbolView } from 'expo-symbols';
import { colors } from '@still-alive/tokens';

export function MediaVideo({ active = true, style, uri }: { active?: boolean; style?: StyleProp<ViewStyle>; uri: string }) {
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useVideoPlayer(uri, (currentPlayer) => {
    currentPlayer.timeUpdateEventInterval = 0.25;
  });
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [railWidth, setRailWidth] = useState(0);
  const durationRef = useRef(0);
  const railWidthRef = useRef(0);
  const playingRef = useRef(false);

  const showControls = useCallback(() => {
    controlsOpacity.stopAnimation();
    setControlsVisible(true);
    Animated.timing(controlsOpacity, { duration: 220, easing: Easing.out(Easing.quad), toValue: 1, useNativeDriver: true }).start();
  }, [controlsOpacity]);

  const hideControls = useCallback(() => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    controlsOpacity.stopAnimation();
    Animated.timing(controlsOpacity, { duration: 420, easing: Easing.inOut(Easing.ease), toValue: 0, useNativeDriver: true }).start(({ finished }) => {
      if (finished) setControlsVisible(false);
    });
  }, [controlsOpacity]);

  const scheduleControlsHide = useCallback(() => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    if (playingRef.current) controlsHideTimerRef.current = setTimeout(hideControls, 2200);
  }, [hideControls]);

  useEffect(() => {
    const playingSubscription = player.addListener('playingChange', ({ isPlaying }) => setPlaying(isPlaying));
    const timeSubscription = player.addListener('timeUpdate', ({ currentTime: nextTime }) => setCurrentTime(nextTime));
    const handleSourceReady = () => {
      const nextDuration = player.duration || 0;
      setDuration(nextDuration);
      if (nextDuration > 0 && player.currentTime === 0) player.currentTime = Math.min(0.1, nextDuration / 2);
    };
    if (player.status === 'readyToPlay') handleSourceReady();
    const sourceSubscription = player.addListener('sourceLoad', handleSourceReady);
    const statusSubscription = player.addListener('statusChange', ({ status }) => {
      if (status === 'readyToPlay') handleSourceReady();
    });
    return () => {
      playingSubscription.remove();
      timeSubscription.remove();
      sourceSubscription.remove();
      statusSubscription.remove();
    };
  }, [active, player]);

  useEffect(() => {
    if (!active) {
      player.pause();
      setPlaying(false);
      showControls();
    }
  }, [active, player, showControls]);

  useEffect(() => {
    playingRef.current = playing;
    showControls();
    if (playing) controlsHideTimerRef.current = setTimeout(hideControls, 2200);
    return () => {
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };
  }, [hideControls, playing, showControls]);

  useEffect(() => () => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    controlsOpacity.stopAnimation();
  }, [controlsOpacity]);

  const togglePlayback = () => {
    if (player.playing) player.pause();
    else player.play();
  };

  useEffect(() => {
    durationRef.current = duration;
    railWidthRef.current = railWidth;
  }, [duration, railWidth]);

  const seek = (locationX: number) => {
    const currentDuration = durationRef.current;
    const currentRailWidth = railWidthRef.current;
    if (!currentDuration || !currentRailWidth) return;
    const nextTime = Math.max(0, Math.min(currentDuration, (locationX / currentRailWidth) * currentDuration));
    player.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const railPanResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => seek(event.nativeEvent.locationX),
    onPanResponderMove: (event) => seek(event.nativeEvent.locationX),
    onPanResponderRelease: () => scheduleControlsHide(),
    onPanResponderTerminate: () => scheduleControlsHide(),
  })).current;

  const toggleControls = () => {
    if (controlsVisible) {
      hideControls();
      return;
    }
    showControls();
    scheduleControlsHide();
  };

  const progress = duration ? Math.min(100, Math.max(0, (currentTime / duration) * 100)) : 0;

  return (
    <View style={[styles.container, style]}>
      <VideoView contentFit="contain" nativeControls={false} player={player} style={styles.video} surfaceType="textureView" useExoShutter={false} />
      <Pressable accessibilityLabel={controlsVisible ? '隐藏视频控制器' : '显示视频控制器'} accessibilityRole="button" onPress={toggleControls} style={styles.surfaceTap} />
      <Animated.View pointerEvents={controlsVisible ? 'box-none' : 'none'} style={[styles.controls, { opacity: controlsOpacity }]}>
        <Pressable accessibilityLabel={playing ? '暂停视频' : '播放视频'} accessibilityRole="button" onPress={togglePlayback} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
          <SymbolView name={{ android: playing ? 'pause' : 'play_arrow', ios: playing ? 'pause.fill' : 'play.fill', web: playing ? 'pause' : 'play_arrow' }} size={20} tintColor="rgba(255, 255, 255, 0.94)" type="hierarchical" />
        </Pressable>
        <View style={styles.bottomBar}>
          <Pressable accessibilityLabel={playing ? '暂停视频' : '播放视频'} accessibilityRole="button" hitSlop={6} onPress={togglePlayback} style={({ pressed }) => [styles.controlPlayButton, pressed && styles.controlPressed]}>
            <SymbolView name={{ android: playing ? 'pause' : 'play_arrow', ios: playing ? 'pause.fill' : 'play.fill', web: playing ? 'pause' : 'play_arrow' }} size={15} tintColor="rgba(255, 255, 255, 0.92)" type="hierarchical" />
          </Pressable>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <View accessibilityLabel="调整视频进度" accessibilityRole="adjustable" onLayout={({ nativeEvent }) => setRailWidth(nativeEvent.layout.width)} style={styles.rail} {...railPanResponder.panHandlers}>
            <View style={styles.railTrack} />
            <View style={[styles.railFill, { width: `${progress}%` }]}><View style={styles.railThumb} /></View>
          </View>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </Animated.View>
    </View>
  );
}

function formatTime(value: number): string {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', backgroundColor: colors.codeBackground },
  video: StyleSheet.absoluteFill,
  surfaceTap: StyleSheet.absoluteFill,
  controls: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  playButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', paddingLeft: 2, borderRadius: 23, backgroundColor: 'rgba(12, 16, 14, 0.76)' },
  pressed: { transform: [{ scale: 0.92 }], opacity: 0.82 },
  bottomBar: { position: 'absolute', right: 10, bottom: 10, left: 10, minHeight: 34, paddingHorizontal: 8, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 6, backgroundColor: 'rgba(12, 16, 14, 0.72)' },
  controlPlayButton: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
  controlPressed: { transform: [{ scale: 0.84 }], opacity: 0.7 },
  time: { minWidth: 27, color: 'rgba(255,255,255,0.86)', fontFamily: 'monospace', fontSize: 9, textAlign: 'center' },
  rail: { height: 22, minWidth: 44, flex: 1, justifyContent: 'center' },
  railTrack: { position: 'absolute', right: 0, left: 0, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.3)' },
  railFill: { height: 2, borderRadius: 1, backgroundColor: 'rgba(255,255,255,0.86)' },
  railThumb: { position: 'absolute', top: -4, right: -5, width: 10, height: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.96)', borderRadius: 5, backgroundColor: 'rgba(12,16,14,0.9)' },
});
