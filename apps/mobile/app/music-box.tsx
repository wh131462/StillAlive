import { useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { MusicTrack } from '@still-alive/types';
import { useAppState } from '../src/state/app-state';
import { pickLocalAsset } from '../src/data/local-assets';
import { useMusicPlayer } from '../src/state/music-player';
import { createThemedStyles } from '../src/theme/app-theme';
import { AppKeyboardAvoidingView } from '../src/components/app-keyboard-avoiding-view';

export default function MusicBoxScreen() {
  const router = useRouter();
  const { createMusicTrack, deleteMusicTrack, musicCollectionEntries, musicTracks, removeMusicCollectionEntry, saveMedia, updateMusicTrack } = useAppState();
  const player = useMusicPlayer();
  const [search, setSearch] = useState('');
  const [actionTrack, setActionTrack] = useState<MusicTrack | null>(null);
  const [editingTrack, setEditingTrack] = useState<MusicTrack | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingArtist, setEditingArtist] = useState('');
  const [editingAlbum, setEditingAlbum] = useState('');
  const selfTrackIds = useMemo(() => new Set(musicCollectionEntries.filter((entry) => entry.targetType === 'self').map((entry) => entry.trackId)), [musicCollectionEntries]);
  const selfTracks = useMemo(() => musicTracks.filter((track) => selfTrackIds.has(track.id)), [musicTracks, selfTrackIds]);
  const visibleTracks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    if (!query) return selfTracks;
    return selfTracks.filter((track) => `${track.title} ${track.artist ?? ''} ${track.album ?? ''}`.toLocaleLowerCase().includes(query));
  }, [search, selfTracks]);

  const importMusic = async () => {
    try {
      const asset = await pickLocalAsset('audio');
      if (!asset) return;
      await saveMedia(asset);
      const now = new Date().toISOString();
      const trackId = `track_${Date.now()}`;
      await createMusicTrack({ id: trackId, mediaId: asset.id, title: asset.originalName?.replace(/\.[^.]+$/, '') || '未命名音乐', artist: null, album: null, durationMs: null, createdAt: now, updatedAt: now }, { trackId, targetType: 'self', targetId: null, createdAt: now });
    } catch (cause) {
      Alert.alert('导入失败', cause instanceof Error ? cause.message : '请稍后重试。');
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
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const removeFromBox = (track: MusicTrack) => {
    setActionTrack(null);
    Alert.alert('移出音乐盒？', '只移除你的收藏，人物喜欢和本地曲目不会受到影响。', [
      { text: '取消', style: 'cancel' },
      { text: '移出', style: 'destructive', onPress: () => void removeMusicCollectionEntry(track.id, 'self', null) },
    ]);
  };

  const deleteEverywhere = (track: MusicTrack) => {
    setActionTrack(null);
    Alert.alert('永久删除曲目？', '本地文件和全部人物收藏都会被删除，此操作不可撤销。', [
      { text: '取消', style: 'cancel' },
      { text: '永久删除', style: 'destructive', onPress: () => void deleteMusicTrack(track.id) },
    ]);
  };

  const playTrack = (track: MusicTrack) => {
    if (player.currentTrack?.id === track.id) {
      player.toggle();
      return;
    }
    void player.playTrack(track.id, visibleTracks.map((item) => item.id), 'self');
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

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
        <Text style={styles.headerTitle}>音乐盒</Text>
        <Pressable accessibilityLabel="导入音乐" onPress={() => void importMusic()} style={styles.headerButton}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={23} tintColor={colors.life} type="hierarchical" /></Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, player.currentTrack && styles.contentPlaying]} keyboardShouldPersistTaps="handled">
        <View style={styles.librarySummary}>
          <View style={styles.libraryMark}><SymbolView name={{ android: 'library_music', ios: 'music.note.list', web: 'library_music' }} size={28} tintColor={colors.life} type="hierarchical" /></View>
          <View style={styles.libraryCopy}><Text style={styles.libraryLabel}>我的曲库</Text><Text style={styles.libraryCount}>{selfTracks.length} 首音乐</Text></View>
        </View>

        <View style={styles.primaryActions}>
          <Pressable accessibilityRole="button" disabled={!selfTracks.length} onPress={playAll} style={({ pressed }) => [styles.playAll, !selfTracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={19} tintColor={colors.onLife} type="hierarchical" /><Text style={styles.playAllText}>播放全部</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={!selfTracks.length} onPress={() => void shuffleAll()} style={({ pressed }) => [styles.shuffle, !selfTracks.length && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'shuffle', ios: 'shuffle', web: 'shuffle' }} size={18} tintColor={colors.life} type="hierarchical" /><Text style={styles.shuffleText}>随机播放</Text></Pressable>
        </View>

        <View style={styles.searchBar}><SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /><TextInput onChangeText={setSearch} placeholder="搜索歌曲、艺术家或专辑" placeholderTextColor={colors.inkFaint} style={styles.searchInput} value={search} />{search ? <Pressable accessibilityLabel="清除搜索" onPress={() => setSearch('')} style={styles.clearSearch}><SymbolView name={{ android: 'cancel', ios: 'xmark.circle.fill', web: 'cancel' }} size={17} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}</View>

        <View style={styles.listHeader}><Text style={styles.listTitle}>歌曲</Text><Text style={styles.listCount}>{visibleTracks.length}</Text></View>
        {visibleTracks.length ? visibleTracks.map((track, index) => <TrackRow key={track.id} index={index + 1} playing={player.currentTrack?.id === track.id && player.playing} selected={player.currentTrack?.id === track.id} track={track} onMore={() => setActionTrack(track)} onPlay={() => playTrack(track)} />) : <View style={styles.empty}><Text style={styles.emptyTitle}>{selfTracks.length ? '没有找到匹配歌曲' : '音乐盒还是空的'}</Text><Text style={styles.emptyText}>{selfTracks.length ? '换一个关键词再试试。' : '导入本机音乐，建立你的本地曲库。'}</Text>{!selfTracks.length ? <Pressable onPress={() => void importMusic()} style={styles.emptyAction}><Text style={styles.emptyActionText}>导入音乐</Text></Pressable> : null}</View>}
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setActionTrack(null)} transparent visible={Boolean(actionTrack)}>
        <Pressable onPress={() => setActionTrack(null)} style={styles.backdrop}>
          <Pressable accessibilityRole="menu" accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={styles.actionSheet}>
            <View style={styles.handle} />
            <View style={styles.actionPreview}><View style={styles.previewDisc}><SymbolView name={{ android: 'music_note', ios: 'music.note', web: 'music_note' }} size={20} tintColor={colors.life} type="hierarchical" /></View><View style={styles.previewCopy}><Text numberOfLines={1} style={styles.previewTitle}>{actionTrack?.title}</Text><Text numberOfLines={1} style={styles.previewMeta}>{actionTrack?.artist || '未知艺术家'}{actionTrack?.album ? ` · ${actionTrack.album}` : ''}</Text></View></View>
            <ActionOption icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑歌曲信息" onPress={() => actionTrack && edit(actionTrack)} />
            <ActionOption icon={{ android: 'remove_circle_outline', ios: 'minus.circle', web: 'remove_circle_outline' }} label="移出音乐盒" onPress={() => actionTrack && removeFromBox(actionTrack)} />
            <ActionOption destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="永久删除曲目" onPress={() => actionTrack && deleteEverywhere(actionTrack)} />
            <Pressable onPress={() => setActionTrack(null)} style={styles.cancelAction}><Text style={styles.cancelText}>取消</Text></Pressable>
          </Pressable>
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
    </SafeAreaView>
  );
}

