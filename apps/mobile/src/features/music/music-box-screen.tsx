import { useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Media, MusicPlaylist, MusicTrack } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { readAudioFileMetadata } from '../../infrastructure/files/audio-file-metadata';
import type { AudioFileFormat, AudioFileMetadata } from '../../infrastructure/files/audio-file-metadata';
import { pickLocalAudioAssetsWithFailures } from '../../infrastructure/files/local-assets';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import { useMusicPlayer } from './music-player-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderAction, ToolPageOverview } from '../../shared/components/tool-page-header';
import { orderMusicTracksByCollectionEntries } from './music-library';
import { MusicCover } from './music-cover';
import { MusicPlayCount } from './music-play-count';
import { saveMusicCopy } from './music-downloads';
import { reportMusicImportFailure, reportMusicImportFailures, type MusicImportFailure } from './music-import-coordinator';

type MusicBoxListItem = { kind: 'search' } | { kind: 'track'; track: MusicTrack };

export default function MusicBoxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createMusicPlaylist, deleteMusicTrack, discardMedia, importMusicTrack, media, musicCollectionEntries, musicPlaylistEntries, musicPlaylists, musicTracks, removeMusicCollectionEntry, setMusicTrackCover, updateMusicTrack } = useAppState();
  const player = useMusicPlayer();
  const [search, setSearch] = useState('');
  const [actionTrack, setActionTrack] = useState<MusicTrack | null>(null);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [infoTrack, setInfoTrack] = useState<MusicTrack | null>(null);
  const [audioMetadata, setAudioMetadata] = useState<AudioFileMetadata | null>(null);
  const [loadingMetadata, setLoadingMetadata] = useState(false);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingArtist, setEditingArtist] = useState('');
  const [editingAlbum, setEditingAlbum] = useState('');
  const [importing, setImporting] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const importingRef = useRef(false);
  const metadataRequestRef = useRef(0);
  const selfTracks = useMemo(() => orderMusicTracksByCollectionEntries(musicTracks, musicCollectionEntries.filter((entry) => entry.targetType === 'self')), [musicCollectionEntries, musicTracks]);
  const visibleTracks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return selfTracks;
    return selfTracks.filter((track) => `${track.title} ${track.artist ?? ''} ${track.album ?? ''}`.toLocaleLowerCase().includes(query));
  }, [search, selfTracks]);
  const listItems = useMemo<MusicBoxListItem[]>(() => [
    { kind: 'search' },
    ...visibleTracks.map((track) => ({ kind: 'track' as const, track })),
  ], [visibleTracks]);
  const miniPlayerClearance = Math.max(84, insets.bottom + spacing.md) + 44 + spacing.md;

  const importMusic = async () => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    try {
      const picked = await pickLocalAudioAssetsWithFailures();
      const failures: MusicImportFailure[] = picked.failures.map(({ cause, name }) => ({ cause, sourceName: name }));
      let importedCount = 0;
      for (const asset of picked.assets) {
        try {
          await importMusicTrack(asset);
          importedCount += 1;
        } catch (cause) {
          failures.push({ cause, sourceName: asset.originalName });
          await discardMedia(asset).catch(() => undefined);
        }
      }
      if (failures.length) {
        const failure = reportMusicImportFailures(failures, { importedCount });
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

  const edit = (track: MusicTrack) => {
    setActionTrack(null);
    setEditingTitle(track.title);
    setEditingArtist(track.artist ?? '');
    setEditingAlbum(track.album ?? '');
    setEditingTrack(track);
  };

  const saveEdit = async () => {
    const title = editingTitle.trim();
    if (!editingTrack || !title) return;
    try {
      await updateMusicTrack({ ...editingTrack, title, artist: editingArtist.trim() || null, album: editingAlbum.trim() || null, updatedAt: new Date().toISOString() });
      setEditingTrack(null);
    } catch (cause) {
      feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const closeTrackInfo = () => {
    metadataRequestRef.current += 1;
    setInfoTrack(null);
    setAudioMetadata(null);
    setLoadingMetadata(false);
  };

  const showTrackInfo = (track: MusicTrack) => {
    const requestId = ++metadataRequestRef.current;
    const sourceMedia = media.find((item) => item.id === track.mediaId);
    setActionTrack(null);
    setInfoTrack(track);
    setAudioMetadata(null);
    setLoadingMetadata(Boolean(sourceMedia));
    if (!sourceMedia) return;
    void readAudioFileMetadata(sourceMedia.localPath)
      .then((result) => {
        if (metadataRequestRef.current === requestId) setAudioMetadata(result);
      })
      .catch(() => undefined)
      .finally(() => {
        if (metadataRequestRef.current === requestId) setLoadingMetadata(false);
      });
  };

  const chooseTrackCover = async (track: MusicTrack) => {
    setActionTrack(null);
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled || !result.assets[0]) return;
    const item = await persistPickedImage(result.assets[0]);
    try {
      await setMusicTrackCover(track.id, item);
    } catch (cause) {
      await discardMedia(item).catch(() => undefined);
      feedback.alert('封面保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const resetTrackCover = async (track: MusicTrack) => {
    setActionTrack(null);
    try {
      await setMusicTrackCover(track.id, null);
    } catch (cause) {
      feedback.alert('封面保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const showTrackCoverActions = (track: MusicTrack) => {
    setActionTrack(null);
    feedback.alert('歌曲封面', undefined, [
      { text: '更换封面', onPress: () => void chooseTrackCover(track) },
      ...(track.coverMediaId ? [{ text: '恢复默认封面', style: 'destructive' as const, onPress: () => void resetTrackCover(track) }] : []),
      { text: '取消', style: 'cancel' },
    ]);
  };

  const downloadTrack = async (track: MusicTrack) => {
    setActionTrack(null);
    const sourceMedia = media.find((item) => item.id === track.mediaId);
    if (!sourceMedia) {
      feedback.alert('下载失败', '找不到歌曲文件，请重新导入后再试。');
      return;
    }
    try {
      const result = await saveMusicCopy(sourceMedia, track.title);
      if (result) feedback.alert('下载完成', `已另存为“${result.fileName}”。`);
    } catch (cause) {
      feedback.alert('下载失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const removeFromBox = (track: MusicTrack) => {
    setActionTrack(null);
    feedback.alert('移出音乐盒？', '人物收藏不会受到影响；若没有人物收藏，本地文件和歌单记录也会一并删除。', [
      { text: '取消', style: 'cancel' },
      { text: '移出', style: 'destructive', onPress: () => void removeMusicCollectionEntry(track.id, 'self', null) },
    ]);
  };

  const deleteEverywhere = (track: MusicTrack) => {
    setActionTrack(null);
    feedback.alert('永久删除曲目？', '本地文件、全部人物收藏和歌单记录都会被删除，此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '永久删除', style: 'destructive', onPress: () => void deleteMusicTrack(track.id) },
    ]);
  };

  const playTrack = async (track: MusicTrack) => {
    if (player.currentTrack?.id !== track.id) {
      await player.playTrack(track.id, visibleTracks.map((item) => item.id), 'self');
    }
    router.push('/music-player' as never);
  };

  const playAll = () => {
    const first = selfTracks[0];
    if (first) void player.playTrack(first.id, selfTracks.map((track) => track.id), 'self');
  };

  const shuffleAll = async () => {
    if (!selfTracks.length) return;
    await player.setMode('shuffle');
    const first = selfTracks[Math.floor(Math.random() * selfTracks.length)];
    await player.playTrack(first.id, selfTracks.map((track) => track.id), 'self');
  };

  const createPlaylist = async () => {
    if (!playlistName.trim()) return;
    try {
      const playlist = await createMusicPlaylist(playlistName);
      setPlaylistName('');
      setCreatePlaylistVisible(false);
      router.push({ pathname: '/music-playlist', params: { id: playlist.id } } as never);
    } catch (cause) {
      feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const openPlaylist = (playlist: MusicPlaylist) => {
    router.push({ pathname: '/music-playlist', params: { id: playlist.id } } as never);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ToolPageHeader
        onBack={() => router.back()}
        right={<ToolPageHeaderAction accessibilityLabel={importing ? '正在导入音乐' : '导入音乐'} disabled={importing} onPress={() => void importMusic()}>{importing ? <ActivityIndicator color={colors.life} size="small" /> : <SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={23} tintColor={colors.life} type="hierarchical" />}</ToolPageHeaderAction>}
        title="我的音乐盒"
      />

      <FlatList
        contentContainerStyle={[styles.content, player.currentTrack && { paddingBottom: miniPlayerClearance }]}
        data={listItems}
        extraData={player.currentTrack?.id}
        initialNumToRender={12}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        keyExtractor={(item) => item.kind === 'search' ? 'search' : item.track.id}
        ListFooterComponent={visibleTracks.length ? null : (
          <View style={styles.empty}>
            <MusicCover size={88} style={styles.emptyCover} />
            <Text style={styles.emptyTitle}>{selfTracks.length ? '没有找到匹配歌曲' : '音乐盒还是空的'}</Text>
            <Text style={styles.emptyText}>{selfTracks.length ? '换一个关键词再试试。' : '导入本机音乐，建立你的本地曲库。'}</Text>
            {!selfTracks.length ? <Pressable disabled={importing} onPress={() => void importMusic()} style={[styles.emptyAction, importing && styles.disabled]}><Text style={styles.emptyActionText}>{importing ? '正在导入' : '导入音乐'}</Text></Pressable> : null}
          </View>
        )}
        ListHeaderComponent={(
          <View>
            <View style={styles.libraryArea}>
              <ToolPageOverview
                eyebrow="本地曲库"
                icon={<MusicCover size={56} />}
                subtitle={musicPlaylists.length ? `${musicPlaylists.length} 个歌单，音乐和封面都保存在本机。` : '收好喜欢的声音，按歌单慢慢整理。'}
                title={`${selfTracks.length} 首音乐`}
                trailing={<View style={styles.libraryActions}>
                  <Pressable accessibilityLabel="随机播放" accessibilityRole="button" disabled={!selfTracks.length} onPress={() => void shuffleAll()} style={({ pressed }) => [styles.shuffleAction, !selfTracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'shuffle', ios: 'shuffle', web: 'shuffle' }} size={19} tintColor={colors.life} type="hierarchical" /></Pressable>
                  <Pressable accessibilityLabel="播放全部" accessibilityRole="button" disabled={!selfTracks.length} onPress={playAll} style={({ pressed }) => [styles.playAction, !selfTracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={24} tintColor={colors.onLife} type="hierarchical" /></Pressable>
                </View>}
              />
              <View style={styles.sectionHeader}>
                <View style={styles.sectionTitleRow}><Text style={styles.sectionTitle}>歌单</Text><Text style={styles.sectionCount}>{musicPlaylists.length}</Text></View>
                <Pressable accessibilityLabel="创建歌单" onPress={() => setCreatePlaylistVisible(true)} style={styles.sectionAction}><SymbolView name={{ android: 'playlist_add', ios: 'text.badge.plus', web: 'playlist_add' }} size={21} tintColor={colors.life} type="hierarchical" /></Pressable>
              </View>
            </View>
            {musicPlaylists.length ? (
              <ScrollView horizontal contentContainerStyle={styles.playlistContent} showsHorizontalScrollIndicator={false}>
                {musicPlaylists.map((playlist) => {
                  const trackCount = musicPlaylistEntries.filter((entry) => entry.playlistId === playlist.id).length;
                  return <Pressable key={playlist.id} accessibilityRole="button" onPress={() => openPlaylist(playlist)} style={({ pressed }) => [styles.playlistCard, pressed && styles.pressed]}><MusicCover media={media.find((item) => item.id === playlist.coverMediaId)} size={88} style={styles.playlistCover} /><Text numberOfLines={1} style={styles.playlistName}>{playlist.name}</Text><Text style={styles.playlistMeta}>{trackCount} 首歌曲</Text></Pressable>;
                })}
              </ScrollView>
            ) : (
              <View style={styles.playlistEmptyArea}><Pressable onPress={() => setCreatePlaylistVisible(true)} style={({ pressed }) => [styles.playlistEmpty, pressed && styles.pressed]}><View><Text style={styles.playlistEmptyTitle}>创建第一张歌单</Text><Text style={styles.playlistEmptyText}>把喜欢的音乐整理到一起</Text></View><Text style={styles.playlistEmptyAction}>创建</Text></Pressable></View>
            )}
          </View>
        )}
        renderItem={({ item }) => item.kind === 'search' ? (
          <View style={styles.searchDock}>
            <View style={styles.searchBar}><SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /><TextInput onChangeText={setSearch} placeholder="搜索歌曲、艺术家或专辑" placeholderTextColor={colors.inkFaint} style={styles.searchInput} value={search} />{search ? <Pressable accessibilityLabel="清除搜索" onPress={() => setSearch('')} style={styles.clearSearch}><SymbolView name={{ android: 'cancel', ios: 'xmark.circle.fill', web: 'cancel' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}</View>
            <View style={styles.listHeader}><Text style={styles.listTitle}>{search ? '搜索结果' : '全部歌曲'}</Text><Text style={styles.listCount}>{visibleTracks.length} 首</Text></View>
          </View>
        ) : <TrackRow media={media} selected={player.currentTrack?.id === item.track.id} track={item.track} onMore={() => setActionTrack(item.track)} onPlay={() => void playTrack(item.track)} />}
        showsVerticalScrollIndicator={false}
        stickyHeaderIndices={[1]}
        windowSize={7}
      />

      <DraggableBottomSheet accessibilityLabel="向下拖动关闭菜单" accessibilityRole="menu" backdropStyle={styles.backdrop} onClose={() => setActionTrack(null)} open={Boolean(actionTrack)} sheetStyle={styles.actionSheet}>
              <View style={styles.actionPreview}><Pressable accessibilityHint="打开封面选项" accessibilityLabel="管理歌曲封面" accessibilityRole="button" onPress={() => actionTrack && showTrackCoverActions(actionTrack)} style={({ pressed }) => [styles.previewCoverButton, pressed && styles.previewCoverPressed]}><MusicCover media={media.find((item) => item.id === actionTrack?.coverMediaId)} size={56} style={styles.previewCover} /><View pointerEvents="none" style={styles.previewCoverEdit}><SymbolView name={{ android: 'image', ios: 'photo', web: 'image' }} size={12} tintColor={colors.life} type="hierarchical" /></View></Pressable><View style={styles.previewCopy}><Text numberOfLines={1} style={styles.previewTitle}>{actionTrack?.title}</Text><Text numberOfLines={1} style={styles.previewMeta}>{actionTrack?.artist || '未知艺术家'}{actionTrack?.album ? ` / ${actionTrack.album}` : ''}</Text></View></View>
              <ActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑歌曲信息" onPress={() => actionTrack && edit(actionTrack)} />
              <ActionOption icon={{ android: 'info', ios: 'info.circle', web: 'info' }} label="文件信息" onPress={() => actionTrack && showTrackInfo(actionTrack)} />
              <ActionOption icon={{ android: 'download', ios: 'arrow.down.to.line', web: 'download' }} label="下载" onPress={() => actionTrack && void downloadTrack(actionTrack)} />
              <ActionOption icon={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} label="移出音乐盒" onPress={() => actionTrack && removeFromBox(actionTrack)} />
              <ActionOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="永久删除曲目" onPress={() => actionTrack && deleteEverywhere(actionTrack)} />
              <Pressable onPress={() => setActionTrack(null)} style={styles.cancelAction}><Text style={styles.cancelText}>取消</Text></Pressable>
      </DraggableBottomSheet>

      <TrackFileInfoSheet
        cover={media.find((item) => item.id === infoTrack?.coverMediaId)}
        file={media.find((item) => item.id === infoTrack?.mediaId)}
        loading={loadingMetadata}
        metadata={audioMetadata}
        onClose={closeTrackInfo}
        open={Boolean(infoTrack)}
        track={infoTrack}
      />

      <DraggableBottomSheet backdropStyle={styles.backdrop} keyboardAvoiding onClose={() => setEditingTrack(null)} open={Boolean(editingTrack)} sheetStyle={styles.editSheet}>
              <Text style={styles.editTitle}>编辑歌曲信息</Text>
              <Text style={styles.inputLabel}>歌曲名称</Text>
              <TextInput autoFocus maxLength={80} onChangeText={setEditingTitle} placeholder="输入歌曲名称" placeholderTextColor={colors.inkFaint} returnKeyType="next" selectTextOnFocus style={styles.editInput} value={editingTitle} />
              <Text style={styles.inputLabel}>艺术家</Text>
              <TextInput maxLength={80} onChangeText={setEditingArtist} placeholder="未知艺术家" placeholderTextColor={colors.inkFaint} returnKeyType="next" style={styles.editInput} value={editingArtist} />
              <Text style={styles.inputLabel}>专辑</Text>
              <TextInput maxLength={80} onChangeText={setEditingAlbum} onSubmitEditing={() => void saveEdit()} placeholder="未收录专辑" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.editInput} value={editingAlbum} />
              <Pressable accessibilityRole="button" disabled={!editingTitle.trim()} onPress={() => void saveEdit()} style={({ pressed }) => [styles.saveEdit, !editingTitle.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveEditText}>保存</Text></Pressable>
      </DraggableBottomSheet>

      <DraggableBottomSheet backdropStyle={styles.backdrop} keyboardAvoiding onClose={() => setCreatePlaylistVisible(false)} open={createPlaylistVisible} sheetStyle={styles.editSheet}>
              <Text style={styles.editTitle}>创建歌单</Text>
              <Text style={styles.inputLabel}>歌单名称</Text>
              <TextInput autoFocus maxLength={40} onChangeText={setPlaylistName} onSubmitEditing={() => void createPlaylist()} placeholder="例如：雨天散步" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.editInput} value={playlistName} />
              <Pressable accessibilityRole="button" disabled={!playlistName.trim()} onPress={() => void createPlaylist()} style={({ pressed }) => [styles.saveEdit, !playlistName.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveEditText}>创建</Text></Pressable>
      </DraggableBottomSheet>
    </SafeAreaView>
  );
}

function TrackRow({ media, selected, track, onMore, onPlay }: { media: Media[]; selected: boolean; track: MusicTrack; onMore(): void; onPlay(): void }) {
  return <View style={[styles.trackRow, selected && styles.trackRowActive]}>{selected ? <View style={styles.playingRail} /> : null}<Pressable accessibilityRole="button" onPress={onPlay} style={({ pressed }) => [styles.trackMain, pressed && styles.pressed]}><MusicCover media={media.find((item) => item.id === track.coverMediaId)} size={46} style={styles.trackCover} /><View style={styles.trackCopy}><Text numberOfLines={1} style={[styles.trackTitle, selected && styles.trackTitleActive]}>{track.title}</Text><View style={styles.trackMetaRow}><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text><MusicPlayCount count={track.playCount} /></View></View></Pressable><Pressable accessibilityLabel={`管理 ${track.title}`} onPress={onMore} style={styles.moreButton}><VerticalMoreIcon /></Pressable></View>;
}

function TrackFileInfoSheet({ cover, file, loading, metadata, onClose, open, track }: { cover: Media | undefined; file: Media | undefined; loading: boolean; metadata: AudioFileMetadata | null; onClose(): void; open: boolean; track: MusicTrack | null }) {
  const insets = useSafeAreaInsets();
  if (!track) return null;
  const dynamicValue = (value: string) => loading && value === '未知' ? '读取中' : value;
  const duration = metadata?.durationMs ?? track.durationMs;
  return (
    <DraggableBottomSheet accessibilityLabel="歌曲文件信息，向下拖动关闭" backdropStyle={styles.backdrop} onClose={onClose} open={open} sheetStyle={[styles.infoSheet, { paddingBottom: Math.max(spacing.lg, insets.bottom + spacing.md) }]}>
      <View style={styles.infoHeader}>
        <MusicCover media={cover} size={52} style={styles.infoCover} />
        <View style={styles.infoHeaderCopy}><View style={styles.infoTitleRow}><Text style={styles.infoTitle}>文件信息</Text>{loading ? <ActivityIndicator color={colors.life} size="small" /> : null}</View><Text numberOfLines={1} style={styles.infoTrackTitle}>{track.title}</Text><Text numberOfLines={1} style={styles.infoTrackMeta}>{track.artist || '未知艺术家'}</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.infoContent} showsVerticalScrollIndicator={false} style={styles.infoScroll}>
        <Text style={styles.infoSectionLabel}>音频参数</Text>
        <View style={styles.infoAudioCard}>
          <View style={styles.infoPrimaryMetrics}>
            <InfoMetric label="音频格式" value={formatAudioType(file, metadata?.format ?? null)} />
            <InfoMetric label="时长" value={dynamicValue(formatTrackDuration(duration))} />
            <InfoMetric label="码率" value={dynamicValue(formatBitrate(metadata?.bitrateKbps ?? null))} />
          </View>
          <View style={styles.infoMetricDivider} />
          <View style={styles.infoSecondaryMetrics}>
            <InfoMetric label="采样率" value={dynamicValue(formatSampleRate(metadata?.sampleRateHz ?? null))} />
            <InfoMetric label="声道数" value={dynamicValue(formatChannels(metadata?.channels ?? null))} />
          </View>
        </View>
        <Text style={styles.infoSectionLabel}>文件</Text>
        <View style={styles.infoFileCard}>
          <FileInfoRow label="原始文件名" value={originalFileName(file)} />
          <FileInfoRow label="文件大小" value={formatFileSize(file?.sizeBytes ?? metadata?.fileSizeBytes ?? null)} />
          <FileInfoRow label="导入时间" value={formatImportedAt(file?.createdAt)} />
          <FileInfoRow last label="应用内保存位置" lines={4} value={formatLocalPath(file?.localPath)} />
        </View>
      </ScrollView>
    </DraggableBottomSheet>
  );
}

function InfoMetric({ label, value }: { label: string; value: string }) {
  return <View style={styles.infoMetric}><Text style={styles.infoMetricLabel}>{label}</Text><Text numberOfLines={1} style={styles.infoMetricValue}>{value}</Text></View>;
}

function FileInfoRow({ label, last = false, lines = 2, value }: { label: string; last?: boolean; lines?: number; value: string }) {
  return <View style={[styles.infoFileRow, last && styles.infoFileRowLast]}><Text style={styles.infoFileLabel}>{label}</Text><Text numberOfLines={lines} style={styles.infoFileValue}>{value}</Text></View>;
}

function VerticalMoreIcon() {
  return <View pointerEvents="none" style={styles.moreIcon}>{[0, 1, 2].map((item) => <View key={item} style={styles.moreDot} />)}</View>;
}

function ActionOption({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  const tint = destructive ? colors.danger : colors.ink;
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.actionOption, pressed && styles.pressed]}><SymbolView name={icon} size={20} tintColor={tint} type="hierarchical" /><Text style={[styles.actionLabel, destructive && styles.actionLabelDanger]}>{label}</Text></Pressable>;
}

function formatAudioType(file: Media | undefined, detected: AudioFileFormat | null): string {
  if (detected) return detected;
  const types: Record<string, AudioFileFormat> = {
    'audio/aac': 'AAC',
    'audio/flac': 'FLAC',
    'audio/mp4': 'M4A',
    'audio/mpeg': 'MP3',
    'audio/ogg': 'OGG',
    'audio/wav': 'WAV',
  };
  const fromMime = file ? types[file.mimeType.toLowerCase()] : undefined;
  if (fromMime) return fromMime;
  const extension = file?.originalName?.match(/\.([a-z0-9]+)$/i)?.[1]
    ?? file?.localPath.match(/\.([a-z0-9]+)(?:\?|$)/i)?.[1];
  return extension?.toUpperCase() || '未知';
}

function formatTrackDuration(durationMs: number | null): string {
  if (durationMs === null || !Number.isFinite(durationMs) || durationMs < 0) return '未知';
  const totalSeconds = Math.round(durationMs / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor(totalSeconds % 3_600 / 60);
  const seconds = totalSeconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
    : `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatBitrate(value: number | null): string {
  return value !== null && Number.isFinite(value) && value > 0 ? `${Math.round(value)} kbps` : '未知';
}

function formatSampleRate(value: number | null): string {
  if (value === null || !Number.isFinite(value) || value <= 0) return '未知';
  const kilohertz = value / 1_000;
  return `${Number.isInteger(kilohertz) ? kilohertz.toFixed(0) : kilohertz.toFixed(1)} kHz`;
}

function formatChannels(value: number | null): string {
  if (value === 1) return '单声道';
  if (value === 2) return '立体声';
  return value !== null && Number.isFinite(value) && value > 0 ? `${Math.round(value)} 声道` : '未知';
}

function originalFileName(file: Media | undefined): string {
  if (file?.originalName) return file.originalName;
  if (!file?.localPath) return '未知';
  const value = file.localPath.split('/').pop()?.split('?')[0];
  if (!value) return '未知';
  try { return decodeURIComponent(value); } catch { return value; }
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null || !Number.isFinite(bytes) || bytes < 0) return '未知';
  if (bytes < 1_024) return `${Math.round(bytes)} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

function formatImportedAt(value: string | undefined): string {
  if (!value) return '未知';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatLocalPath(value: string | undefined): string {
  if (!value) return '未知';
  const path = value.startsWith('file://') ? value.slice('file://'.length) : value;
  try { return decodeURI(path); } catch { return path; }
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.paper },
  content: { paddingBottom: spacing.xxl },
  libraryArea: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg },
  libraryActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shuffleAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 21, backgroundColor: colors.paper },
  playAction: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.life },
  sectionHeader: { minHeight: 54, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  sectionCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10 },
  sectionAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  playlistContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.xs },
  playlistCard: { width: 96 },
  playlistCover: { borderRadius: 6 },
  playlistName: { marginTop: spacing.sm, color: colors.ink, fontSize: 12, fontWeight: '600' },
  playlistMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 10 },
  playlistEmptyArea: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
  playlistEmpty: { minHeight: 66, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.sheet },
  playlistEmptyTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  playlistEmptyText: { marginTop: 4, color: colors.inkFaint, fontSize: 11 },
  playlistEmptyAction: { color: colors.life, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.62 },
  searchDock: { paddingTop: spacing.sm, paddingHorizontal: spacing.lg, backgroundColor: colors.paper },
  searchBar: { minHeight: 46, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet },
  searchInput: { flex: 1, minHeight: 46, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 12 },
  clearSearch: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  listHeader: { minHeight: 50, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  listCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10 },
  trackRow: { minHeight: 70, paddingLeft: spacing.lg, paddingRight: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  trackRowActive: { backgroundColor: colors.lifeLight },
  playingRail: { position: 'absolute', top: spacing.md, bottom: spacing.md, left: spacing.sm, width: 3, borderRadius: 2, backgroundColor: colors.life },
  trackMain: { flex: 1, minWidth: 0, minHeight: 70, flexDirection: 'row', alignItems: 'center' },
  trackCover: { borderRadius: radius.sm },
  trackCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  trackTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  trackTitleActive: { color: colors.life },
  trackMetaRow: { marginTop: 5, flexDirection: 'row', alignItems: 'center' },
  trackMeta: { flex: 1, minWidth: 0, color: colors.inkFaint, fontSize: 11 },
  moreButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  moreIcon: { width: 4, height: 17, alignItems: 'center', justifyContent: 'space-between' },
  moreDot: { width: 3, height: 3, borderRadius: 1.5, backgroundColor: colors.inkFaint },
  empty: { paddingHorizontal: spacing.lg, paddingVertical: spacing.xl, alignItems: 'center' },
  emptyCover: { marginBottom: spacing.md, borderRadius: 44 },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  emptyAction: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  emptyActionText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  actionSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  actionSheetGrabber: { minHeight: 32, marginTop: -spacing.sm, alignItems: 'center', justifyContent: 'flex-start' },
  actionSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line },
  handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line },
  actionPreview: { minHeight: 72, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  previewCoverButton: { width: 58, height: 58 },
  previewCoverPressed: { opacity: 0.68 },
  previewCover: { borderRadius: radius.sm },
  previewCoverEdit: { position: 'absolute', right: 0, bottom: 0, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.sheet, borderRadius: 11, backgroundColor: colors.paper },
  previewCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  previewTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  previewMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 10 },
  actionOption: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  actionLabel: { color: colors.ink, fontSize: 12 },
  actionLabelDanger: { color: colors.danger },
  cancelAction: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  infoSheet: { maxHeight: '88%', paddingHorizontal: spacing.lg, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  infoHeader: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  infoCover: { borderRadius: radius.sm },
  infoHeaderCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  infoTitleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  infoTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  infoTrackTitle: { marginTop: 4, color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  infoTrackMeta: { marginTop: 2, color: colors.inkFaint, fontSize: 10 },
  infoScroll: { flexShrink: 1 },
  infoContent: { paddingTop: spacing.md },
  infoSectionLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
  infoAudioCard: { marginBottom: spacing.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.lifeLight },
  infoPrimaryMetrics: { flexDirection: 'row', gap: spacing.sm },
  infoSecondaryMetrics: { flexDirection: 'row', gap: spacing.sm },
  infoMetricDivider: { height: StyleSheet.hairlineWidth, marginVertical: spacing.md, backgroundColor: colors.lifeLine },
  infoMetric: { flex: 1, minWidth: 0 },
  infoMetricLabel: { color: colors.inkFaint, fontSize: 9 },
  infoMetricValue: { marginTop: 5, color: colors.ink, fontFamily: typography.mono, fontSize: 12, fontWeight: '600' },
  infoFileCard: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.paper },
  infoFileRow: { minHeight: 62, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  infoFileRowLast: { minHeight: 82, borderBottomWidth: 0 },
  infoFileLabel: { color: colors.inkFaint, fontSize: 9 },
  infoFileValue: { marginTop: 5, color: colors.ink, fontSize: 11, lineHeight: 17 },
  editSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  editTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  inputLabel: { marginTop: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta },
  editInput: { minHeight: 52, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  saveEdit: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  saveEditText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
}));
