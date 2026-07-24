import { useState } from 'react';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';

export default function DataScreen() {
  const router = useRouter();
  const { albumMedia, albums, checkIns, media, people, posts, preferences, tagDefinitions } = useAppState();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = preferences.profileAvatarMediaId ? media.find((item) => item.id === preferences.profileAvatarMediaId) : null;
  const customTags = preferences.profileCustomTagIds.map((id) => tagDefinitions.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name));
  const tags = [preferences.profileMbti, ...customTags].filter(Boolean).slice(0, 4);
  const recordedDays = new Set([...posts.map((post) => post.dayKey), ...checkIns.map((item) => item.dayKey)]).size;
  const latestDay = [...posts.map((post) => post.dayKey), ...checkIns.map((item) => item.dayKey)].sort().at(-1);
  const selfAlbums = albums.filter((album) => album.personId === null);
  const selfAlbumIds = new Set(selfAlbums.map((album) => album.id));
  const selfPhotos = albumMedia.filter((item) => selfAlbumIds.has(item.albumId));
  const firstAlbum = selfAlbums.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const firstPhotoId = firstAlbum?.coverMediaId ?? selfPhotos.find((item) => item.albumId === firstAlbum?.id)?.mediaId;
  const albumCover = media.find((item) => item.id === firstPhotoId);

  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}><View><Text style={styles.eyebrow}>PROFILE</Text><Text style={styles.title}>我的</Text></View><Pressable accessibilityLabel="设置" onPress={() => router.push('/settings')} style={styles.settingsButton}><SymbolView name={{ android: 'settings', ios: 'gearshape', web: 'settings' }} size={23} tintColor={colors.inkSoft} type="hierarchical" /></Pressable></View>

      <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
        <View style={styles.avatar}>{avatar && !avatarFailed ? <Image onError={() => setAvatarFailed(true)} source={{ uri: avatar.localPath }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{preferences.nickname.trim().slice(0, 1) || '我'}</Text>}</View>
        <View style={styles.profileCopy}><Text style={styles.name}>{preferences.nickname || '未设置昵称'}</Text>{preferences.birthDate ? <Text style={styles.profileMeta}>出生日期 {formatDate(preferences.birthDate)}</Text> : <Text style={styles.profileMeta}>完善头像、生日和个人标签</Text>}{tags.length ? <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View> : null}</View>
        <View style={styles.editIcon}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={18} tintColor={colors.life} type="hierarchical" /></View>
      </Pressable>

      <Text style={styles.sectionLabel}>我的记录</Text>
      <View style={styles.stats}>
        <Stat label="日记" value={posts.length} />
        <View style={styles.statDivider} />
        <Stat label="打卡" value={checkIns.length} />
        <View style={styles.statDivider} />
        <Stat label="人物" value={people.length} />
        <View style={styles.statDivider} />
        <Stat label="图片" value={media.length} />
      </View>

      <Pressable accessibilityLabel="打开我的相册" accessibilityRole="button" onPress={() => router.push('/person/albums')} style={({ pressed }) => [styles.albumCard, pressed && styles.pressed]}>
        <View style={styles.albumCover}>{albumCover ? <Image accessibilityLabel="我的相册封面" resizeMode="cover" source={{ uri: albumCover.localPath }} style={styles.albumCoverImage} /> : <SymbolView name={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }} pointerEvents="none" size={27} tintColor={colors.life} type="hierarchical" />}</View>
        <View style={styles.albumCopy}><Text style={styles.albumEyebrow}>MY ALBUMS</Text><Text style={styles.albumTitle}>我的相册</Text><Text style={styles.albumMeta}>{selfAlbums.length ? `${selfAlbums.length} 个相册 · ${selfPhotos.length} 张照片` : '收好只属于你的珍贵时刻'}</Text></View>
        <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={18} tintColor={colors.inkFaint} type="hierarchical" />
      </Pressable>

      <Pressable accessibilityLabel="查看记忆轨迹" accessibilityRole="button" onPress={() => router.push('/time')} style={({ pressed }) => [styles.memoryCard, pressed && styles.pressed]}>
        <View style={styles.memoryCardTop}>
          <View>
            <Text style={styles.memoryEyebrow}>MEMORY TRACE</Text>
            <Text style={styles.memoryTitle}>这些日子，正在慢慢长大</Text>
          </View>
          <SymbolView name={{ android: 'arrow_outward', ios: 'arrow.up.right', web: 'arrow_outward' }} pointerEvents="none" size={18} tintColor={colors.life} type="hierarchical" />
        </View>
        <Text style={styles.memoryText}>{latestDay ? `最近一次留下在 ${formatDate(latestDay)}。` : '从今天开始，留下第一段属于你的时间。'}</Text>
        <View style={styles.memoryMeta}><Text style={styles.memoryMetaText}>已记录 {recordedDays} 天</Text><View style={styles.memoryDot} /><Text style={styles.memoryMetaText}>收藏 {media.length} 张图片</Text></View>
      </Pressable>
    </ScrollView>
  </SafeAreaView>;
}

function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

function formatDate(value: string) { const [year, month, day] = value.split('-'); return `${year}年${Number(month)}月${Number(day)}日`; }

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, titleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }, eyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 }, title: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 36 }, settingsButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.sheet },
  profileCard: { marginTop: spacing.lg, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.life }, avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: 'rgba(255,255,255,0.38)', borderRadius: 38, backgroundColor: colors.paper }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: colors.life, fontFamily: typography.display, fontSize: 30 }, profileCopy: { flex: 1, marginLeft: spacing.md }, name: { color: colors.onLife, fontFamily: typography.display, fontSize: 22 }, profileMeta: { marginTop: 5, color: colors.onLifeMuted, fontSize: 9 }, tags: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.13)' }, tagText: { color: colors.onLife, fontSize: 8 }, editIcon: { position: 'absolute', top: spacing.md, right: spacing.md, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.sheet },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.2 }, stats: { minHeight: 82, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.ink, fontFamily: typography.display, fontSize: 23 }, statLabel: { marginTop: 3, color: colors.inkFaint, fontSize: 8 }, statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.line },
  albumCard: { minHeight: 92, marginTop: spacing.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(32, 35, 31, 0.09)', borderRadius: radius.lg, backgroundColor: colors.sheet },
  albumCover: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight },
  albumCoverImage: { width: '100%', height: '100%' },
  albumCopy: { flex: 1, marginLeft: spacing.md },
  albumEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 7, letterSpacing: 1.1 },
  albumTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  albumMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 8 },
  memoryCard: { marginTop: spacing.xl, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.lifeLight },
  memoryCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  memoryEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 8, letterSpacing: 1.2 },
  memoryTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  memoryText: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 11, lineHeight: 19 },
  memoryMeta: { marginTop: spacing.lg, flexDirection: 'row', alignItems: 'center' },
  memoryMetaText: { color: colors.life, fontSize: 9, fontWeight: '700' },
  memoryDot: { width: 3, height: 3, marginHorizontal: spacing.sm, borderRadius: 2, backgroundColor: colors.sun },
  pressed: { opacity: 0.72 },
});
