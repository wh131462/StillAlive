import { memo, useCallback, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Media, MusicQuality, MusicTrack } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { pickLocalAudioAssetsWithFailures } from '../../infrastructure/files/local-assets';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { orderMusicTracksByCollectionEntries } from './music-library';
import { useMusicPlayer } from './music-player-state';
import { MusicCover } from './music-cover';
import { MusicPlayCount } from './music-play-count';
import { MusicQualityBadge } from './music-quality';
import { QUALITY_OPTIONS } from './music-quality';
import { inferMusicQuality, readAudioFileMetadata } from '../../infrastructure/files/audio-file-metadata';
import { readEmbeddedMusicMetadata } from '../../infrastructure/files/music-cover-metadata';
import { saveMusicCopy } from './music-downloads';
import { reportMusicImportFailure, reportMusicImportFailures, type MusicImportFailure } from './music-import-coordinator';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';

export default function MusicPlaylistScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { addMusicTracksToPlaylist, deleteMusicPlaylist, discardMedia, importMusicTrack, media, musicCollectionEntries, musicPlaylistEntries, musicPlaylists, musicTracks, removeMusicTrackFromPlaylist, renameMusicPlaylist, setMusicPlaylistCover, setMusicTrackCover, updateMusicTrack } = useAppState();
  const player = useMusicPlayer();
  const [manageVisible, setManageVisible] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [renameVisible, setRenameVisible] = useState(false);
  const [importing, setImporting] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const [selectedTrackIds, setSelectedTrackIds] = useState<Set<string>>(new Set());
  const [actionTrack, setActionTrack] = useState<MusicTrack | null>(null);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingArtist, setEditingArtist] = useState('');
  const [editingAlbum, setEditingAlbum] = useState('');
  const [editingDurationMs, setEditingDurationMs] = useState<number | null>(null);
  const [editingQuality, setEditingQuality] = useState<MusicQuality | null>(null);
  const [pendingCover, setPendingCover] = useState<Media | null>(null);
  const [readingMetadata, setReadingMetadata] = useState(false);
  const importingRef = useRef(false);
  const playlist = musicPlaylists.find((item) => item.id === id);
  const tracks = useMemo(() => {
    const byId = new Map(musicTracks.map((track) => [track.id, track]));
    return musicPlaylistEntries
      .filter((entry) => entry.playlistId === id)
      .map((entry) => byId.get(entry.trackId))
      .filter((track): track is MusicTrack => Boolean(track));
  }, [id, musicPlaylistEntries, musicTracks]);
  const selfTracks = useMemo(() => orderMusicTracksByCollectionEntries(musicTracks, musicCollectionEntries.filter((entry) => entry.targetType === 'self')), [musicCollectionEntries, musicTracks]);
  const trackIds = useMemo(() => new Set(tracks.map((track) => track.id)), [tracks]);
  const availableTracks = useMemo(() => selfTracks.filter((track) => !trackIds.has(track.id)), [selfTracks, trackIds]);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);

  const playTrack = useCallback(async (track: MusicTrack) => {
    if (!playlist) return;
    if (player.currentTrack?.id !== track.id) {
      await player.playTrack(track.id, tracks.map((item) => item.id), 'playlist', playlist.id);
    }
    router.push('/music-player' as never);
  }, [playlist, player.currentTrack?.id, player.playTrack, router, tracks]);

  const playAll = () => {
    if (playlist && tracks[0]) void player.playTrack(tracks[0].id, tracks.map((track) => track.id), 'playlist', playlist.id);
  };

  const shuffleAll = async () => {
    if (!playlist || !tracks.length) return;
    await player.setMode('shuffle');
    const first = tracks[Math.floor(Math.random() * tracks.length)];
    await player.playTrack(first.id, tracks.map((track) => track.id), 'playlist', playlist.id);
  };

  const openPicker = () => {
    setSelectedTrackIds(new Set());
    setPickerVisible(true);
  };

  const toggleSelectedTrack = useCallback((trackId: string) => {
    setSelectedTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      return next;
    });
  }, []);

  const addSelectedTracks = async () => {
    if (!playlist || !selectedTrackIds.size) return;
    try {
      await addMusicTracksToPlaylist(playlist.id, [...selectedTrackIds]);
      setPickerVisible(false);
      setSelectedTrackIds(new Set());
    } catch (cause) {
      feedback.alert('添加失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const importLocalMusic = async () => {
    if (!playlist || importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    const importedTrackIds: string[] = [];
    try {
      const picked = await pickLocalAudioAssetsWithFailures();
      const failures: MusicImportFailure[] = picked.failures.map(({ cause, name }) => ({ cause, sourceName: name }));
      for (const asset of picked.assets) {
        try {
          const track = await importMusicTrack(asset);
          importedTrackIds.push(track.id);
        } catch (cause) {
          failures.push({ cause, sourceName: asset.originalName });
          await discardMedia(asset).catch(() => undefined);
        }
      }
      if (importedTrackIds.length) {
        await addMusicTracksToPlaylist(playlist.id, importedTrackIds);
        setPickerVisible(false);
      }
      if (failures.length) {
        const failure = reportMusicImportFailures(failures, { importedCount: importedTrackIds.length, joinedPlaylist: true });
        feedback.alert(failure.title, failure.message);
      }
    } catch (cause) {
      const failure = reportMusicImportFailure(cause);
      feedback.alert(failure.title, failure.message);
    } finally {
      importingRef.current = false;
      setImporting(false);
    }
  };

  const openRename = () => {
    if (!playlist) return;
    setManageVisible(false);
    setPlaylistName(playlist.name);
    setRenameVisible(true);
  };

  const saveName = async () => {
    if (!playlist || !playlistName.trim()) return;
    try {
      await renameMusicPlaylist(playlist.id, playlistName);
      setRenameVisible(false);
    } catch (cause) {
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const choosePlaylistCover = async () => {
    if (!playlist) return;
    setManageVisible(false);
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const item = await persistPickedImage(result.assets[0]);
    try {
      await setMusicPlaylistCover(playlist.id, item);
    } catch (cause) {
      await discardMedia(item).catch(() => undefined);
      feedback.alert('封面保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const resetPlaylistCover = async () => {
    if (!playlist) return;
    setManageVisible(false);
    try {
      await setMusicPlaylistCover(playlist.id, null);
    } catch (cause) {
      feedback.alert('封面保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const showPlaylistCoverActions = () => {
    if (!playlist) return;
    setManageVisible(false);
    feedback.alert('歌单封面', undefined, [
      { text: '更换封面', onPress: () => void choosePlaylistCover() },
      ...(playlist.coverMediaId ? [{ text: '恢复默认封面', style: 'destructive' as const, onPress: () => void resetPlaylistCover() }] : []),
      { text: '取消', style: 'cancel' },
    ]);
  };

  const confirmDeletePlaylist = () => {
    if (!playlist) return;
    setManageVisible(false);
    feedback.alert('删除歌单？', '只会删除歌单，不会删除音乐盒中的歌曲。', [
      { text: '取消', style: 'cancel' },
      { text: '删除', style: 'destructive', onPress: () => void deleteMusicPlaylist(playlist.id).then(() => router.back()).catch((cause: unknown) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。')) },
    ]);
  };

  const confirmRemoveTrack = (track: MusicTrack) => {
    if (!playlist) return;
    feedback.alert('移出歌单？', `“${track.title}”仍会保留在音乐盒中。`, [
      { text: '取消', style: 'cancel' },
      { text: '移出', style: 'destructive', onPress: () => void removeMusicTrackFromPlaylist(playlist.id, track.id) },
    ]);
  };

  const editTrack = (track: MusicTrack) => {
    setActionTrack(null); setEditingTrack(track); setEditingTitle(track.title); setEditingArtist(track.artist ?? ''); setEditingAlbum(track.album ?? ''); setEditingDurationMs(track.durationMs); setEditingQuality(track.quality);
  };

  const readTrackMetadata = async () => {
    if (!editingTrack || readingMetadata) return;
    const source = media.find((item) => item.id === editingTrack.mediaId);
    if (!source) return;
    setReadingMetadata(true);
    try {
      const embedded = await readEmbeddedMusicMetadata(source);
      const technical = await readAudioFileMetadata(source.localPath).catch(() => null);
      if (embedded.title) setEditingTitle(embedded.title);
      if (embedded.artist) setEditingArtist(embedded.artist);
      if (embedded.album) setEditingAlbum(embedded.album);
      if (technical?.durationMs !== null && technical?.durationMs !== undefined) setEditingDurationMs(technical.durationMs);
      if (technical) setEditingQuality(inferMusicQuality(technical.format, technical.bitrateKbps));
      if (embedded.cover) { if (pendingCover) await discardMedia(pendingCover).catch(() => undefined); setPendingCover(embedded.cover); }
    } catch (cause) { feedback.alert('元数据读取失败', cause instanceof Error ? cause.message : '请稍后重试。'); }
    finally { setReadingMetadata(false); }
  };

  const saveTrackEdit = async () => {
    if (!editingTrack || !editingTitle.trim()) return;
    try {
      await updateMusicTrack({ ...editingTrack, title: editingTitle.trim(), artist: editingArtist.trim() || null, album: editingAlbum.trim() || null, durationMs: editingDurationMs, quality: editingQuality, updatedAt: new Date().toISOString() }, pendingCover ?? undefined);
      setPendingCover(null); setEditingTrack(null);
    } catch (cause) { feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'); }
  };

  const showTrackCoverActions = (track: MusicTrack) => {
    setActionTrack(null);
    feedback.alert('歌曲封面', undefined, [
      { text: '更换封面', onPress: async () => { const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 }); if (!result.canceled && result.assets[0]) { const item = await persistPickedImage(result.assets[0]); await setMusicTrackCover(track.id, item).catch(async (cause) => { await discardMedia(item).catch(() => undefined); feedback.alert('封面保存失败', cause instanceof Error ? cause.message : '请稍后重试。'); }); } } },
      ...(track.coverMediaId ? [{ text: '恢复默认封面', style: 'destructive' as const, onPress: () => void setMusicTrackCover(track.id, null) }] : []),
      { text: '取消', style: 'cancel' },
    ]);
  };

  const showTrackActions = useCallback((track: MusicTrack) => setActionTrack(track), []);

  if (!playlist) return (
    <SafeAreaView style={styles.safe}>
      <ToolPageHeader onBack={() => router.back()} title="歌单" />
      <View style={styles.missing}><Text style={styles.emptyTitle}>歌单不存在</Text><Text style={styles.emptyText}>它可能已经被删除。</Text></View>
    </SafeAreaView>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <ToolPageHeader onBack={() => router.back()} right={<ToolPageHeaderAction accessibilityLabel="管理歌单" onPress={() => setManageVisible(true)}><VerticalMoreIcon /></ToolPageHeaderAction>} title={playlist.name} />

      <ScrollView contentContainerStyle={[styles.content, player.currentTrack && styles.contentPlaying]}>
        <View style={styles.summary}><MusicCover media={media.find((item) => item.id === playlist.coverMediaId)} size={82} style={styles.summaryCover} /><View style={styles.summaryCopy}><Text numberOfLines={2} style={styles.summaryTitle}>{playlist.name}</Text><Text style={styles.summaryMeta}>{tracks.length} 首歌曲</Text></View></View>
        <View style={styles.primaryActions}>
          <Pressable disabled={!tracks.length} onPress={playAll} style={({ pressed }) => [styles.playAll, !tracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={19} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.playAllText}>播放全部</Text></Pressable>
          <Pressable disabled={!tracks.length} onPress={() => void shuffleAll()} style={({ pressed }) => [styles.shuffle, !tracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'shuffle', ios: 'shuffle', web: 'shuffle' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.shuffleText}>随机播放</Text></Pressable>
        </View>
        <View style={styles.listHeader}><View style={styles.listTitleRow}><Text style={styles.listTitle}>歌曲</Text><Text style={styles.listCount}>{tracks.length}</Text></View><Pressable accessibilityLabel="添加歌曲" onPress={openPicker} style={styles.addButton}><SymbolView name={{ android: 'playlist_add', ios: 'text.badge.plus', web: 'playlist_add' }} size={21} tintColor={colors.life} type="hierarchical" /></Pressable></View>
        {tracks.length ? tracks.map((track) => <TrackRow key={track.id} media={media} selected={player.currentTrack?.id === track.id} track={track} onPlay={playTrack} onMore={showTrackActions} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>歌单还没有歌曲</Text><Text style={styles.emptyText}>从音乐盒或本地文件添加歌曲。</Text><Pressable accessibilityRole="button" onPress={openPicker} style={({ pressed }) => [styles.emptyAction, pressed && styles.emptyActionPressed]}><SymbolView name={{ android: 'playlist_add', ios: 'text.badge.plus', web: 'playlist_add' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.emptyActionText}>添加歌曲</Text></Pressable></View>}
      </ScrollView>

      <DraggableBottomSheet accessibilityRole="menu" onClose={() => setActionTrack(null)} open={Boolean(actionTrack)} sheetStyle={styles.actionSheet}>
        <View style={styles.actionPreview}><MusicCover media={media.find((item) => item.id === actionTrack?.coverMediaId)} size={56} /><View style={styles.previewCopy}><Text numberOfLines={1} style={styles.previewTitle}>{actionTrack?.title}</Text><Text numberOfLines={1} style={styles.previewMeta}>{actionTrack?.artist || '未知艺术家'}{actionTrack?.album ? ` / ${actionTrack.album}` : ''}</Text></View></View>
        <ActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑歌曲信息" onPress={() => actionTrack && editTrack(actionTrack)} />
        <ActionOption icon={{ android: 'info', ios: 'info.circle', web: 'info' }} label="文件信息" onPress={() => actionTrack && feedback.alert('文件信息', `歌曲：${actionTrack.title}\n时长：${formatDuration(actionTrack.durationMs)}`)} />
        <ActionOption icon={{ android: 'download', ios: 'arrow.down.to.line', web: 'download' }} label="下载" onPress={() => { const track = actionTrack; setActionTrack(null); if (track) { const source = media.find((item) => item.id === track.mediaId); if (source) void saveMusicCopy(source, track.title).then((result) => result && feedback.alert('下载完成', `已另存为“${result.fileName}”。`)).catch((cause) => feedback.alert('下载失败', cause instanceof Error ? cause.message : '请稍后重试。')); } }} />
        <ActionOption icon={{ android: 'image', ios: 'photo', web: 'image' }} label="管理歌曲封面" onPress={() => actionTrack && showTrackCoverActions(actionTrack)} />
        <ActionOption icon={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} label="移出歌单" onPress={() => actionTrack && (setActionTrack(null), confirmRemoveTrack(actionTrack))} />
        <Pressable onPress={() => setActionTrack(null)} style={styles.cancelAction}><Text style={styles.cancelText}>取消</Text></Pressable>
      </DraggableBottomSheet>

      <DraggableBottomSheet keyboardAvoiding onClose={() => setEditingTrack(null)} open={Boolean(editingTrack)} sheetStyle={styles.editSheet}>
        <Text style={styles.sheetTitle}>编辑歌曲信息</Text>
        <Pressable disabled={readingMetadata} onPress={() => void readTrackMetadata()} style={styles.metadataButton}>{readingMetadata ? <ActivityIndicator color={colors.life} size="small" /> : <SymbolView name={{ android: 'refresh', ios: 'arrow.clockwise', web: 'refresh' }} size={17} tintColor={colors.life} type="hierarchical" />}<Text style={styles.metadataButtonText}>{readingMetadata ? '正在读取' : '从文件读取元数据'}</Text></Pressable>
        <Text style={styles.inputLabel}>歌曲名称</Text><TextInput maxLength={80} onChangeText={setEditingTitle} style={styles.editInput} value={editingTitle} />
        <Text style={styles.inputLabel}>艺术家</Text><TextInput maxLength={80} onChangeText={setEditingArtist} style={styles.editInput} value={editingArtist} />
        <Text style={styles.inputLabel}>专辑</Text><TextInput maxLength={80} onChangeText={setEditingAlbum} style={styles.editInput} value={editingAlbum} />
        <Text style={styles.inputLabel}>音质标记</Text><View style={styles.qualityPicker}>{QUALITY_OPTIONS.map((option) => <Pressable key={option.value ?? 'none'} onPress={() => setEditingQuality(option.value)} style={[styles.qualityOption, editingQuality === option.value && styles.qualityOptionActive]}><Text style={[styles.qualityOptionText, editingQuality === option.value && styles.qualityOptionTextActive]}>{option.label}</Text></Pressable>)}</View>
        <Pressable disabled={!editingTitle.trim() || readingMetadata} onPress={() => void saveTrackEdit()} style={[styles.confirmButton, (!editingTitle.trim() || readingMetadata) && styles.disabled]}><Text style={styles.confirmButtonText}>保存</Text></Pressable>
      </DraggableBottomSheet>

      <DraggableBottomSheet onClose={() => setPickerVisible(false)} open={pickerVisible} sheetStyle={[styles.pickerSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
            <View style={styles.sheetHeader}><View><Text style={styles.sheetTitle}>添加歌曲</Text><Text style={styles.sheetMeta}>已选择 {selectedTrackIds.size} 首</Text></View><Pressable accessibilityLabel="关闭" onPress={() => setPickerVisible(false)} style={styles.sheetClose}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={19} tintColor={colors.inkSoft} type="hierarchical" /></Pressable></View>
            <Pressable disabled={importing} onPress={() => void importLocalMusic()} style={({ pressed }) => [styles.importButton, importing && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'upload_file', ios: 'square.and.arrow.down', web: 'upload_file' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.importText}>{importing ? '正在导入' : '从本地导入'}</Text></Pressable>
            <ScrollView contentContainerStyle={styles.pickerContent} style={styles.pickerList}>{availableTracks.map((track) => <PickerTrackRow key={track.id} checked={selectedTrackIds.has(track.id)} media={mediaById.get(track.coverMediaId ?? '')} onToggle={toggleSelectedTrack} track={track} />)}{!availableTracks.length ? <View style={styles.pickerEmpty}><Text style={styles.emptyText}>曲库中的歌曲都已加入这个歌单</Text></View> : null}</ScrollView>
            <Pressable disabled={!selectedTrackIds.size} onPress={() => void addSelectedTracks()} style={[styles.confirmButton, !selectedTrackIds.size && styles.disabled]}><Text style={styles.confirmButtonText}>添加 {selectedTrackIds.size ? `${selectedTrackIds.size} 首` : '歌曲'}</Text></Pressable>
      </DraggableBottomSheet>

      <DraggableBottomSheet accessibilityRole="menu" onClose={() => setManageVisible(false)} open={manageVisible} sheetStyle={styles.actionSheet}>
        <View style={styles.actionPlaylistHeader}><Pressable accessibilityHint="打开封面选项" accessibilityLabel="管理歌单封面" accessibilityRole="button" onPress={showPlaylistCoverActions} style={({ pressed }) => [styles.actionPlaylistCoverButton, pressed && styles.actionPlaylistCoverPressed]}><MusicCover media={media.find((item) => item.id === playlist.coverMediaId)} size={64} style={styles.actionPlaylistCover} /><View pointerEvents="none" style={styles.actionPlaylistCoverEdit}><SymbolView name={{ android: 'image', ios: 'photo', web: 'image' }} size={12} tintColor={colors.life} type="hierarchical" /></View></Pressable><View style={styles.actionPlaylistCopy}><Text style={styles.actionPlaylistLabel}>歌单</Text><Text numberOfLines={2} style={styles.actionPlaylistTitle}>{playlist.name}</Text><Text style={styles.actionPlaylistMeta}>{tracks.length} 首歌曲</Text></View></View><ActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="重命名歌单" onPress={openRename} /><ActionOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除歌单" onPress={confirmDeletePlaylist} /><Pressable onPress={() => setManageVisible(false)} style={styles.cancelAction}><Text style={styles.cancelText}>取消</Text></Pressable>
      </DraggableBottomSheet>

      <DraggableBottomSheet keyboardAvoiding onClose={() => setRenameVisible(false)} open={renameVisible} sheetStyle={styles.editSheet}>
        <Text style={styles.sheetTitle}>重命名歌单</Text><Text style={styles.inputLabel}>歌单名称</Text><TextInput autoFocus maxLength={40} onChangeText={setPlaylistName} onSubmitEditing={() => void saveName()} placeholder="输入歌单名称" placeholderTextColor={colors.inkFaint} returnKeyType="done" selectTextOnFocus style={styles.editInput} value={playlistName} /><Pressable disabled={!playlistName.trim()} onPress={() => void saveName()} style={[styles.confirmButton, !playlistName.trim() && styles.disabled]}><Text style={styles.confirmButtonText}>保存</Text></Pressable>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

const TrackRow = memo(function TrackRow({ media, onMore, onPlay, selected, track }: { media: Media[]; onMore(track: MusicTrack): void; onPlay(track: MusicTrack): void; selected: boolean; track: MusicTrack }) {
  return <View style={styles.trackRow}><Pressable accessibilityRole="button" onPress={() => onPlay(track)} style={({ pressed }) => [styles.trackMain, pressed && styles.pressed]}><MusicCover media={media.find((item) => item.id === track.coverMediaId)} size={44} style={styles.trackCover} /><View style={styles.trackCopy}><View style={styles.trackTitleRow}><Text numberOfLines={1} style={[styles.trackTitle, selected && styles.trackTitleActive]}>{track.title}</Text><MusicQualityBadge quality={track.quality} /></View><View style={styles.trackMetaRow}><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text><MusicPlayCount count={track.playCount} /></View></View></Pressable><Pressable accessibilityLabel={`管理 ${track.title}`} onPress={() => onMore(track)} style={styles.moreButton}><VerticalMoreIcon /></Pressable></View>;
});

const PickerTrackRow = memo(function PickerTrackRow({ checked, media, onToggle, track }: { checked: boolean; media?: Media; onToggle(trackId: string): void; track: MusicTrack }) {
  return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked }} onPress={() => onToggle(track.id)} style={({ pressed }) => [styles.pickerRow, pressed && styles.pressed]}><View style={[styles.checkbox, checked && styles.checkboxActive]}>{checked ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={15} tintColor={colors.onLife} type="hierarchical" /> : null}</View><MusicCover media={media} size={44} style={styles.pickerCover} /><View style={styles.trackCopy}><View style={styles.trackTitleRow}><Text numberOfLines={1} style={styles.trackTitle}>{track.title}</Text><MusicQualityBadge quality={track.quality} /></View><View style={styles.trackMetaRow}><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text><MusicPlayCount count={track.playCount} /></View></View></Pressable>;
});

function VerticalMoreIcon() {
  return <View pointerEvents="none" style={styles.moreIcon}>{[0, 1, 2].map((item) => <View key={item} style={styles.moreDot} />)}</View>;
}

function ActionOption({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.actionOption, pressed && styles.pressed]}><SymbolView name={icon} size={20} tintColor={destructive ? colors.danger : colors.ink} type="hierarchical" /><Text style={[styles.actionLabel, destructive && styles.actionLabelDanger]}>{label}</Text></Pressable>;
}

function formatDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) return '未知';
  const totalSeconds = Math.round(durationMs / 1_000);
  return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.paper },
  moreIcon: { width: 4, height: 17, alignItems: 'center', justifyContent: 'space-between' },
  moreDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.inkSoft },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  contentPlaying: { paddingBottom: 150 },
  summary: { paddingTop: spacing.md, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  summaryCover: { borderRadius: 6 },
  summaryCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  summaryTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 23, lineHeight: 30 },
  summaryMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 10 },
  primaryActions: { flexDirection: 'row', gap: spacing.sm },
  playAll: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.life },
  playAllText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  shuffle: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.sheet },
  shuffleText: { color: colors.life, fontSize: 12, fontWeight: '700' },
  listHeader: { minHeight: 54, marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  listTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  listCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  addButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  trackRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  trackMain: { flex: 1, minWidth: 0, minHeight: 66, flexDirection: 'row', alignItems: 'center' },
  trackCover: { borderRadius: radius.sm },
  trackCopy: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  trackTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  trackTitleRow: { minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  trackTitleActive: { color: colors.life },
  trackMetaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center' },
  trackMeta: { flex: 1, minWidth: 0, color: colors.inkFaint, fontSize: 10 },
  moreButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: spacing.xxl, alignItems: 'center' },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, textAlign: 'center' },
  emptyAction: { minWidth: 148, minHeight: 46, marginTop: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  emptyActionPressed: { opacity: 0.68 },
  emptyActionText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  handle: { width: 36, height: 4, marginBottom: spacing.md, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line },
  pickerSheet: { maxHeight: '82%', paddingTop: spacing.md, paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  sheetHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  sheetMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 9 },
  sheetClose: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  importButton: { minHeight: 48, marginTop: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  importText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  pickerList: { marginTop: spacing.sm },
  pickerContent: { paddingBottom: spacing.md },
  pickerRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  pickerCover: { marginLeft: spacing.xs, borderRadius: radius.sm },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  checkboxActive: { borderColor: colors.life, backgroundColor: colors.life },
  pickerEmpty: { minHeight: 120, alignItems: 'center', justifyContent: 'center' },
  confirmButton: { minHeight: 50, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  confirmButtonText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  actionSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  actionPreview: { minHeight: 72, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  previewCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  previewTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  previewMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 10 },
  actionPlaylistHeader: { minHeight: 88, marginBottom: spacing.sm, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper },
  actionPlaylistCoverButton: { width: 66, height: 66 },
  actionPlaylistCoverPressed: { opacity: 0.68 },
  actionPlaylistCover: { borderRadius: 6 },
  actionPlaylistCoverEdit: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper, borderRadius: 11, backgroundColor: colors.sheet },
  actionPlaylistCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  actionPlaylistLabel: { color: colors.inkFaint, fontSize: 10, letterSpacing: 1 },
  actionPlaylistTitle: { marginTop: 2, color: colors.ink, fontFamily: typography.display, fontSize: 18, lineHeight: 23 },
  actionPlaylistMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  actionOption: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  actionLabel: { color: colors.ink, fontSize: 12 },
  actionLabelDanger: { color: colors.danger },
  cancelAction: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  editSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  metadataButton: { minHeight: 44, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  metadataButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  inputLabel: { marginTop: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta },
  editInput: { minHeight: 52, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  qualityPicker: { marginTop: spacing.sm, flexDirection: 'row', gap: spacing.sm },
  qualityOption: { minWidth: 72, minHeight: 40, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper },
  qualityOptionActive: { borderColor: colors.lifeLine, backgroundColor: colors.lifeLight },
  qualityOptionText: { color: colors.inkFaint, fontSize: 11, fontWeight: '700' },
  qualityOptionTextActive: { color: colors.life },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.62 },
}));
