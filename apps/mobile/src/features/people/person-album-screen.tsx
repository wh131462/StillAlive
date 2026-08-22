import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { File } from 'expo-file-system';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { persistAlbumMedia } from '../../infrastructure/files/local-media';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { previewRouteParams, toSelectedPreviewFile } from '../files/file-preview.types';
import { ensureAppPermission } from '../../infrastructure/platform/app-permissions';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { MediaThumbnail } from '../../shared/components/media-thumbnail';

export default function AlbumScreen() {
  const router = useRouter();
  const { albumId } = useLocalSearchParams<{ albumId: string }>();
  const { addPhotoToAlbum, albumMedia, albums, deleteAlbum, media, people, removePhotoFromAlbum, reorderAlbumPhotos, updateAlbum } = useAppState();
  const album = albums.find((item) => item.id === albumId);
  const person = people.find((item) => item.id === album?.personId);
  const relations = useMemo(() => albumMedia.filter((item) => item.albumId === albumId).sort((a, b) => a.sortOrder - b.sortOrder), [albumId, albumMedia]);
  const photos = relations.map((relation) => media.find((item) => item.id === relation.mediaId)).filter((item): item is NonNullable<typeof item> => Boolean(item));
  const [editing, setEditing] = useState(false);
  const [albumActionsOpen, setAlbumActionsOpen] = useState(false);
  const [imageSourcePickerOpen, setImageSourcePickerOpen] = useState(false);
  const [name, setName] = useState(album?.name ?? '');
  const [importing, setImporting] = useState(false);
  const [actionPhotoId, setActionPhotoId] = useState<string | null>(null);
  const actionIndex = photos.findIndex((photo) => photo.id === actionPhotoId);
  const actionPhoto = actionIndex >= 0 ? photos[actionIndex] : null;

  const importMedia = async (assets: ImagePickerAsset[]) => {
    if (!album) return;
    setImporting(true);
    let failed = 0;
    for (const asset of assets) {
      let item = null;
      try { item = await persistAlbumMedia(album.personId, album.id, asset); await addPhotoToAlbum(album.id, item); }
      catch { failed += 1; if (item) { const file = new File(item.localPath); if (file.exists) file.delete(); } }
    }
    setImporting(false);
    if (failed) feedback.alert('部分媒体未添加', `${failed} 个媒体处理失败，已清理未完成文件。`);
  };

  const openImageSourcePicker = () => {
    if (!importing) setImageSourcePickerOpen(true);
  };

  const takePhoto = async () => {
    setImageSourcePickerOpen(false);
    if (!await ensureAppPermission('camera')) return;
    const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images', 'videos'], quality: 0.9 });
    if (!result.canceled) await importMedia(result.assets);
  };

  const pickPhotos = async () => {
    setImageSourcePickerOpen(false);
    if (!await ensureAppPermission('photos')) return;
    const result = await ImagePicker.launchImageLibraryAsync({ allowsMultipleSelection: true, mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: 20 });
    if (!result.canceled) await importMedia(result.assets);
  };

  const confirmDelete = () => {
    if (!album) return;
    feedback.alert(`删除相册“${album.name}”？`, `将永久删除应用内的 ${photos.length} 个媒体，不影响系统相册原文件。`, [{ text: '取消', style: 'cancel' }, { text: '删除相册', style: 'destructive', onPress: () => void deleteAlbum(album.id).then(() => router.back()) }]);
  };

  if (!album || (album.personId && !person)) return <SafeAreaView style={styles.safeArea}><ToolPageHeader onBack={() => router.back()} title="相册" /><Text style={styles.missing}>相册不存在或已删除。</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader
      onBack={() => router.back()}
      right={<><ToolPageHeaderAction accessibilityLabel="添加照片或视频" disabled={importing} onPress={openImageSourcePicker}><SymbolView name={{ android: 'add_photo_alternate', ios: 'photo.badge.plus', web: 'add_photo_alternate' }} size={21} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction><ToolPageHeaderAction accessibilityLabel="更多相册操作" onPress={() => setAlbumActionsOpen(true)}><SymbolView name={{ android: 'more_horiz', ios: 'ellipsis.circle', web: 'more_horiz' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction></>}
      subtitle={`${person?.name ?? '我'} / ${photos.length} 个媒体`}
      title={album.name}
    />
    <ScrollView contentContainerStyle={styles.content}>
      {photos.length ? <View style={styles.grid}>{photos.map((photo, index) => <View key={photo.id} style={styles.photoCard}><Pressable accessibilityHint="长按打开媒体操作" accessibilityLabel={`预览第 ${index + 1} 个媒体`} accessibilityRole="button" delayLongPress={360} onLongPress={() => setActionPhotoId(photo.id)} onPress={() => router.push({ pathname: '/file-preview', params: previewRouteParams(photos.map(toSelectedPreviewFile), index) })} style={({ pressed }) => [styles.photoPressable, pressed && styles.photoPressed]}><MediaThumbnail item={photo} style={styles.photo} /></Pressable>{album.coverMediaId === photo.id || (!album.coverMediaId && index === 0) ? <View style={styles.coverBadge}><Text style={styles.coverBadgeText}>封面</Text></View> : null}</View>)}</View> : <Pressable onPress={openImageSourcePicker} style={styles.empty}><View style={styles.emptyIcon}><SymbolView name={{ android: 'add_photo_alternate', ios: 'photo.badge.plus', web: 'add_photo_alternate' }} size={28} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.emptyTitle}>相册还是空的</Text><Text style={styles.emptyText}>拍摄或从系统相册选择照片和视频，应用会保存独立副本。</Text><Text style={styles.emptyAction}>添加媒体</Text></Pressable>}
    </ScrollView>
    <DraggableBottomSheet accessibilityLabel="选择媒体来源，向下拖动关闭" accessibilityRole="menu" onClose={() => setImageSourcePickerOpen(false)} open={imageSourcePickerOpen} sheetStyle={styles.sourceSheet}><ImageSourceOption label="拍摄照片或视频" onPress={() => void takePhoto()} /><ImageSourceOption label="从手机相册选择" onPress={() => void pickPhotos()} /><Pressable accessibilityRole="button" onPress={() => setImageSourcePickerOpen(false)} style={styles.actionCancel}><Text style={styles.actionCancelText}>取消</Text></Pressable></DraggableBottomSheet>
    <DraggableBottomSheet onClose={() => setAlbumActionsOpen(false)} open={albumActionsOpen} sheetStyle={styles.actionSheet}><View style={styles.actionPreview}><View style={styles.albumActionIcon}><SymbolView name={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }} size={23} tintColor={colors.life} type="hierarchical" /></View><View style={styles.actionCopy}><Text numberOfLines={1} style={styles.actionTitle}>{album.name}</Text><Text style={styles.actionMeta}>{person?.name ?? '我'} / {photos.length} 个媒体</Text></View></View><PhotoAction disabled={false} icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="重命名相册" onPress={() => { setAlbumActionsOpen(false); setName(album.name); setEditing(true); }} /><PhotoAction destructive disabled={false} icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除相册" onPress={() => { setAlbumActionsOpen(false); confirmDelete(); }} /><Pressable accessibilityRole="button" onPress={() => setAlbumActionsOpen(false)} style={styles.actionCancel}><Text style={styles.actionCancelText}>取消</Text></Pressable></DraggableBottomSheet>
    <DraggableBottomSheet onClose={() => setActionPhotoId(null)} open={Boolean(actionPhoto)} sheetStyle={styles.actionSheet}><View style={styles.actionPreview}><MediaThumbnail item={actionPhoto} style={styles.actionThumb} /><View style={styles.actionCopy}><Text style={styles.actionTitle}>媒体操作</Text><Text style={styles.actionMeta}>{actionPhoto ? `第 ${actionIndex + 1} 个 / 共 ${photos.length} 个媒体` : ''}</Text></View></View><PhotoAction disabled={!actionPhoto} icon={{ android: 'wallpaper', ios: 'rectangle.on.rectangle', web: 'wallpaper' }} label="设为封面" onPress={() => { if (actionPhoto) void updateAlbum(album.id, { coverMediaId: actionPhoto.id }); setActionPhotoId(null); }} /><PhotoAction disabled={actionIndex <= 0} icon={{ android: 'arrow_back', ios: 'arrow.left', web: 'arrow_back' }} label="前移" onPress={() => { if (actionIndex > 0) { const ids = relations.map((item) => item.mediaId); [ids[actionIndex - 1], ids[actionIndex]] = [ids[actionIndex], ids[actionIndex - 1]]; void reorderAlbumPhotos(album.id, ids); } setActionPhotoId(null); }} /><PhotoAction disabled={actionIndex < 0 || actionIndex >= photos.length - 1} icon={{ android: 'arrow_forward', ios: 'arrow.right', web: 'arrow_forward' }} label="后移" onPress={() => { if (actionIndex >= 0 && actionIndex < relations.length - 1) { const ids = relations.map((item) => item.mediaId); [ids[actionIndex], ids[actionIndex + 1]] = [ids[actionIndex + 1], ids[actionIndex]]; void reorderAlbumPhotos(album.id, ids); } setActionPhotoId(null); }} /><PhotoAction destructive disabled={!actionPhoto} icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="从相册移除" onPress={() => { if (!actionPhoto) return; const photoId = actionPhoto.id; setActionPhotoId(null); feedback.alert('从相册移除这个媒体？', '只删除应用内副本，不影响系统相册原文件。', [{ text: '取消', style: 'cancel' }, { text: '移除', style: 'destructive', onPress: () => void removePhotoFromAlbum(album.id, photoId) }]); }} /><Pressable accessibilityRole="button" onPress={() => setActionPhotoId(null)} style={styles.actionCancel}><Text style={styles.actionCancelText}>取消</Text></Pressable></DraggableBottomSheet>
    <DraggableBottomSheet keyboardAvoiding onClose={() => setEditing(false)} open={editing} sheetStyle={styles.sheet}><Text style={styles.sheetTitle}>重命名相册</Text><TextInput maxLength={40} onChangeText={setName} onSubmitEditing={() => name.trim() && void updateAlbum(album.id, { name }).then(() => setEditing(false), (cause: unknown) => feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'))} returnKeyType="done" style={styles.input} value={name} /><Pressable disabled={!name.trim()} onPress={() => void updateAlbum(album.id, { name }).then(() => setEditing(false), (cause: unknown) => feedback.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={[styles.confirm, !name.trim() && styles.disabled]}><Text style={styles.confirmText}>保存</Text></Pressable></DraggableBottomSheet>
  </SafeAreaView>;
}

function ImageSourceOption({ label, onPress }: { label: string; onPress(): void }) {
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.sourceOption, pressed && styles.actionRowPressed]}><Text style={styles.sourceOptionText}>{label}</Text></Pressable>;
}

