import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { Birthday } from '@still-alive/types';
import { useAppState } from '../../application/state/app-state';
import { formatGender } from '../people/gender-picker';
import { StyledName } from '../people/styled-name';
import { TabPageHeader } from '../../shared/components/tab-page-header';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { birthdayFromDateString, birthdaySolarDate, formatBirthday } from '../people/person-profile';

export default function DataScreen() {
  const router = useRouter();
  const { albumMedia, albums, books, checkIns, media, musicCollectionEntries, musicPlaylists, people, posts, preferences, tagDefinitions } = useAppState();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = preferences.profileAvatarMediaId ? media.find((item) => item.id === preferences.profileAvatarMediaId) : null;
  const avatarUri = avatar?.localPath ?? null;
  const customTags = preferences.profileCustomTagIds.map((id) => tagDefinitions.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name));
  const tags = [preferences.profileMbti, ...customTags].filter(Boolean).slice(0, 4);
  const selfAlbums = albums.filter((album) => album.personId === null);
  const selfAlbumIds = new Set(selfAlbums.map((album) => album.id));
  const selfPhotos = albumMedia.filter((item) => selfAlbumIds.has(item.albumId));
  const selfMusicCount = musicCollectionEntries.filter((entry) => entry.targetType === 'self').length;
  const imageCount = media.filter((item) => item.mimeType.startsWith('image/')).length;
  const videoCount = media.filter((item) => item.mimeType.startsWith('video/')).length;
  const voiceCount = media.filter((item) => item.mimeType.startsWith('audio/')).length;
  const selfBirthday = birthdayFromDateString(preferences.birthDate, preferences.birthDateCalendar, preferences.birthDateIsLeapMonth);
  const age = currentAge(selfBirthday);
  const profileValues = [age === null ? null : `${age} 岁`, preferences.profileGender ? formatGender(preferences.profileGender) : null, selfBirthday ? formatBirthday(selfBirthday) : null].filter((value): value is string => Boolean(value));

  useEffect(() => setAvatarFailed(false), [avatarUri]);

  return <SafeAreaView style={styles.safeArea}>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <TabPageHeader
        action={<Pressable accessibilityLabel="设置" onPress={() => router.push('/settings')} style={styles.settingsButton}><SymbolView name={{ android: 'settings', ios: 'gearshape', web: 'settings' }} size={23} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>}
        eyebrow="PROFILE"
        subtitle="你的记录、收藏与私人空间。"
        title="我的"
      />

      <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
        <View pointerEvents="none" style={styles.profileCardAccent} />
        <View style={styles.avatar}>{avatarUri && !avatarFailed ? <Image accessibilityLabel="我的头像" onError={() => setAvatarFailed(true)} resizeMode="cover" source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{preferences.nickname.trim().slice(0, 1) || '我'}</Text>}</View>
        <View style={styles.profileCopy}><StyledName numberOfLines={1} style={styles.name} value={preferences.nickname || '未设置昵称'} variant={preferences.selfNameStyle} />{preferences.profileSignature ? <Text numberOfLines={2} style={styles.profileSignature}>{preferences.profileSignature}</Text> : null}{profileValues.length ? <View style={styles.profileDetails}><Text style={styles.profileMeta}>{profileValues.join(' ')}</Text></View> : null}{tags.length ? <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View> : null}</View>
        <View style={styles.editIcon}><SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={18} tintColor={colors.life} type="hierarchical" /></View>
      </Pressable>

      <Text style={styles.sectionLabel}>我的记录</Text>
      <View style={styles.stats}>
        <Stat label="记录" value={posts.length} />
        <View style={styles.statDivider} />
        <Stat label="打卡" value={checkIns.length} />
        <View style={styles.statDivider} />
        <Stat label="人物" value={people.length} />
        <View style={styles.statDivider} />
        <Stat label="媒体" value={imageCount + videoCount + voiceCount} />
      </View>

      <Text style={styles.sectionLabel}>我的空间</Text>
      <View style={styles.spaceGrid}>
        <SpaceCard
          accessibilityLabel="打开我的相册"
          icon={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }}
          meta={selfAlbums.length ? `${selfAlbums.length} 个相册，${selfPhotos.length} 个媒体` : '照片、视频与生活片段'}
          onPress={() => router.push('/person/albums')}
          title="相册"
        />
        <SpaceCard
          accessibilityLabel="打开我的音乐盒"
          icon={{ android: 'music_note', ios: 'music.note', web: 'music_note' }}
          meta={selfMusicCount || musicPlaylists.length ? `${selfMusicCount} 首音乐，${musicPlaylists.length} 个歌单` : '喜欢的声音与歌单'}
          onPress={() => router.push('/music-box' as RelativePathString)}
          title="音乐盒"
        />
        <SpaceCard
          accessibilityLabel="打开我的书架"
          icon={{ android: 'menu_book', ios: 'book.closed.fill', web: 'menu_book' }}
          meta={books.length ? `${books.length} 本书` : '书籍、书摘与阅读进度'}
          onPress={() => router.push('/bookshelf' as RelativePathString)}
          title="书架"
          warm
        />
        <SpaceCard
          accessibilityLabel="打开我的密码本"
          icon={{ android: 'key', ios: 'key.fill', web: 'key' }}
          meta="本机加密，离开即锁定"
          onPress={() => router.push('/vault')}
          title="密码本"
          warm
        />
      </View>

    </ScrollView>
  </SafeAreaView>;
}

