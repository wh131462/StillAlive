import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { Animated, Easing, FlatList, Modal, PanResponder, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import * as ImagePicker from 'expo-image-picker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Media, MusicPlaylist, MusicTrack } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { pickLocalAudioAssets } from '../../infrastructure/files/local-assets';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import { useMusicPlayer } from './music-player-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { orderMusicTracksByCollectionEntries } from './music-library';
import { MusicCover } from './music-cover';
import { openLastMusicDownloadDirectory, saveMusicCopy } from './music-downloads';
import { reportMusicImportFailure } from './music-import-coordinator';

type MusicBoxListItem = { kind: 'search' } | { kind: 'track'; track: MusicTrack };

const ACTION_SHEET_ENTRY_OFFSET = 640;
const ACTION_SHEET_DISMISS_THRESHOLD = 110;
const ACTION_SHEET_ANIMATION_DURATION = 240;

export default function MusicBoxScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { createMusicPlaylist, deleteMusicTrack, discardMedia, importMusicTrack, media, musicCollectionEntries, musicPlaylistEntries, musicPlaylists, musicTracks, removeMusicCollectionEntry, setMusicTrackCover, updateMusicTrack } = useAppState();
  const player = useMusicPlayer();
  const [search, setSearch] = useState('');
  const [actionTrack, setActionTrack] = useState<MusicTrack | null>(null);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingArtist, setEditingArtist] = useState('');
  const [editingAlbum, setEditingAlbum] = useState('');
  const [importing, setImporting] = useState(false);
  const [createPlaylistVisible, setCreatePlaylistVisible] = useState(false);
  const [playlistName, setPlaylistName] = useState('');
  const importingRef = useRef(false);
  const actionSheetTranslateY = useRef(new Animated.Value(0)).current;
  const actionSheetDismissing = useRef(false);
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

  useEffect(() => {
    if (!actionTrack) return;
    actionSheetDismissing.current = false;
    actionSheetTranslateY.setValue(ACTION_SHEET_ENTRY_OFFSET);
    Animated.timing(actionSheetTranslateY, {
      toValue: 0,
      duration: ACTION_SHEET_ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [actionSheetTranslateY, actionTrack]);

  const dismissActionSheet = useCallback(() => {
    if (actionSheetDismissing.current) return;
    actionSheetDismissing.current = true;
    Animated.timing(actionSheetTranslateY, {
      toValue: ACTION_SHEET_ENTRY_OFFSET,
      duration: ACTION_SHEET_ANIMATION_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) setActionTrack(null);
    });
  }, [actionSheetTranslateY]);

  const actionSheetPan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderGrant: () => actionSheetTranslateY.stopAnimation(),
    onPanResponderMove: (_, gesture) => actionSheetTranslateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > ACTION_SHEET_DISMISS_THRESHOLD || gesture.vy > 0.85) {
        dismissActionSheet();
        return;
      }
      Animated.spring(actionSheetTranslateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => {
      Animated.spring(actionSheetTranslateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
    },
  }), [actionSheetTranslateY, dismissActionSheet]);

  const importMusic = async () => {
    if (importingRef.current) return;
    importingRef.current = true;
    setImporting(true);
    try {
      const assets = await pickLocalAudioAssets();
      for (let index = 0; index < assets.length; index += 1) {
        try {
          await importMusicTrack(assets[index]);
        } catch (cause) {
          for (const item of assets.slice(index)) await discardMedia(item).catch(() => undefined);
          const failure = reportMusicImportFailure(cause, { importedCount: index, sourceName: assets[index].originalName });
          feedback.alert(failure.title, failure.message);
          return;
        }
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

  const openTrackLocation = async () => {
    setActionTrack(null);
    try {
      const result = await openLastMusicDownloadDirectory();
      if (result === 'missing') feedback.alert('尚无下载位置', '请先下载一首歌曲，应用会记录你选择的目录。');
    } catch (cause) {
      feedback.alert('无法打开位置', cause instanceof Error ? cause.message : '请稍后重试。');
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
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
        <Text style={styles.headerTitle}>音乐盒</Text>
        <Pressable accessibilityLabel="导入音乐" disabled={importing} onPress={() => void importMusic()} style={[styles.headerButton, importing && styles.disabled]}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={23} tintColor={colors.life} type="hierarchical" /></Pressable>
      </View>

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
              <View style={styles.libraryCard}>
                <MusicCover size={56} style={styles.libraryMark} />
                <View style={styles.libraryCopy}><Text style={styles.libraryLabel}>我的曲库</Text><Text style={styles.libraryCount}>{selfTracks.length} 首音乐</Text></View>
                <View style={styles.libraryActions}>
                  <Pressable accessibilityLabel="随机播放" accessibilityRole="button" disabled={!selfTracks.length} onPress={() => void shuffleAll()} style={({ pressed }) => [styles.shuffleAction, !selfTracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'shuffle', ios: 'shuffle', web: 'shuffle' }} size={19} tintColor={colors.life} type="hierarchical" /></Pressable>
                  <Pressable accessibilityLabel="播放全部" accessibilityRole="button" disabled={!selfTracks.length} onPress={playAll} style={({ pressed }) => [styles.playAction, !selfTracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={24} tintColor={colors.onLife} type="hierarchical" /></Pressable>
                </View>
              </View>
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

      <Modal animationType="fade" onRequestClose={dismissActionSheet} transparent visible={Boolean(actionTrack)}>
        <Pressable onPress={dismissActionSheet} style={styles.backdrop}>
          <Animated.View style={{ transform: [{ translateY: actionSheetTranslateY }] }}>
            <Pressable accessibilityRole="menu" accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.actionSheet}>
              <View {...actionSheetPan.panHandlers} accessibilityLabel="向下拖动关闭菜单" style={styles.actionSheetGrabber}><View style={styles.actionSheetHandle} /></View>
              <View style={styles.actionPreview}><MusicCover media={media.find((item) => item.id === actionTrack?.coverMediaId)} size={44} style={styles.previewDisc} /><View style={styles.previewCopy}><Text numberOfLines={1} style={styles.previewTitle}>{actionTrack?.title}</Text><Text numberOfLines={1} style={styles.previewMeta}>{actionTrack?.artist || '未知艺术家'}{actionTrack?.album ? ` / ${actionTrack.album}` : ''}</Text></View></View>
              <ActionOption icon={{ android: 'download', ios: 'arrow.down.to.line', web: 'download' }} label="下载" onPress={() => actionTrack && void downloadTrack(actionTrack)} />
              <ActionOption icon={{ android: 'folder_open', ios: 'folder', web: 'folder_open' }} label="打开所在位置" onPress={() => void openTrackLocation()} />
              <ActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑歌曲信息" onPress={() => actionTrack && edit(actionTrack)} />
              <ActionOption icon={{ android: 'image', ios: 'photo', web: 'image' }} label="更换歌曲封面" onPress={() => actionTrack && void chooseTrackCover(actionTrack)} />
              {actionTrack?.coverMediaId ? <ActionOption icon={{ android: 'image_not_supported', ios: 'photo', web: 'image_not_supported' }} label="恢复通用封面" onPress={() => actionTrack && void resetTrackCover(actionTrack)} /> : null}
              <ActionOption icon={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} label="移出音乐盒" onPress={() => actionTrack && removeFromBox(actionTrack)} />
              <ActionOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="永久删除曲目" onPress={() => actionTrack && deleteEverywhere(actionTrack)} />
              <Pressable onPress={dismissActionSheet} style={styles.cancelAction}><Text style={styles.cancelText}>取消</Text></Pressable>
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setEditingTrack(null)} transparent visible={Boolean(editingTrack)}>
        <AppKeyboardAvoidingView style={styles.flex}>
          <Pressable onPress={() => setEditingTrack(null)} style={styles.backdrop}>
            <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.editSheet}>
              <View style={styles.handle} />
              <Text style={styles.editTitle}>编辑歌曲信息</Text>
              <Text style={styles.inputLabel}>歌曲名称</Text>
              <TextInput autoFocus maxLength={80} onChangeText={setEditingTitle} placeholder="输入歌曲名称" placeholderTextColor={colors.inkFaint} returnKeyType="next" selectTextOnFocus style={styles.editInput} value={editingTitle} />
              <Text style={styles.inputLabel}>艺术家</Text>
              <TextInput maxLength={80} onChangeText={setEditingArtist} placeholder="未知艺术家" placeholderTextColor={colors.inkFaint} returnKeyType="next" style={styles.editInput} value={editingArtist} />
              <Text style={styles.inputLabel}>专辑</Text>
              <TextInput maxLength={80} onChangeText={setEditingAlbum} onSubmitEditing={() => void saveEdit()} placeholder="未收录专辑" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.editInput} value={editingAlbum} />
              <Pressable accessibilityRole="button" disabled={!editingTitle.trim()} onPress={() => void saveEdit()} style={({ pressed }) => [styles.saveEdit, !editingTitle.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveEditText}>保存</Text></Pressable>
            </Pressable>
          </Pressable>
        </AppKeyboardAvoidingView>
      </Modal>

      <Modal animationType="slide" onRequestClose={() => setCreatePlaylistVisible(false)} transparent visible={createPlaylistVisible}>
        <AppKeyboardAvoidingView style={styles.flex}>
          <Pressable onPress={() => setCreatePlaylistVisible(false)} style={styles.backdrop}>
            <Pressable accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.editSheet}>
              <View style={styles.handle} />
              <Text style={styles.editTitle}>创建歌单</Text>
              <Text style={styles.inputLabel}>歌单名称</Text>
              <TextInput autoFocus maxLength={40} onChangeText={setPlaylistName} onSubmitEditing={() => void createPlaylist()} placeholder="例如：雨天散步" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.editInput} value={playlistName} />
              <Pressable accessibilityRole="button" disabled={!playlistName.trim()} onPress={() => void createPlaylist()} style={({ pressed }) => [styles.saveEdit, !playlistName.trim() && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveEditText}>创建</Text></Pressable>
            </Pressable>
          </Pressable>
        </AppKeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function TrackRow({ media, selected, track, onMore, onPlay }: { media: Media[]; selected: boolean; track: MusicTrack; onMore(): void; onPlay(): void }) {
  return <View style={[styles.trackRow, selected && styles.trackRowActive]}>{selected ? <View style={styles.playingRail} /> : null}<Pressable accessibilityRole="button" onPress={onPlay} style={({ pressed }) => [styles.trackMain, pressed && styles.pressed]}><MusicCover media={media.find((item) => item.id === track.coverMediaId)} size={46} style={styles.trackCover} /><View style={styles.trackCopy}><Text numberOfLines={1} style={[styles.trackTitle, selected && styles.trackTitleActive]}>{track.title}</Text><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` / ${track.album}` : ''}</Text></View></Pressable><Pressable accessibilityLabel={`管理 ${track.title}`} onPress={onMore} style={styles.moreButton}><VerticalMoreIcon /></Pressable></View>;
}

function VerticalMoreIcon() {
  return <View pointerEvents="none" style={styles.moreIcon}>{[0, 1, 2].map((item) => <View key={item} style={styles.moreDot} />)}</View>;
}

function ActionOption({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  const tint = destructive ? colors.danger : colors.ink;
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.actionOption, pressed && styles.pressed]}><SymbolView name={icon} size={20} tintColor={tint} type="hierarchical" /><Text style={[styles.actionLabel, destructive && styles.actionLabelDanger]}>{label}</Text></Pressable>;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safe: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 19, textAlign: 'center' },
  content: { paddingBottom: spacing.xxl },
  libraryArea: { paddingHorizontal: spacing.lg },
  libraryCard: { minHeight: 84, marginTop: spacing.sm, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.lg, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOpacity: 0.05, shadowRadius: 10, elevation: 1 },
  libraryMark: { borderRadius: radius.md },
  libraryCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  libraryLabel: { color: colors.inkFaint, fontSize: 11 },
  libraryCount: { marginTop: 3, color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  libraryActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  shuffleAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 21, backgroundColor: colors.paper },
  playAction: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.life },
  sectionHeader: { minHeight: 54, marginTop: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'baseline' },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  sectionCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10 },
  sectionAction: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  playlistContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, gap: spacing.md },
  playlistCard: { width: 112 },
  playlistCover: { borderRadius: radius.md },
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
  trackMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 11 },
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
  actionPreview: { paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  previewDisc: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.lifeLight },
  previewCopy: { flex: 1, minWidth: 0, marginLeft: spacing.md },
  previewTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  previewMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 10 },
  actionOption: { minHeight: 54, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  actionLabel: { color: colors.ink, fontSize: 12 },
  actionLabelDanger: { color: colors.danger },
  cancelAction: { minHeight: 48, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontSize: 11, fontWeight: '600' },
  editSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
  editTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  inputLabel: { marginTop: spacing.md, color: colors.inkFaint, fontSize: typography.size.meta },
  editInput: { minHeight: 52, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 14 },
  saveEdit: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  saveEditText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
}));
