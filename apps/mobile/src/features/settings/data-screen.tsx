import { useEffect, useState } from 'react';
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
  const { albumMedia, albums, books, checkIns, media, musicCollectionEntries, people, posts, preferences, tagDefinitions } = useAppState();
  const [avatarFailed, setAvatarFailed] = useState(false);
  const avatar = preferences.profileAvatarMediaId ? media.find((item) => item.id === preferences.profileAvatarMediaId) : null;
  const avatarUri = avatar?.localPath ?? null;
  const customTags = preferences.profileCustomTagIds.map((id) => tagDefinitions.find((tag) => tag.id === id)?.name).filter((name): name is string => Boolean(name));
  const tags = [preferences.profileMbti, ...customTags].filter(Boolean).slice(0, 4);
  const selfAlbums = albums.filter((album) => album.personId === null);
  const selfAlbumIds = new Set(selfAlbums.map((album) => album.id));
  const selfPhotos = albumMedia.filter((item) => selfAlbumIds.has(item.albumId));
  const firstAlbum = selfAlbums.sort((a, b) => a.sortOrder - b.sortOrder)[0];
  const firstPhotoId = firstAlbum?.coverMediaId ?? selfPhotos.find((item) => item.albumId === firstAlbum?.id)?.mediaId;
  const albumCover = media.find((item) => item.id === firstPhotoId);
  const imageCount = media.filter((item) => item.mimeType.startsWith('image/')).length;
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
        subtitle="你的记录、相册与个人资料。"
        title="我的"
      />

      <Pressable accessibilityRole="button" onPress={() => router.push('/profile')} style={({ pressed }) => [styles.profileCard, pressed && styles.pressed]}>
        <View pointerEvents="none" style={styles.profileCardAccent} />
        <View style={styles.avatar}>{avatarUri && !avatarFailed ? <Image accessibilityLabel="我的头像" onError={() => setAvatarFailed(true)} resizeMode="cover" source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{preferences.nickname.trim().slice(0, 1) || '我'}</Text>}</View>
        <View style={styles.profileCopy}><StyledName numberOfLines={1} style={styles.name} value={preferences.nickname || '未设置昵称'} variant={preferences.selfNameStyle} />{preferences.profileBio ? <Text numberOfLines={2} style={styles.profileBio}>{preferences.profileBio}</Text> : null}{profileValues.length ? <View style={styles.profileDetails}><Text style={styles.profileMeta}>{profileValues.join(' ')}</Text></View> : null}{tags.length ? <View style={styles.tags}>{tags.map((tag) => <View key={tag} style={styles.tag}><Text style={styles.tagText}>{tag}</Text></View>)}</View> : null}</View>
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
        <Stat label="媒体" value={imageCount + voiceCount} />
      </View>

      <Pressable accessibilityLabel="打开我的相册" accessibilityRole="button" onPress={() => router.push('/person/albums')} style={({ pressed }) => [styles.albumCard, pressed && styles.pressed]}>
        <View style={styles.albumCover}>{albumCover ? <Image accessibilityLabel="我的相册封面" resizeMode="cover" source={{ uri: albumCover.localPath }} style={styles.albumCoverImage} /> : <SymbolView name={{ android: 'photo_library', ios: 'photo.on.rectangle', web: 'photo_library' }} pointerEvents="none" size={27} tintColor={colors.life} type="hierarchical" />}</View>
        <View style={styles.albumCopy}><Text style={styles.albumEyebrow}>MY ALBUMS</Text><Text style={styles.albumTitle}>我的相册</Text><Text style={styles.albumMeta}>{selfAlbums.length ? `${selfAlbums.length} 个相册 / ${selfPhotos.length} 张照片` : '收好只属于你的珍贵时刻'}</Text></View>
        <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={18} tintColor={colors.inkFaint} type="hierarchical" />
      </Pressable>

      <Pressable accessibilityLabel="打开密码本" accessibilityRole="button" onPress={() => router.push('/vault')} style={({ pressed }) => [styles.vaultCard, pressed && styles.pressed]}>
        <View pointerEvents="none" style={styles.vaultLogo}>
          <View style={styles.vaultLogoShadow} />
          <View style={styles.vaultLogoFace}>
            <SymbolView name={{ android: 'menu_book', ios: 'book.closed.fill', web: 'menu_book' }} size={25} tintColor={colors.lifeDeep} type="hierarchical" />
            <View style={styles.vaultLogoBadge}><SymbolView name={{ android: 'lock', ios: 'lock.fill', web: 'lock' }} size={10} tintColor={colors.onLife} type="hierarchical" /></View>
          </View>
        </View>
        <View style={styles.vaultCopy}><Text style={styles.vaultTitle}>密码本</Text><Text numberOfLines={1} style={styles.vaultMeta}>独立主密码保护 / 只保存在本机</Text></View>
        <SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} pointerEvents="none" size={18} tintColor={colors.inkFaint} type="hierarchical" />
      </Pressable>

      <Pressable accessibilityRole="button" onPress={() => router.push('/music-box' as RelativePathString)} style={({ pressed }) => [styles.mediaCard, pressed && styles.pressed]}>
        <View style={styles.mediaIcon}><SymbolView name={{ android: 'music_note', ios: 'music.note', web: 'music_note' }} size={25} tintColor={colors.life} type="hierarchical" /></View>
        <View style={styles.mediaCopy}><Text style={styles.mediaTitle}>音乐盒</Text><Text style={styles.mediaMeta}>{musicCollectionEntries.some((entry) => entry.targetType === 'self') ? `${musicCollectionEntries.filter((entry) => entry.targetType === 'self').length} 首本地音乐` : '收集你喜欢的声音'}</Text></View><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => router.push('/bookshelf' as RelativePathString)} style={({ pressed }) => [styles.mediaCard, pressed && styles.pressed]}>
        <View style={[styles.mediaIcon, styles.bookIcon]}><SymbolView name={{ android: 'menu_book', ios: 'book.closed.fill', web: 'menu_book' }} size={25} tintColor={colors.life} type="hierarchical" /></View>
        <View style={styles.mediaCopy}><Text style={styles.mediaTitle}>我的书架</Text><Text style={styles.mediaMeta}>{books.length ? `${books.length} 本书` : '把读过的书留下来'}</Text></View><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" />
      </Pressable>

    </ScrollView>
  </SafeAreaView>;
}