function TrackRow({ index, playing, selected, track, onMore, onPlay }: { index: number; playing: boolean; selected: boolean; track: MusicTrack; onMore(): void; onPlay(): void }) {
  return <View style={styles.trackRow}><Pressable accessibilityRole="button" onPress={onPlay} style={({ pressed }) => [styles.trackMain, pressed && styles.pressed]}><View style={[styles.trackIndex, selected && styles.trackIndexActive]}>{selected ? <SymbolView name={{ android: playing ? 'pause' : 'play_arrow', ios: playing ? 'pause.fill' : 'play.fill', web: playing ? 'pause' : 'play_arrow' }} size={15} tintColor={colors.life} type="hierarchical" /> : <Text style={styles.trackIndexText}>{index}</Text>}</View><View style={styles.trackCopy}><Text numberOfLines={1} style={[styles.trackTitle, selected && styles.trackTitleActive]}>{track.title}</Text><Text numberOfLines={1} style={styles.trackMeta}>{track.artist || '未知艺术家'}{track.album ? ` · ${track.album}` : ''}</Text></View></Pressable><Pressable accessibilityLabel={`管理 ${track.title}`} onPress={onMore} style={styles.moreButton}><SymbolView name={{ android: 'more_horiz', ios: 'ellipsis', web: 'more_horiz' }} size={20} tintColor={colors.inkFaint} type="hierarchical" /></Pressable></View>;
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
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl },
  contentPlaying: { paddingBottom: 150 },
  librarySummary: { paddingTop: spacing.md, paddingBottom: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  libraryMark: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.lifeLight },
  libraryCopy: { marginLeft: spacing.md },
  libraryLabel: { color: colors.inkFaint, fontSize: typography.size.meta },
  libraryCount: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 24 },
  primaryActions: { flexDirection: 'row', gap: spacing.sm },
  playAll: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: colors.life },
  playAllText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  shuffle: { flex: 1, minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: radius.md, backgroundColor: colors.sheet },
  shuffleText: { color: colors.life, fontSize: 12, fontWeight: '700' },
  disabled: { opacity: 0.38 },
  pressed: { opacity: 0.62 },
  searchBar: { minHeight: 46, marginTop: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  searchInput: { flex: 1, minHeight: 46, paddingHorizontal: spacing.sm, color: colors.ink, fontSize: 12 },
  clearSearch: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  listHeader: { marginTop: spacing.xl, paddingBottom: spacing.sm, flexDirection: 'row', alignItems: 'baseline', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  listTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  listCount: { marginLeft: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  trackRow: { minHeight: 66, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  trackMain: { flex: 1, minWidth: 0, minHeight: 66, flexDirection: 'row', alignItems: 'center' },
  trackIndex: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  trackIndexActive: { borderRadius: 15, backgroundColor: colors.lifeLight },
  trackIndexText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 10 },
  trackCopy: { flex: 1, minWidth: 0, marginLeft: spacing.sm },
  trackTitle: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  trackTitleActive: { color: colors.life },
  trackMeta: { marginTop: 5, color: colors.inkFaint, fontSize: 10 },
  moreButton: { width: 44, height: 52, alignItems: 'center', justifyContent: 'center' },
  empty: { marginTop: spacing.xl, paddingVertical: spacing.xl, alignItems: 'center' },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 },
  emptyAction: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  emptyActionText: { color: colors.onLife, fontSize: 11, fontWeight: '700' },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdropStrong },
  actionSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, backgroundColor: colors.sheet },
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
