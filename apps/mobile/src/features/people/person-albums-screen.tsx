import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { DraggableBottomSheet } from '../../shared/components/draggable-bottom-sheet';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader, ToolPageHeaderAction, ToolPageOverview } from '../../shared/components/tool-page-header';
import { personDisplayName } from './person-profile';

export default function PersonAlbumsScreen() {
  const router = useRouter();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { albumMedia, albums, createAlbum, media, people, updateAlbum } = useAppState();
  const ownerId = personId ?? null;
  const person = personId ? people.find((item) => item.id === personId) : null;
  const displayName = person ? personDisplayName(person) : '';
  const ownerAlbums = useMemo(() => albums.filter((item) => item.personId === ownerId).sort((a, b) => a.sortOrder - b.sortOrder), [albums, ownerId]);
  const [creating, setCreating] = useState(false);
  const [managing, setManaging] = useState(false);
  const [name, setName] = useState('');

  const move = async (index: number, offset: number) => {
    const other = ownerAlbums[index + offset];
    const current = ownerAlbums[index];
    if (!other || !current) return;
    await Promise.all([updateAlbum(current.id, { sortOrder: other.sortOrder }), updateAlbum(other.id, { sortOrder: current.sortOrder })]);
  };

  if (personId && !person) return <SafeAreaView style={styles.safeArea}><ToolPageHeader onBack={() => router.back()} title="人物相册" /><Text style={styles.missing}>人物不存在或已删除。</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader
      onBack={() => router.back()}
      right={<><ToolPageHeaderAction accessibilityLabel={managing ? '完成整理' : '整理相册'} active={managing} onPress={() => setManaging((value) => !value)}><SymbolView name={{ android: managing ? 'done' : 'swap_vert', ios: managing ? 'checkmark' : 'arrow.up.arrow.down', web: managing ? 'done' : 'swap_vert' }} size={20} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction><ToolPageHeaderAction accessibilityLabel="新建相册" onPress={() => setCreating(true)}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction></>}
      title={person ? `${displayName}的相册` : '我的相册'}
    />
    <ScrollView contentContainerStyle={styles.content}>
      <ToolPageOverview
        eyebrow={person ? '人物相册' : '私人相册'}
        icon={<SymbolView name={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }} size={26} tintColor={colors.life} type="hierarchical" />}
      subtitle={managing ? '使用箭头调整相册顺序。' : person ? `整理和 ${displayName} 有关的影像与共同经历。` : '按生活片段整理只属于你的照片和视频。'}
        title={`${ownerAlbums.length} 个相册`}
      />
      {ownerAlbums.length ? <View style={styles.grid}>{ownerAlbums.map((album, index) => {
        const relations = albumMedia.filter((item) => item.albumId === album.id).sort((a, b) => a.sortOrder - b.sortOrder);
        const coverId = album.coverMediaId ?? relations[0]?.mediaId;
        const cover = media.find((item) => item.id === coverId);
        return <Pressable key={album.id} onPress={() => router.push({ pathname: '/person/album', params: { albumId: album.id } })} style={({ pressed }) => [styles.album, pressed && styles.pressed]}>
          <View><AlbumCover uri={cover?.localPath} />{managing ? <View style={styles.sortOverlay}><Pressable accessibilityLabel="上移相册" disabled={index === 0} onPress={(event) => { event.stopPropagation(); void move(index, -1); }} style={[styles.sortButton, index === 0 && styles.disabled]}><SymbolView name={{ android: 'arrow_back', ios: 'arrow.left', web: 'arrow_back' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable><View style={styles.sortDivider} /><Pressable accessibilityLabel="下移相册" disabled={index === ownerAlbums.length - 1} onPress={(event) => { event.stopPropagation(); void move(index, 1); }} style={[styles.sortButton, index === ownerAlbums.length - 1 && styles.disabled]}><SymbolView name={{ android: 'arrow_forward', ios: 'arrow.right', web: 'arrow_forward' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable></View> : null}</View>
          <View style={styles.albumCopy}><Text numberOfLines={1} style={styles.albumName}>{album.name}</Text><Text style={styles.albumMeta}>{relations.length} 个媒体</Text></View>
        </Pressable>;
      })}</View> : <Pressable onPress={() => setCreating(true)} style={styles.empty}><View style={styles.emptyIcon}><SymbolView name={{ android: 'create_new_folder', ios: 'folder.badge.plus', web: 'create_new_folder' }} size={28} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.emptyTitle}>还没有相册</Text><Text style={styles.emptyText}>{person ? '按旅行、年份或共同经历整理照片和视频。' : '把只属于你的旅行、生活和珍贵时刻收在这里。'}</Text><Text style={styles.emptyAction}>新建相册</Text></Pressable>}
    </ScrollView>
    <DraggableBottomSheet keyboardAvoiding onClose={() => setCreating(false)} open={creating} sheetStyle={styles.sheet}><Text style={styles.sheetTitle}>新建相册</Text><TextInput maxLength={40} onChangeText={setName} onSubmitEditing={() => name.trim() && void createAlbum(ownerId, name).then((album) => { setCreating(false); setName(''); router.push({ pathname: '/person/album', params: { albumId: album.id } }); }, (cause: unknown) => feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} placeholder="相册名称" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.input} value={name} /><Pressable disabled={!name.trim()} onPress={() => void createAlbum(ownerId, name).then((album) => { setCreating(false); setName(''); router.push({ pathname: '/person/album', params: { albumId: album.id } }); }, (cause: unknown) => feedback.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={[styles.confirm, !name.trim() && styles.disabled]}><Text style={styles.confirmText}>创建相册</Text></Pressable></DraggableBottomSheet>
  </SafeAreaView>;
}

function AlbumCover({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const isVideo = Boolean(uri?.match(/\.(?:mp4|mov|m4v|webm|3gp)(?:[?#]|$)/i));
  return <View style={styles.cover}>{isVideo ? <View style={styles.coverPlaceholder}><SymbolView name={{ android: 'play_circle', ios: 'play.circle.fill', web: 'play_circle' }} size={30} tintColor={colors.life} type="hierarchical" /><Text style={styles.coverEmpty}>视频</Text></View> : uri && !failed ? <Image onError={() => setFailed(true)} resizeMode="cover" source={{ uri }} style={styles.coverImage} /> : <View style={styles.coverPlaceholder}><SymbolView name={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }} size={24} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.coverEmpty}>暂无媒体</Text></View>}</View>;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, grid: { marginTop: spacing.lg, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg }, album: { width: '48%', borderRadius: radius.md }, cover: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight }, coverImage: { width: '100%', height: '100%' }, coverPlaceholder: { alignItems: 'center', gap: 6 }, coverEmpty: { color: colors.inkFaint, fontSize: 8 }, albumCopy: { paddingTop: spacing.sm }, albumName: { color: colors.ink, fontFamily: typography.display, fontSize: 16 }, albumMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 8 }, sortOverlay: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, height: 38, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 19, backgroundColor: colors.sheet }, sortButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, sortDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.line }, disabled: { opacity: 0.3 }, pressed: { opacity: 0.72 }, empty: { marginTop: spacing.lg, padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.lifeLight }, emptyTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 19 }, emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 18, textAlign: 'center' }, emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, input: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, confirm: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, confirmText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, missing: { margin: spacing.lg, color: colors.inkSoft, fontSize: 16 },
}));
