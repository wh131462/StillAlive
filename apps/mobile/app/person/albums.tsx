import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';
import { createThemedStyles } from '../../src/theme/app-theme';

export default function PersonAlbumsScreen() {
  const router = useRouter();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { albumMedia, albums, createAlbum, media, people, updateAlbum } = useAppState();
  const ownerId = personId ?? null;
  const person = personId ? people.find((item) => item.id === personId) : null;
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

  if (personId && !person) return <SafeAreaView style={styles.safeArea}><Text style={styles.missing}>人物不存在或已删除。</Text></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}><View style={styles.headerSide}><Pressable accessibilityLabel="返回" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable></View><Text style={styles.headerTitle}>{person ? `${person.name}的相册` : '我的相册'}</Text><View style={styles.headerActions}><Pressable accessibilityLabel={managing ? '完成整理' : '整理相册'} onPress={() => setManaging((value) => !value)} style={[styles.headerButton, managing && styles.headerButtonActive]}><SymbolView name={{ android: managing ? 'done' : 'swap_vert', ios: managing ? 'checkmark' : 'arrow.up.arrow.down', web: managing ? 'done' : 'swap_vert' }} size={20} tintColor={colors.life} type="hierarchical" /></Pressable><Pressable accessibilityLabel="新建相册" onPress={() => setCreating(true)} style={styles.headerButton}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={22} tintColor={colors.life} type="hierarchical" /></Pressable></View></View>
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.summary}><Text style={styles.summaryText}>{ownerAlbums.length} 个相册</Text>{managing ? <Text style={styles.summaryAction}>使用箭头调整顺序</Text> : null}</View>
      {ownerAlbums.length ? <View style={styles.grid}>{ownerAlbums.map((album, index) => {
        const relations = albumMedia.filter((item) => item.albumId === album.id).sort((a, b) => a.sortOrder - b.sortOrder);
        const coverId = album.coverMediaId ?? relations[0]?.mediaId;
        const cover = media.find((item) => item.id === coverId);
        return <Pressable key={album.id} onPress={() => router.push({ pathname: '/person/album', params: { albumId: album.id } })} style={({ pressed }) => [styles.album, pressed && styles.pressed]}>
          <View><AlbumCover uri={cover?.localPath} />{managing ? <View style={styles.sortOverlay}><Pressable accessibilityLabel="上移相册" disabled={index === 0} onPress={(event) => { event.stopPropagation(); void move(index, -1); }} style={[styles.sortButton, index === 0 && styles.disabled]}><SymbolView name={{ android: 'arrow_back', ios: 'arrow.left', web: 'arrow_back' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable><View style={styles.sortDivider} /><Pressable accessibilityLabel="下移相册" disabled={index === ownerAlbums.length - 1} onPress={(event) => { event.stopPropagation(); void move(index, 1); }} style={[styles.sortButton, index === ownerAlbums.length - 1 && styles.disabled]}><SymbolView name={{ android: 'arrow_forward', ios: 'arrow.right', web: 'arrow_forward' }} size={17} tintColor={colors.life} type="hierarchical" /></Pressable></View> : null}</View>
          <View style={styles.albumCopy}><Text numberOfLines={1} style={styles.albumName}>{album.name}</Text><Text style={styles.albumMeta}>{relations.length} 张照片</Text></View>
        </Pressable>;
      })}</View> : <Pressable onPress={() => setCreating(true)} style={styles.empty}><View style={styles.emptyIcon}><SymbolView name={{ android: 'create_new_folder', ios: 'folder.badge.plus', web: 'create_new_folder' }} size={28} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.emptyTitle}>还没有相册</Text><Text style={styles.emptyText}>{person ? '按旅行、年份或共同经历整理照片。' : '把只属于你的旅行、生活和珍贵时刻收在这里。'}</Text><Text style={styles.emptyAction}>新建相册</Text></Pressable>}
    </ScrollView>
    <Modal animationType="slide" onRequestClose={() => setCreating(false)} transparent visible={creating}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}><Pressable onPress={() => setCreating(false)} style={styles.backdrop}><Pressable onPress={(event) => event.stopPropagation()} style={styles.sheet}><View style={styles.handle} /><Text style={styles.sheetTitle}>新建相册</Text><TextInput autoFocus maxLength={40} onChangeText={setName} onSubmitEditing={() => name.trim() && void createAlbum(ownerId, name).then((album) => { setCreating(false); setName(''); router.push({ pathname: '/person/album', params: { albumId: album.id } }); }, (cause: unknown) => Alert.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} placeholder="相册名称" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.input} value={name} /><Pressable disabled={!name.trim()} onPress={() => void createAlbum(ownerId, name).then((album) => { setCreating(false); setName(''); router.push({ pathname: '/person/album', params: { albumId: album.id } }); }, (cause: unknown) => Alert.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。'))} style={[styles.confirm, !name.trim() && styles.disabled]}><Text style={styles.confirmText}>创建相册</Text></Pressable></Pressable></Pressable></KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}

function AlbumCover({ uri }: { uri?: string }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  return <View style={styles.cover}>{uri && !failed ? <Image onError={() => setFailed(true)} resizeMode="cover" source={{ uri }} style={styles.coverImage} /> : <View style={styles.coverPlaceholder}><SymbolView name={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }} size={24} tintColor={colors.inkFaint} type="hierarchical" /><Text style={styles.coverEmpty}>暂无照片</Text></View>}</View>;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerSide: { width: 88 }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerButtonActive: { borderRadius: 22, backgroundColor: colors.lifeLight }, headerActions: { width: 88, flexDirection: 'row' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, summary: { marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, summaryText: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 }, summaryAction: { color: colors.life, fontSize: 9 }, grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: spacing.lg }, album: { width: '48%', borderRadius: radius.md }, cover: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.lifeLight }, coverImage: { width: '100%', height: '100%' }, coverPlaceholder: { alignItems: 'center', gap: 6 }, coverEmpty: { color: colors.inkFaint, fontSize: 8 }, albumCopy: { paddingTop: spacing.sm }, albumName: { color: colors.ink, fontFamily: typography.display, fontSize: 16 }, albumMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 8 }, sortOverlay: { position: 'absolute', right: spacing.sm, bottom: spacing.sm, height: 38, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderRadius: 19, backgroundColor: colors.sheet }, sortButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, sortDivider: { width: StyleSheet.hairlineWidth, height: 18, backgroundColor: colors.line }, disabled: { opacity: 0.3 }, pressed: { opacity: 0.72 }, empty: { marginTop: spacing.md, padding: spacing.xl, alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, emptyIcon: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center', borderRadius: 28, backgroundColor: colors.lifeLight }, emptyTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 19 }, emptyText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10, lineHeight: 18, textAlign: 'center' }, emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' }, backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop }, sheet: { padding: spacing.lg, paddingBottom: spacing.xxl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.paper }, handle: { width: 36, height: 4, marginBottom: spacing.lg, alignSelf: 'center', borderRadius: 2, backgroundColor: colors.line }, sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 22 }, input: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink }, confirm: { minHeight: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, confirmText: { color: colors.onLife, fontSize: 11, fontWeight: '700' }, missing: { margin: spacing.lg, color: colors.inkSoft, fontSize: 16 },
}));