function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

function SpaceCard({ accessibilityLabel, icon, meta, onPress, title, warm = false }: { accessibilityLabel: string; icon: ComponentProps<typeof SymbolView>['name']; meta: string; onPress(): void; title: string; warm?: boolean }) {
  return <Pressable accessibilityLabel={accessibilityLabel} accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.spaceCard, pressed && styles.pressed]}><View style={[styles.spaceIcon, warm && styles.spaceIconWarm]}><SymbolView name={icon} pointerEvents="none" size={24} tintColor={colors.life} type="hierarchical" /></View><SymbolView name={{ android: 'arrow_outward', ios: 'arrow.up.right', web: 'arrow_outward' }} pointerEvents="none" size={16} tintColor={colors.inkFaint} type="hierarchical" /><View style={styles.spaceCopy}><Text style={styles.spaceTitle}>{title}</Text><Text numberOfLines={2} style={styles.spaceMeta}>{meta}</Text></View></Pressable>;
}

function currentAge(value: Birthday | null, today = new Date()): number | null {
  if (!value) return null;
  const birthday = birthdaySolarDate(value);
  const year = birthday.getFullYear();
  const month = birthday.getMonth() + 1;
  const day = birthday.getDate();
  return today.getFullYear() - year - (today.getMonth() + 1 < month || (today.getMonth() + 1 === month && today.getDate() < day) ? 1 : 0);
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper }, content: { padding: spacing.lg, paddingBottom: spacing.xxl }, settingsButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.sheet },
  profileCard: { marginTop: 0, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet }, profileCardAccent: { position: 'absolute', top: 0, right: spacing.lg, width: 58, height: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.life }, avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: colors.lifeLine, borderRadius: 38, backgroundColor: colors.lifeLight }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: colors.life, fontFamily: typography.display, fontSize: 30 }, profileCopy: { flex: 1, marginLeft: spacing.md, paddingRight: spacing.xl }, name: { fontFamily: typography.display, fontSize: 22 }, profileSignature: { marginTop: 5, color: colors.inkSoft, fontFamily: typography.display, fontSize: typography.size.caption, lineHeight: 17 }, profileDetails: { marginTop: spacing.sm }, profileMeta: { color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 }, tags: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.lifeLight }, tagText: { color: colors.life, fontSize: typography.size.meta }, editIcon: { position: 'absolute', top: spacing.md, right: spacing.md, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.lifeLight },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, stats: { minHeight: 82, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.ink, fontFamily: typography.display, fontSize: 23 }, statLabel: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta }, statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.line },
  spaceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  spaceCard: { width: '47%', minHeight: 132, padding: spacing.md, flexGrow: 1, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet },
  spaceIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight },
  spaceIconWarm: { backgroundColor: colors.sunLight },
  spaceCopy: { position: 'absolute', right: spacing.md, bottom: spacing.md, left: spacing.md },
  spaceTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  spaceMeta: { minHeight: 30, marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 15 },
  pressed: { opacity: 0.68, transform: [{ scale: 0.985 }] },
}));
