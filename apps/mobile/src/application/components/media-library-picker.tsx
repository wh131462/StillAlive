import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as MediaLibrary from 'expo-media-library/legacy';
import { usePathname, useRouter } from 'expo-router';
import { ActivityIndicator, FlatList, Image, Modal, Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { registerMediaLibraryPicker } from '../../infrastructure/platform/media-picker';
import { feedback } from '../../shared/feedback';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { previewRouteParams } from '../../features/files/file-preview.types';

type PickerOptions = ImagePicker.ImagePickerOptions;
type LibraryAsset = MediaLibrary.Asset;
type LibraryAlbum = MediaLibrary.Album;

interface PendingRequest {
  options: PickerOptions;
  resolve(result: ImagePicker.ImagePickerResult): void;
}

export function MediaLibraryPickerProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const open = useCallback((options: PickerOptions) => new Promise<ImagePicker.ImagePickerResult>((resolve) => setRequest({ options, resolve })), []);

  useEffect(() => registerMediaLibraryPicker(open), [open]);

  const close = useCallback((result: ImagePicker.ImagePickerResult) => {
    const current = request;
    setRequest(null);
    current?.resolve(result);
  }, [request]);

  return <>
    {children}
    {request ? <MediaLibraryPicker request={request} onClose={close} /> : null}
  </>;
}