function PhotoAction({ destructive = false, disabled, icon, label, onPress }: { destructive?: boolean; disabled: boolean; icon: React.ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  const color = destructive ? colors.danger : colors.ink;
  return <Pressable accessibilityLabel={label} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.actionRow, disabled && styles.disabled, pressed && styles.actionRowPressed]}><SymbolView name={icon} size={19} tintColor={color} type="hierarchical" /><Text style={[styles.actionRowText, { color }]}>{label}</Text></Pressable>;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.md, paddingBottom: spacing.xxl },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }, photoCard: { width: '32.4%', overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.sheet }, photoPressable: { width: '100%' }, photoPressed: { opacity: 0.76, transform: [{ scale: 0.97 }] }, photo: { width: '100%', aspectRatio: 1, backgroundColor: colors.lifeLight }, coverBadge: { position: 'absolute', top: 6, left: 6, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.life }, coverBadgeText: { color: colors.onLife, fontSize: 8, fontWeight: '700' }, disabled: { opacity: 0.3 },
  empty: { marginTop: spacing.lg, padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.lifeLight }, emptyTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 20 }, emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 18, textAlign: 'center' }, emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sourceSheet: { padding: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, sourceOption: { minHeight: 60, alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, sourceOptionText: { color: colors.ink, fontSize: 15, fontWeight: '600' }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, actionSheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, actionPreview: { marginBottom: spacing.sm, flexDirection: 'row', alignItems: 'center' }, albumActionIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.lifeLight }, actionThumb: { width: 52, height: 52, overflow: 'hidden', borderRadius: radius.sm, backgroundColor: colors.lifeLight }, actionCopy: { flex: 1, marginLeft: spacing.md }, actionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 20 }, actionMeta: { marginTop: 3, color: colors.inkFaint, fontSize: 9 }, actionRow: { minHeight: 52, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }, actionRowPressed: { backgroundColor: colors.sheet }, actionRowText: { flex: 1, marginLeft: spacing.md, fontSize: 12 }, actionCancel: { minHeight: 50, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.sheet }, actionCancelText: { color: colors.inkSoft, fontSize: 12, fontWeight: '700' }, sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, input: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, confirm: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, confirmText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, missing: { margin: spacing.lg, color: colors.inkSoft, fontSize: 16 },
}));
