import { useEffect, useRef, useState } from 'react';
import { VideoView, useVideoPlayer } from 'expo-video';
import { PanResponder, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors } from '@still-alive/tokens';

export function MediaVideo({ active = true, style, uri }: { active?: boolean; style?: StyleProp<ViewStyle>; uri: string }) {
  const controlsHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const player = useVideoPlayer(uri, (currentPlayer) => {
    currentPlayer.timeUpdateEventInterval = 0.25;
  });
  const [playing, setPlaying] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [railWidth, setRailWidth] = useState(0);
  const durationRef = useRef(0);
  const railWidthRef = useRef(0);

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
      setControlsVisible(true);
    }
  }, [active, player]);

  useEffect(() => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    setControlsVisible(true);
    if (playing) {
      controlsHideTimerRef.current = setTimeout(() => setControlsVisible(false), 2200);
    }
    return () => {
      if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    };
  }, [playing]);

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
  })).current;

  const toggleControls = () => {
    if (controlsHideTimerRef.current) clearTimeout(controlsHideTimerRef.current);
    if (controlsVisible) {
      setControlsVisible(false);
      return;
    }
    setControlsVisible(true);
    if (playing) controlsHideTimerRef.current = setTimeout(() => setControlsVisible(false), 2200);
  };

  return (
    <View style={[styles.container, style]}>
      <VideoView contentFit="contain" nativeControls={false} player={player} style={styles.video} surfaceType="textureView" useExoShutter={false} />
      <Pressable accessibilityLabel={controlsVisible ? '隐藏视频控制器' : '显示视频控制器'} accessibilityRole="button" onPress={toggleControls} style={styles.surfaceTap} />
      {controlsVisible ? <View pointerEvents="box-none" style={styles.controls}>
        <Pressable accessibilityLabel={playing ? '暂停视频' : '播放视频'} accessibilityRole="button" onPress={togglePlayback} style={({ pressed }) => [styles.playButton, pressed && styles.pressed]}>
          <SymbolView name={{ android: playing ? 'pause' : 'play_arrow', ios: playing ? 'pause.fill' : 'play.fill', web: playing ? 'pause' : 'play_arrow' }} size={24} tintColor={colors.onLife} type="hierarchical" />
        </Pressable>
        <View style={styles.bottomBar}>
          <Text style={styles.time}>{formatTime(currentTime)}</Text>
          <View accessibilityLabel="调整视频进度" accessibilityRole="adjustable" onLayout={({ nativeEvent }) => setRailWidth(nativeEvent.layout.width)} style={styles.rail} {...railPanResponder.panHandlers}>
            <View style={[styles.railFill, { width: `${duration ? Math.min(100, (currentTime / duration) * 100) : 0}%` }]} />
          </View>
          <Text style={styles.time}>{formatTime(duration)}</Text>
        </View>
      </View> : null}
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
  playButton: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', paddingLeft: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.72)', borderRadius: 28, backgroundColor: colors.life },
  pressed: { transform: [{ scale: 0.94 }], opacity: 0.82 },
  bottomBar: { position: 'absolute', right: 12, bottom: 12, left: 12, minHeight: 32, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 7, borderRadius: 16, backgroundColor: 'rgba(16, 24, 20, 0.74)' },
  time: { color: 'rgba(255,255,255,0.86)', fontFamily: 'monospace', fontSize: 9 },
  rail: { height: 18, flex: 1, justifyContent: 'center' },
  railFill: { height: 3, borderRadius: 2, backgroundColor: colors.life },
});
