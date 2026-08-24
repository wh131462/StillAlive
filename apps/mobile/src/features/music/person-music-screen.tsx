import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { pickLocalAsset } from '../../infrastructure/files/local-assets';
import { useMusicPlayer } from './music-player-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { orderMusicTracksByCollectionEntries } from './music-library';
import { MusicCover } from './music-cover';
import { MusicPlayCount } from './music-play-count';
import { reportMusicImportFailure } from './music-import-coordinator';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';

export default function PersonMusicScreen() {
  const router = useRouter();
  const player = useMusicPlayer();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { addMusicCollectionEntry, importMusicTrack, media, musicCollectionEntries, musicTracks, people, removeMusicCollectionEntry } = useAppState();
  const [pickerVisible, setPickerVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const importingRef = useRef(false);
  const person = people.find((item) => item.id === personId);
  const personEntries = useMemo(() => musicCollectionEntries.filter((entry) => entry.targetType === 'person' && entry.targetId === personId), [musicCollectionEntries, personId]);
  const tracks = useMemo(() => orderMusicTracksByCollectionEntries(musicTracks, personEntries), [musicTracks, personEntries]);
  const trackIds = useMemo(() => new Set(tracks.map((track) => track.id)), [tracks]);
  const libraryTracks = useMemo(() => orderMusicTracksByCollectionEntries(musicTracks, musicCollectionEntries.filter((entry) => entry.targetType === 'self')), [musicCollectionEntries, musicTracks]);
  const availableTracks = useMemo(() => libraryTracks.filter((track) => !trackIds.has(track.id)), [libraryTracks, trackIds]);

  const importMusic = async () => {
    if (!person || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    let sourceName: string | null = null;
    try {
      const asset = await pickLocalAsset('audio');
      if (!asset) return;
      sourceName = asset.originalName ?? null;
      await importMusicTrack(asset, person.id);
      setPickerVisible(false);
    } catch (cause) {
      const failure = reportMusicImportFailure(cause, { sourceName });
      feedback.alert(failure.title, failure.message);
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  };

  const addExistingMusic = async (trackId: string) => {
    if (!person) return;
    try {
      await addMusicCollectionEntry({ trackId, targetType: 'person', targetId: person.id, createdAt: new Date().toISOString() });
    } catch (cause) {
      feedback.alert('添加音乐失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const playTrack = async (trackId: string) => {
    if (player.currentTrack?.id !== trackId) {
      await player.playTrack(trackId, tracks.map((track) => track.id), 'person', person?.id);
    }
    router.push('/music-player' as never);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderAction accessibilityLabel="添加音乐" disabled={!person} onPress={() => setPickerVisible(true)}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction>} title={person ? `${person.name}喜欢的音乐` : '喜欢的音乐'} />

      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.summary}><Text style={styles.summaryText}>{tracks.length} 首音乐</Text></View>
        {tracks.length ? tracks.map((track) => (
          <View key={track.id} style={styles.trackRow}>
            <Pressable accessibilityRole="button" onPress={() => void playTrack(track.id)} style={({ pressed }) => [styles.trackMain, pressed && styles.pressed]}>
              <MusicCover media={media.find((item) => item.id === track.coverMediaId)} size={44} style={styles.trackCover} />
              <View style={styles.trackCopy}><Text numberOfLines={1} style={[styles.trackTitle, player.currentTrack?.id === track.id && styles.trackTitleActive]}>{track.title}</Text><View style={styles.trackMetaRow}><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text><MusicPlayCount count={track.playCount} /></View></View>
            </Pressable>
            <Pressable accessibilityLabel={`从喜欢的音乐中移除 ${track.title}`} onPress={() => person && void removeMusicCollectionEntry(track.id, 'person', person.id)} style={styles.removeButton}><SymbolView name={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} size={19} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>
          </View>
        )) : <Pressable disabled={!person} onPress={() => setPickerVisible(true)} style={({ pressed }) => [styles.empty, pressed && styles.pressed]}><MusicCover size={96} style={styles.emptyCover} /><Text style={styles.emptyTitle}>还没有喜欢的音乐</Text><Text style={styles.emptyText}>从音乐盒选择，或导入本机音乐。</Text><Text style={styles.emptyAction}>添加音乐</Text></Pressable>}
      </ScrollView>

      <DraggableBottomSheet backdropStyle={styles.backdrop} onClose={() => setPickerVisible(false)} open={pickerVisible} sheetStyle={styles.sheet}>
            <Text style={styles.sheetTitle}>添加喜欢的音乐</Text>
            <Text style={styles.sheetHint}>可连续选择多首音乐</Text>
            <Pressable disabled={importing} onPress={() => void importMusic()} style={({ pressed }) => [styles.importButton, importing && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'upload_file', ios: 'square.and.arrow.down', web: 'upload_file' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.importText}>{importing ? '正在导入' : '导入新音乐'}</Text></Pressable>
            <ScrollView style={styles.musicList}>{availableTracks.map((track) => <Pressable key={track.id} onPress={() => void addExistingMusic(track.id)} style={({ pressed }) => [styles.musicChoice, pressed && styles.pressed]}><View style={styles.trackCopy}><Text numberOfLines={1} style={styles.trackTitle}>{track.title}</Text><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text></View><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={18} tintColor={colors.life} type="hierarchical" /></Pressable>)}{availableTracks.length === 0 ? <Text style={styles.musicEmpty}>音乐盒中没有可添加的其他音乐</Text> : null}</ScrollView>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  summary: { paddingVertical: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  summaryText: { color: colors.inkFaint, fontSize: 10 },
  trackRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  trackMain: { flex: 1, minWidth: 0, minHeight: 66, flexDirection: 'row', alignItems: 'center' },
  trackCover: { borderRadius: radius.sm },
  trackCopy: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  trackTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  trackTitleActive: { color: colors.life },
  trackMetaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center' },
  trackMeta: { flex: 1, minWidth: 0, color: colors.inkFaint, fontSize: 10 },
  removeButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: spacing.xl, paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyCover: { marginBottom: spacing.sm, borderRadius: 48 },
  emptyTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 },
  emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  sheet: { maxHeight: '72%', padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  sheetHint: { marginTop: spacing.xs, color: colors.inkFaint, fontSize: 10 },
  importButton: { minHeight: 52, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  importText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  musicList: { marginTop: spacing.sm },
  musicChoice: { minHeight: 58, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  musicEmpty: { paddingVertical: spacing.xl, color: colors.inkFaint, fontSize: 10, textAlign: 'center' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.62 },
}));
