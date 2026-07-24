import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { persistAlbumImage } from '../../src/data/local-media';
import { useAppState } from '../../src/state/app-state';
import { previewRouteParams, toSelectedPreviewFile } from '../../src/components/file-preview.types';

export default function AlbumScreen() {
  const router = useRouter();
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const { addPhotoToAlbum, albumMedia, albums, deleteAlbum, media, people, removePhotoFromAlbum, reorderAlbumPhotos, updateAlbum } = useAppState();
  const album = albums.find((item) => item.id === albumId);
  const person = people.find((item) => item.id === album?.personId);
  const relations = useMemo(() => albumMedia.filter((item) => item.albumId === albumId).sort((a, b) => a.sortOrder - b.sortOrder), [albumId, albumMedia]);
  const photos = relations.map((relation) => media.find((item) => item.id === relation.mediaId)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const [editing, setEditing] = useState(false);
  const [managing, setManaging] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);
  const [name, setName] = useState(album?.name ?? '');
  const [importing, setImporting] = useState(false);
  const selectedIndex = photos.findIndex((photo) => photo.id === selectedPhotoId);
  const selectedPhoto = selectedIndex >= 0 ? photos[selectedIndex] : null;

  const choosePhotos = async () => {
    if (!album) return;
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) { Alert.alert('无法访问照片', '请在系统设置中允许“仍在”访问照片。'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images'], quality: 0.9, selectionLimit: 20 });
    if (result.canceled) return;
    setImporting(true);
    let failed = 0;
    for (const asset of result.assets) {
      let item = null;
      try { item = await persistAlbumImage(album.personId, album.id, asset); await addPhotoToAlbum(album.id, item); }
      catch { failed += 1; if (item) { const file = new File(item.localPath); if (file.exists) file.delete(); } }
    }
    setImporting(false);
    if (failed) Alert.alert('部分照片未添加', `${failed} 张照片处理失败，已清理未完成文件。`);
  };

  const move = (index: number, offset: number) => {
    const ids = relations.map((item) => item.mediaId);
    const target = index + offset;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    void reorderAlbumPhotos(albumId, ids);
  };

  const confirmDelete = () => {
    if (!album) return;
    Alert.alert(`删除相册“${album.name}”？`, `将永久删除应用内的 ${photos.length} 张照片，不影响系统照片库原图。`, [{ text: '取消', style: 'cancel' }, { text: '删除相册', style: 'destructive', onPress: () => void deleteAlbum(album.id).then(() => router.back()) }]);
  };

  if (!album || (album.personId && !person)) return <SafeAreaView style={styles.safeArea}><Text style={styles.missing}>相册不存在或已删除。</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><View style={styles.headerCopy}><Text numberOfLines={1} style={styles.headerTitle}>{album.name}</Text><Text style={styles.headerMeta}>{person?.name ?? '我'} · {photos.length} 张</Text></View><View style={styles.headerActions}><Pressable accessibilityLabel={managing ? '完成管理' : '管理相册'} onPress={() => { setManaging((value) => !value); setSelectedPhotoId(null); }} style={[styles.headerButton, managing && styles.headerButtonActive]}><SymbolView name={{ android: managing ? 'done' : 'edit' , ios: managing ? 'checkmark' : 'pencil', web: managing ? 'done' : 'edit' }} size={20} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel="添加照片" disabled={importing} onPress={() => void choosePhotos()} style={[styles.headerButton, importing && styles.disabled]}><SymbolView name={{ android: 'add_photo_alternate', ios: 'photo.badge.plus', web: 'add_photo_alternate' }} size={21} tintColor={colors.life} type="hierarchical" /></Pressable></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      {managing ? <View style={styles.managePanel}><View style={styles.manageHeader}><View><Text style={styles.manageTitle}>{selectedPhoto ? `已选择第 ${selectedIndex + 1} 张` : '选择一张照片'}</Text><Text style={styles.manageHint}>{selectedPhoto ? '使用下方操作管理这张照片' : '点击照片后设置封面、排序或移除'}</Text></View><View style={styles.manageButtons}><Pressable accessibilityLabel="重命名相册" onPress={() => { setName(album.name); setEditing(true); }} style={styles.manageButton}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={18} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel="删除相册" onPress={confirmDelete} style={styles.manageButton}><SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={18} tintColor="#9B493F" type="hierarchical" /></Pressable></View></View><View style={styles.selectionActions}><ManageAction disabled={!selectedPhoto} icon={{ android: 'wallpaper', ios: 'rectangle.on.rectangle', web: 'wallpaper' }} label="设为封面" onPress={() => selectedPhoto && void updateAlbum(album.id, { coverMediaId: selectedPhoto.id })} /><ManageAction disabled={!selectedPhoto || selectedIndex === 0} icon={{ android: 'arrow_back', ios: 'arrow.left', web: 'arrow_back' }} label="前移" onPress={() => move(selectedIndex, -1)} /><ManageAction disabled={!selectedPhoto || selectedIndex === photos.length - 1} icon={{ android: 'arrow_forward', ios: 'arrow.right', web: 'arrow_forward' }} label="后移" onPress={() => move(selectedIndex, 1)} /><ManageAction destructive disabled={!selectedPhoto} icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="移除" onPress={() => selectedPhoto && Alert.alert('移除这张照片？', '只删除应用内副本，不影响系统照片库原图。', [{ text: '取消', style: 'cancel' }, { text: '移除', style: 'destructive', onPress: () => void removePhotoFromAlbum(album.id, selectedPhoto.id).then(() => setSelectedPhotoId(null)) }])} /></View></View> : null}
      {photos.length ? <View style={styles.grid}>{photos.map((photo, index) => { const selected = managing && selectedPhotoId === photo.id; return <View key={photo.id} style={styles.photoCard}><Pressable accessibilityLabel={managing ? `选择第${index + 1}张照片` : `预览第${index + 1}张照片`} accessibilityRole="button" onPress={() => managing ? setSelectedPhotoId(photo.id) : router.push({ pathname: '/file-preview', params: previewRouteParams(photos.map(toSelectedPreviewFile), index) })}><AlbumPhoto uri={photo.localPath} />{selected ? <View style={styles.selectedShade} /> : null}</Pressable>{album.coverMediaId === photo.id || (!album.coverMediaId && index === 0) ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>封面</Text></View> : null}{selected ? <View style={styles.selectedBadge}><SymbolView name={{ android: 'done', ios: 'checkmark', web: 'done' }} size={15} tintColor={colors.onLife} type="hierarchical" /></View> : null}</View>; })}</View> : <Pressable onPress={() => void choosePhotos()} style={styles.empty}><View style={styles.emptyIcon}><SymbolView name={{ android: 'add_photo_alternate', ios: 'photo.badge.plus', web: 'add_photo_alternate' }} size={28} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.emptyTitle}>相册还是空的</Text><Text style={styles.emptyText}>从系统照片库选择照片，应用会保存独立副本。</Text><Text style={styles.emptyAction}>添加照片</Text></Pressable>}
    </ScrollView>
    <Modal animationType="slide" onRequestClose={() => setEditing(false)} transparent visible={editing}><Pressable onPress={() => setEditing(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}><View style={styles.handle} /><Text style={styles.sheetTitle}>重命名相册</Text><TextInput autoFocus maxLength={40} onChangeText={setName} onSubmitEditing={() => name.trim() && void updateAlbum(album.id, { name }).then(() => setEditing(false), (cause: unknown) => Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'))} returnKeyType="done" style={styles.input} value={name} /><Pressable disabled={!name.trim()} onPress={() => void updateAlbum(album.id, { name }).then(() => setEditing(false), (cause: unknown) => Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={[styles.confirm, !name.trim() && styles.disabled]}><Text style={styles.confirmText}>保存</Text></Pressable></Pressable></Pressable></Modal>
  </SafeAreaView>;
}

function AlbumPhoto({ uri }: { uri: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return failed ? <View style={styles.brokenPhoto}><SymbolView name={{ android: 'broken_image', ios: 'photo.badge.exclamationmark', web: 'broken_image' }} size={24} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.brokenText}>图片不可用</Text></View> : <Image onError={() => setFailed(true)} source={{ uri }} style={styles.photo} />;
}

function ManageAction({ destructive = false, disabled, icon, label, onPress }: { destructive?: boolean; disabled: boolean; icon: React.ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  const color = destructive ? '#9B493F' : colors.life;
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={[styles.selectionAction, disabled && styles.disabled]}><SymbolView name={icon} size={17} tintColor={color} type="hierarchical" /><Text style={[styles.selectionActionText, { color }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 64, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerButton: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' }, headerButtonActive: { borderRadius: 20, backgroundColor: colors.lifeLight }, headerActions: { width: 80, flexDirection: 'row' }, headerCopy: { flex: 1, alignItems: 'center' }, headerTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, headerMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 8 }, content: { padding: spacing.md, paddingBottom: spacing.xxl },
  managePanel: { marginBottom: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.lifeLight }, manageHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center' }, manageTitle: { color: colors.ink, fontSize: 12, fontWeight: '700' }, manageHint: { marginTop: 4, color: colors.inkFaint, fontSize: 8 }, manageButtons: { marginLeft: 'auto', flexDirection: 'row' }, manageButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }, selectionActions: { minHeight: 52, marginTop: spacing.sm, paddingTop: spacing.sm, flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, selectionAction: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }, selectionActionText: { fontSize: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, photoCard: { width: '32.4%', overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.sheet }, photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.lifeLight }, brokenPhoto: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.sheet }, brokenText: { marginTop: 5, color: colors.inkFaint, fontSize: 8 }, selectedShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, borderWidth: 3, borderColor: colors.life, backgroundColor: 'rgba(29,107,73,0.10)' }, selectedBadge: { position: 'absolute', right: 6, bottom: 6, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper, borderRadius: 12, backgroundColor: colors.life }, coverBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(29,107,73,0.88)' }, coverBadgeText: { color: colors.onLife, fontSize: 8, fontWeight: '700' }, disabled: { opacity: 0.3 },
  empty: { marginTop: spacing.lg, padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.lifeLight }, emptyTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 20 }, emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 18, textAlign: 'center' }, emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(35,31,27,0.28)' }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, input: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, confirm: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, confirmText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, missing: { margin: spacing.lg, color: colors.inkSoft, fontSize: 16 },
});
