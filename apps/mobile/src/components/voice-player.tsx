import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';

const WAVE_HEIGHTS = [10, 16, 24, 15, 30, 19, 12, 27, 17, 32, 21, 14, 25, 18, 11, 22, 29, 16];

export default function VoicePlayer({ durationMs, uri }: { durationMs: number | null; uri: string }) {
  const player = useAudioPlayer(uri, { updateInterval: 250 });
  const status = useAudioPlayerStatus(player);
  const duration = status.duration || (durationMs ?? 0) / 1000;
  const progress = duration > 0 ? Math.min(1, status.currentTime / duration) : 0;
  const isFinished = duration > 0 && status.currentTime >= duration - 0.15;

  const togglePlayback = async () => {
    await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false });
    if (status.playing) {
      player.pause();
      return;
    }
    if (isFinished) await player.seekTo(0);
    player.play();
  };

  return (
    <Pressable accessibilityLabel={status.playing ? '暂停语音' : '播放语音'} accessibilityRole="button" onPress={() => void togglePlayback()} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.playButton}>
        <SymbolView name={{ android: status.playing ? 'pause' : 'play_arrow', ios: status.playing ? 'pause.fill' : 'play.fill', web: status.playing ? 'pause' : 'play_arrow' }} size={18} tintColor={colors.onLife} type="hierarchical" />
      </View>
      <View style={styles.content}>
        <View style={styles.wave}>
          {WAVE_HEIGHTS.map((height, index) => <View key={index} style={[styles.waveBar, { height }, index / WAVE_HEIGHTS.length <= progress && styles.waveBarPlayed]} />)}
        </View>
        <View style={styles.meta}>
          <Text style={styles.label}>{status.playing ? '正在播放' : '语音记录'}</Text>
          <Text style={styles.duration}>{formatDuration(duration * 1000)}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export function formatDuration(durationMs: number | null): string {
  const totalSeconds = Math.max(0, Math.round((durationMs ?? 0) / 1000));
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  card: { minHeight: 74, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.lifeLight },
  pressed: { opacity: 0.72 },
  playButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 21, backgroundColor: colors.life },
  content: { flex: 1, marginLeft: spacing.md },
  wave: { height: 34, flexDirection: 'row', alignItems: 'center', gap: 3 },
  waveBar: { width: 3, borderRadius: 2, backgroundColor: 'rgba(29, 107, 73, 0.22)' },
  waveBarPlayed: { backgroundColor: colors.life },
  meta: { marginTop: 3, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 0.8 },
  duration: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
});