function Stat({ label, value }: { label: string; value: number }) { return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>; }

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
  profileCard: { marginTop: 0, padding: spacing.lg, flexDirection: 'row', alignItems: 'center', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet }, profileCardAccent: { position: 'absolute', top: 0, right: spacing.lg, width: 58, height: 4, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: colors.life }, avatar: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 2, borderColor: colors.lifeLine, borderRadius: 38, backgroundColor: colors.lifeLight }, avatarImage: { width: '100%', height: '100%' }, avatarText: { color: colors.life, fontFamily: typography.display, fontSize: 30 }, profileCopy: { flex: 1, marginLeft: spacing.md, paddingRight: spacing.xl }, name: { fontFamily: typography.display, fontSize: 22 }, profileBio: { marginTop: 5, color: colors.inkSoft, fontFamily: typography.display, fontSize: typography.size.caption, lineHeight: 17 }, profileDetails: { marginTop: spacing.sm }, profileMeta: { color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 16 }, tags: { marginTop: spacing.sm, flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, tag: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 10, backgroundColor: colors.lifeLight }, tagText: { color: colors.life, fontSize: typography.size.meta }, editIcon: { position: 'absolute', top: spacing.md, right: spacing.md, width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: colors.lifeLight },
  sectionLabel: { marginTop: spacing.xl, marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, stats: { minHeight: 82, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, stat: { flex: 1, alignItems: 'center' }, statValue: { color: colors.ink, fontFamily: typography.display, fontSize: 23 }, statLabel: { marginTop: 3, color: colors.inkFaint, fontSize: typography.size.meta }, statDivider: { width: StyleSheet.hairlineWidth, height: 28, backgroundColor: colors.line },
  albumCard: { minHeight: 92, marginTop: spacing.xl, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet },
  albumCover: { width: 62, height: 62, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight },
  albumCoverImage: { width: '100%', height: '100%' },
  albumCopy: { flex: 1, marginLeft: spacing.md },
  albumEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.1 },
  albumTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  albumMeta: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
  vaultCard: { minHeight: 84, marginTop: spacing.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet },
  vaultLogo: { width: 58, height: 58, alignItems: 'center', justifyContent: 'center' },
  vaultLogoShadow: { position: 'absolute', width: 48, height: 48, borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLine, transform: [{ rotate: '5deg' }] },
  vaultLogoFace: { width: 50, height: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.sun, borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.sunLight, transform: [{ rotate: '-3deg' }] },
  vaultLogoBadge: { position: 'absolute', right: -5, bottom: -5, width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.sheet, borderRadius: 11, backgroundColor: colors.lifeDeep, transform: [{ rotate: '3deg' }] },
  vaultCopy: { minWidth: 0, flex: 1, marginLeft: spacing.md },
  vaultTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  vaultMeta: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta },
  pressed: { opacity: 0.72 }, mediaCard: { minHeight: 82, marginTop: spacing.md, padding: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.lg, backgroundColor: colors.sheet }, mediaIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 26, backgroundColor: colors.lifeLight }, bookIcon: { backgroundColor: colors.sunLight }, mediaCopy: { flex: 1, marginLeft: spacing.md }, mediaTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 }, mediaMeta: { marginTop: 4, color: colors.inkFaint, fontSize: typography.size.meta },
}));
