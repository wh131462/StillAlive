import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors, spacing, typography } from '@still-alive/tokens';
import type { MusicShare } from '../music-share';
import { useAppState } from '../state/app-state';
import { MusicCover } from '../../features/music/music-cover';
import { useSharedMusicPlayback } from '../use-shared-music-playback';
import { createThemedStyles } from '../../shared/theme/app-theme';

export function MusicShareCard({ onRemove, share, variant = 'feed' }: { onRemove?: () => void; share: MusicShare; variant?: 'composer' | 'detail' | 'feed' }) {
  const { media, musicTracks } = useAppState();
  const playSharedMusic = useSharedMusicPlayback();
  const track = musicTracks.find((item) => item.id === share.trackId) ?? null;
  const playable = Boolean(track && media.some((item) => item.id === track.mediaId));
  const cover = track?.coverMediaId ? media.find((item) => item.id === track.coverMediaId) : null;
  const interactive = variant !== 'composer' && playable && track;
  const title = track?.title || share.title;
  const artist = track?.artist || share.artist || '未知艺术家';
  const album = track?.album || share.album;
  const label = variant === 'composer' ? '即将分享到空间' : playable ? '分享了一首歌' : '分享的歌曲已不在曲库';

  return (
    <Pressable
      accessibilityLabel={`${label}：${title}，${artist}`}
      accessibilityRole={interactive ? 'button' : undefined}
      disabled={!interactive}
      onPress={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        void playSharedMusic(interactive);
      }}
      style={({ pressed }) => [styles.card, variant === 'composer' && styles.cardComposer, pressed && styles.cardPressed]}
    >
      <MusicCover media={cover} size={variant === 'feed' ? 50 : 58} style={styles.cover} />
      <View style={styles.copy}>
        <Text style={styles.label}>{label}</Text>
        <Text numberOfLines={1} style={styles.title}>{title}</Text>
        <Text numberOfLines={1} style={styles.meta}>{artist}{album ? `，${album}` : ''}</Text>
      </View>
      {variant === 'composer' && onRemove ? (
        <Pressable accessibilityLabel="移除音乐分享" accessibilityRole="button" onPress={(event) => { event.stopPropagation(); onRemove(); }} style={({ pressed }) => [styles.removeAction, pressed && styles.actionPressed]}>
          <SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={18} tintColor={colors.inkSoft} type="hierarchical" />
        </Pressable>
      ) : (
        <View style={[styles.action, !playable && styles.actionUnavailable]}>
          <SymbolView name={{ android: playable ? 'play_arrow' : 'music_note', ios: playable ? 'play.fill' : 'music.note', web: playable ? 'play_arrow' : 'music_note' }} size={18} tintColor={playable ? colors.onLife : colors.inkFaint} type="hierarchical" />
        </View>
      )}
    </Pressable>
  );
}

const styles = createThemedStyles(() => ({
  card: { minHeight: 74, padding: spacing.sm, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, backgroundColor: colors.lifeLight },
  cardComposer: { minHeight: 82, backgroundColor: colors.paper },
  cardPressed: { opacity: 0.7 },
  cover: { borderRadius: 0 },
  copy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  label: { color: colors.life, fontFamily: typography.mono, fontSize: 8, fontWeight: '700', letterSpacing: 0.8 },
  title: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 15 },
  meta: { marginTop: 3, color: colors.inkFaint, fontSize: 9 },
  action: { width: 34, height: 34, marginLeft: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.life },
  actionUnavailable: { backgroundColor: colors.lineSoft },
  removeAction: { width: 34, height: 34, marginLeft: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.lineSoft },
  actionPressed: { opacity: 0.58 },
}));