function MediaLibraryPicker({ onClose, request }: { onClose(result: ImagePicker.ImagePickerResult): void; request: PendingRequest }) {
  const { options } = request;
  const allowVideos = includesMediaType(options.mediaTypes, 'videos');
  const allowMultiple = options.allowsMultipleSelection === true;
  const selectionLimit = Math.max(1, options.selectionLimit ?? (allowMultiple ? 20 : 1));
  const [albums, setAlbums] = useState<LibraryAlbum[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<LibraryAlbum | null>(null);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [selected, setSelected] = useState<LibraryAsset[]>([]);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [limitedAccess, setLimitedAccess] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [previewingId, setPreviewingId] = useState<string | null>(null);
  const [previewRouteState, setPreviewRouteState] = useState<'idle' | 'opening' | 'active'>('idle');
  const previewOriginPathname = useRef<string | null>(null);
  const cursorRef = useRef<string | undefined>(undefined);
  const loadPageRef = useRef<((reset: boolean, albumId?: string) => Promise<void>) | undefined>(undefined);
  const pageGeneration = useRef(0);
  const { width } = useWindowDimensions();
  const pathname = usePathname();
  const router = useRouter();
  const tileWidth = (width - spacing.xs * 4) / 3;

  const mediaType = useMemo(() => allowVideos ? ['photo', 'video'] as const : ['photo'] as const, [allowVideos]);

  const loadPage = useCallback(async (reset: boolean, albumId: string | null = selectedAlbum?.id ?? null) => {
    const generation = reset ? ++pageGeneration.current : pageGeneration.current;
    if (reset) setLoading(true);
    else setLoadingMore(true);
    setMessage(null);
    try {
      const result = await MediaLibrary.getAssetsAsync({
        album: albumId ?? undefined,
        first: 60,
        after: reset ? undefined : cursorRef.current,
        mediaType: [...mediaType],
        sortBy: [[MediaLibrary.SortBy.creationTime, false]],
      });
      if (generation !== pageGeneration.current) return;
      setAssets((current) => reset ? result.assets : [...current, ...result.assets.filter((asset) => !current.some((item) => item.id === asset.id))]);
      cursorRef.current = result.endCursor || undefined;
      setHasNextPage(result.hasNextPage);
    } catch (cause) {
      if (generation === pageGeneration.current) setMessage(cause instanceof Error ? cause.message : '无法读取系统相册。');
    } finally {
      if (generation === pageGeneration.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [mediaType, selectedAlbum?.id]);
  loadPageRef.current = loadPage;

  useEffect(() => {
    let active = true;
    const initialize = async () => {
      try {
        const permission = await MediaLibrary.getPermissionsAsync(false, allowVideos ? ['photo', 'video'] : ['photo']);
        const nextPermission = permission.granted ? permission : await MediaLibrary.requestPermissionsAsync(false, allowVideos ? ['photo', 'video'] : ['photo']);
        if (!active) return;
        if (!nextPermission.granted) {
          setMessage('未获得照片访问权限。');
          setLoading(false);
          return;
        }
        setLimitedAccess(nextPermission.accessPrivileges === 'limited');
        const nextAlbums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
        if (!active) return;
        setAlbums(nextAlbums.filter((album) => album.assetCount > 0));
        await loadPageRef.current?.(true);
      } catch (cause) {
        if (!active) return;
        setMessage(cause instanceof Error ? cause.message : '无法打开系统相册。');
        setLoading(false);
      }
    };
    void initialize();
    return () => { active = false; };
  }, [allowVideos]);

  useEffect(() => {
    const subscription = MediaLibrary.addListener(() => void loadPageRef.current?.(true));
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (previewRouteState === 'opening' && pathname === '/file-preview') {
      setPreviewRouteState('active');
    } else if (previewRouteState === 'active' && pathname === previewOriginPathname.current) {
      setPreviewRouteState('idle');
      previewOriginPathname.current = null;
    }
  }, [pathname, previewRouteState]);

  const chooseAlbum = (album: LibraryAlbum | null) => {
    setSelectedAlbum(album);
    setAssets([]);
    cursorRef.current = undefined;
    setHasNextPage(false);
    setSelected([]);
    void loadPage(true, album?.id ?? null);
  };

  const toggleAsset = (asset: LibraryAsset) => {
    setSelected((current) => {
      const existing = current.some((item) => item.id === asset.id);
      if (existing) return current.filter((item) => item.id !== asset.id);
      if (!allowMultiple) return [asset];
      if (current.length >= selectionLimit) return current;
      return [...current, asset];
    });
  };

  const previewAsset = async (asset: LibraryAsset) => {
    if (previewingId) return;
    setPreviewingId(asset.id);
    try {
      const uri = await resolveAssetUri(asset);
      const video = asset.mediaType === 'video';
      const fileName = asset.filename || (video ? 'video.mp4' : 'image.jpg');
      previewOriginPathname.current = pathname;
      setPreviewRouteState('opening');
      setTimeout(() => router.push({ pathname: '/file-preview', params: previewRouteParams([{ height: asset.height, name: fileName, type: mimeType(fileName, video), url: uri, width: asset.width }]) }), 0);
    } catch (cause) {
      feedback.alert('媒体预览失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setPreviewingId(null);
    }
  };

  const confirm = async () => {
    if (confirming) return;
    setConfirming(true);
    try {
      const resolved = await Promise.all(selected.map(async (asset) => {
        const uri = await resolveAssetUri(asset);
        return toImagePickerAsset(asset, uri);
      }));
      onClose({ canceled: false, assets: resolved });
    } catch (cause) {
      feedback.alert('媒体读取失败', cause instanceof Error ? cause.message : '请重试或使用系统选择器。');
    } finally {
      setConfirming(false);
    }
  };
  const useSystemPicker = async () => {
    try {
      onClose(await ImagePicker.launchImageLibraryAsync(options));
    } catch (cause) {
      feedback.alert('选择媒体失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };
  const manageAccess = async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(allowVideos ? ['photo', 'video'] : ['photo']);
      const permission = await MediaLibrary.getPermissionsAsync(false, allowVideos ? ['photo', 'video'] : ['photo']);
      setLimitedAccess(permission.accessPrivileges === 'limited');
      if (permission.granted) {
        setAlbums([]);
        setAssets([]);
        cursorRef.current = undefined;
        await loadPage(true, selectedAlbum?.id);
        const nextAlbums = await MediaLibrary.getAlbumsAsync({ includeSmartAlbums: true });
        setAlbums(nextAlbums.filter((album) => album.assetCount > 0));
      }
    } catch (cause) {
      feedback.alert('无法更新照片访问范围', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  if (previewRouteState !== 'idle') return null;

  return <Modal animationType="none" onRequestClose={() => onClose({ canceled: true, assets: null })} visible>
    <View style={styles.screen}>
      <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
        <ToolPageHeader
          backAccessibilityLabel="关闭图库"
          backLabel="取消"
          onBack={() => onClose({ canceled: true, assets: null })}
          right={<ToolPageHeaderTextAction accessibilityLabel="确认选择" disabled={!selected.length || confirming} emphasized label={confirming ? '处理中' : selected.length ? `完成 (${selected.length})` : '完成'} onPress={() => void confirm()} />}
          title="选择媒体"
        />
      </SafeAreaView>
      <ScrollView contentContainerStyle={[styles.albumRow, { alignItems: 'center' }]} horizontal showsHorizontalScrollIndicator={false} style={styles.albumStrip}>
        <AlbumChip active={!selectedAlbum} label="全部" onPress={() => chooseAlbum(null)} />
        {albums.map((album) => <AlbumChip key={album.id} active={selectedAlbum?.id === album.id} label={album.title} onPress={() => chooseAlbum(album)} />)}
      </ScrollView>
      {limitedAccess ? <Pressable accessibilityRole="button" onPress={() => void manageAccess()} style={styles.limitedNotice}><Text style={styles.limitedText}>当前仅可访问部分媒体，管理访问范围</Text></Pressable> : null}
      {loading ? <View style={styles.center}><ActivityIndicator color={colors.life} /><Text style={styles.message}>正在读取相册…</Text></View> : message ? <View style={styles.center}><Text style={styles.message}>{message}</Text><Pressable onPress={() => void useSystemPicker()} style={styles.fallbackButton}><Text style={styles.fallbackText}>使用系统选择器</Text></Pressable></View> : <FlatList
        columnWrapperStyle={styles.gridRow}
        contentContainerStyle={styles.grid}
        data={assets}
        keyExtractor={(item) => item.id}
        numColumns={3}
        onEndReached={() => { if (hasNextPage && !loadingMore) void loadPage(false); }}
        onEndReachedThreshold={0.5}
        renderItem={({ item, index }) => <AssetTile asset={item} index={index} selectedIndex={selected.findIndex((selectedAsset) => selectedAsset.id === item.id)} tileWidth={tileWidth} onPreview={() => void previewAsset(item)} onToggle={() => toggleAsset(item)} />}
        ListEmptyComponent={<View style={styles.center}><Text style={styles.message}>这个相册里还没有可用媒体。</Text></View>}
        ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.life} style={styles.footer} /> : null}
      />}
    </View>
  </Modal>;
}

function AlbumChip({ active, label, onPress }: { active?: boolean; label: string; onPress(): void }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.albumChip, { flexShrink: 0, alignSelf: 'flex-start' }, active && styles.albumChipActive]}><Text style={[styles.albumChipText, { flexShrink: 0 }, active && styles.albumChipTextActive]}>{label}</Text></Pressable>;
}

function AssetTile({ asset, index, onPreview, onToggle, selectedIndex, tileWidth }: { asset: LibraryAsset; index: number; onPreview(): void; onToggle(): void; selectedIndex: number; tileWidth: number }) {
  const selected = selectedIndex >= 0;
  return <Pressable accessibilityHint="点击预览，点击右上角勾选" accessibilityLabel={`预览第 ${index + 1} 个媒体`} accessibilityRole="button" onPress={onPreview} style={[styles.tile, { width: tileWidth }]}>
    <Image source={{ uri: asset.uri }} style={styles.tileImage} />
    <Pressable accessibilityLabel={selected ? `取消选择第 ${index + 1} 个媒体` : `选择第 ${index + 1} 个媒体`} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} hitSlop={8} onPress={(event) => { event.stopPropagation(); onToggle(); }} style={[styles.check, selected && styles.checkSelected]}>
      {selected ? <Text style={styles.checkText}>{selectedIndex + 1}</Text> : null}
    </Pressable>
    {asset.mediaType === 'video' ? <View pointerEvents="none" style={styles.videoBadge}><Text style={styles.videoText}>视频</Text></View> : null}
  </Pressable>;
}

function includesMediaType(mediaTypes: PickerOptions['mediaTypes'], type: 'images' | 'videos'): boolean {
  if (Array.isArray(mediaTypes)) return mediaTypes.includes(type);
  return mediaTypes === type;
}

async function resolveAssetUri(asset: LibraryAsset): Promise<string> {
  if (Platform.OS === 'android') return asset.uri;

  const info = await MediaLibrary.getAssetInfoAsync(asset, { shouldDownloadFromNetwork: true });
  if (!info.localUri) throw new Error(`无法读取媒体文件：${asset.filename}`);
  return info.localUri;
}

function toImagePickerAsset(asset: LibraryAsset, uri: string): ImagePicker.ImagePickerAsset {
  const video = asset.mediaType === 'video';
  const fileName = asset.filename || null;
  return { assetId: asset.id, duration: video ? Math.round(asset.duration * 1000) : null, fileName, height: asset.height, mimeType: mimeType(fileName, video), type: video ? 'video' : 'image', uri, width: asset.width };
}

function mimeType(fileName: string | null, video: boolean): string {
  const extension = fileName?.split('.').pop()?.toLowerCase();
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'm4v') return 'video/x-m4v';
  if (extension === 'webm') return 'video/webm';
  return video ? 'video/mp4' : 'image/jpeg';
}

const styles = createThemedStyles(() => ({
  screen: { flex: 1, backgroundColor: colors.paper }, headerSafeArea: { backgroundColor: colors.paper }, disabled: { opacity: 0.45 }, albumStrip: { flexGrow: 0, height: 64 }, albumRow: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingVertical: spacing.sm }, limitedNotice: { marginHorizontal: spacing.md, marginBottom: spacing.xs, padding: spacing.sm, borderRadius: 6, backgroundColor: colors.lifeLight }, limitedText: { color: colors.lifeDeep, fontSize: typography.size.meta, fontWeight: '700', textAlign: 'center' }, albumChip: { flexShrink: 0, paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.sheet }, albumChipActive: { backgroundColor: colors.lifeLight }, albumChipText: { color: colors.inkSoft, fontSize: typography.size.caption }, albumChipTextActive: { color: colors.lifeDeep, fontWeight: '800' }, grid: { padding: spacing.xs, paddingBottom: 24 }, gridRow: { gap: spacing.xs }, tile: { aspectRatio: 1, marginBottom: spacing.xs, position: 'relative', overflow: 'hidden', borderRadius: 6, backgroundColor: colors.sheet }, tileImage: { width: '100%', height: '100%' }, check: { position: 'absolute', top: 7, right: 7, width: 25, height: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.onLife, borderRadius: 13, backgroundColor: 'rgba(0,0,0,0.28)' }, checkSelected: { backgroundColor: colors.life, borderColor: colors.life }, checkText: { color: colors.onLife, fontSize: 13, fontWeight: '900' }, videoBadge: { position: 'absolute', left: 7, bottom: 7, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.62)' }, videoText: { color: colors.onLife, fontSize: 10, fontWeight: '700' }, center: { flex: 1, minHeight: 300, alignItems: 'center', justifyContent: 'center', padding: spacing.lg }, message: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.body, textAlign: 'center' }, fallbackButton: { marginTop: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm, borderRadius: 18, backgroundColor: colors.life }, fallbackText: { color: colors.onLife, fontWeight: '800' }, footer: { paddingVertical: spacing.lg }, previewBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.94)' }, previewMedia: { width: '100%', height: '78%' }, previewHint: { position: 'absolute', bottom: 42, color: 'rgba(255,255,255,0.82)', fontSize: typography.size.caption },
}));
