import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Post } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';
import { extractAudioEmbeds } from '../../src/domain/embedded-media';
import { constellationForBirthday, formatBirthday, nextBirthday, toLocalDayKey, zodiacForBirthday } from '../../src/domain/person-profile';

export default function PersonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { albums, deletePerson, getPostsByPerson, media, people, personTags, posts: allPosts, ready, setPersonMemoryEnabled, tagDefinitions, tagSystemSettings, todayCheckIn } = useAppState();
  const [posts, setPosts] = useState<Post[]>([]);
  const person = useMemo(() => people.find((item) => item.id === id), [id, people]);
  const avatar = person?.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
  const personAssignments = personTags.filter((item) => item.personId === person?.id);
  const enabledSystems = new Set(tagSystemSettings.filter((item) => item.enabled).map((item) => item.system));
  const labels = person ? [
    enabledSystems.has('mbti') ? personAssignments.find((item) => item.kind === 'mbti')?.value : null,
    enabledSystems.has('constellation') && person.birthday ? constellationForBirthday(person.birthday) : null,
    enabledSystems.has('zodiac') && person.birthday ? `${zodiacForBirthday(person.birthday)}年` : null,
    ...(enabledSystems.has('custom') ? personAssignments.filter((item) => item.kind === 'custom').map((item) => tagDefinitions.find((tag) => tag.id === item.value)?.name ?? null) : []),
  ].filter((value): value is string => Boolean(value)) : [];

  useEffect(() => {
    if (!ready || !id) return;
    void getPostsByPerson(id).then(setPosts);
  }, [allPosts, getPostsByPerson, id, ready]);

  useEffect(() => {
    if (ready && !person) router.replace('/people');
  }, [person, ready, router]);

  const confirmDelete = () => {
    if (!person) return;
    const albumCount = albums.filter((album) => album.personId === person.id).length;
    Alert.alert(`删除 ${person.name}？`, `人物会被删除，历史日记会保留，只解除人物关联。${albumCount ? `同时永久删除 ${albumCount} 个相册及其中照片。` : ''}`, [
      { text: '取消', style: 'cancel' },
      { text: '删除人物', style: 'destructive', onPress: () => void deletePerson(person.id).then(
        () => router.replace('/people'),
        (cause: unknown) => Alert.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。'),
      ) },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.backButton}>
            <SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" />
          </Pressable>
          {person ? <View style={styles.headerActions}>
            <Pressable accessibilityLabel="编辑人物" accessibilityRole="button" onPress={() => router.push({ pathname: '/person/edit', params: { id: person.id } })} style={styles.headerButton}>
              <SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={20} tintColor={colors.life} type="hierarchical" />
            </Pressable>
            {todayCheckIn ? <Pressable accessibilityLabel={`写一条与${person.name}有关的日记`} accessibilityRole="button" onPress={() => router.push({ pathname: '/editor', params: { personId: person.id } })} style={styles.headerButton}>
              <SymbolView name={{ android: 'edit_note', ios: 'square.and.pencil', web: 'edit_note' }} size={21} tintColor={colors.life} type="hierarchical" />
            </Pressable> : null}
          </View> : null}
        </View>

        {person ? (
          <>
            <View style={styles.avatar}>{avatar ? <Image accessibilityLabel={`${person.name}的头像`} resizeMode="cover" source={{ uri: avatar.localPath }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text>}</View>
            <Text style={styles.name}>{person.name}</Text>
            <Text style={styles.relation}>{person.relationToMe ?? '暂时不定义关系'}</Text>
            {person.impression ? <Text style={styles.impression}>{person.impression}</Text> : null}
            {person.birthday ? <View style={styles.profileMeta}><Text style={styles.profileMetaTitle}>{formatBirthday(person.birthday)}</Text><Text style={styles.profileMetaHint}>下一次 {toLocalDayKey(nextBirthday(person.birthday))}</Text></View> : <Text style={styles.emptyMeta}>还没有记录生日</Text>}
            {labels.length ? <View style={styles.tags}>{labels.map((label) => <View key={label} style={styles.tag}><Text style={styles.tagText}>{label}</Text></View>)}</View> : <Text style={styles.emptyMeta}>还没有人物标签</Text>}
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/person/albums', params: { personId: person.id } })} style={styles.albumEntry}><View><Text style={styles.albumTitle}>人物相册</Text><Text style={styles.albumHint}>按文件夹整理只属于 {person.name} 的照片</Text></View><Text style={styles.albumCount}>{albums.filter((album) => album.personId === person.id).length} 个 ›</Text></Pressable>
            <Pressable accessibilityRole="switch" accessibilityState={{ checked: person.memoryEnabled }} onPress={() => void setPersonMemoryEnabled(person.id, !person.memoryEnabled)} style={styles.memorySetting}>
              <View style={[styles.memoryIndicator, person.memoryEnabled && styles.memoryIndicatorOn]} />
              <View style={styles.memorySettingText}>
                <Text style={styles.memorySettingTitle}>偶尔在今日页想起 {person.name}</Text>
                <Text style={styles.memorySettingHint}>{person.memoryEnabled ? '已开启 可以随时关闭' : '已关闭 记录仍会完整保留'}</Text>
              </View>
            </Pressable>

            <View style={styles.sectionLine}><Text style={styles.sectionTitle}>共同留下的日子</Text><Text style={styles.count}>{posts.length} 条</Text></View>
            {posts.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyTitle}>记忆还没有落到纸上</Text>
                <Text style={styles.emptyText}>{todayCheckIn ? '写下一条记录，它会自动留在这里。' : '今天打卡后，就可以写下第一条共同记忆。'}</Text>
              </View>
            ) : posts.map((post) => {
              const imageId = firstMediaId(post.bodyMarkdown);
              const image = imageId ? media.find((item) => item.id === imageId) : undefined;
              return (
                <Pressable key={post.id} accessibilityRole="button" onPress={() => router.push(`/post/${post.id}`)} style={({ pressed }) => [styles.memory, pressed && styles.memoryPressed]}>
                  <Text style={styles.date}>{post.dayKey.replaceAll('-', '.')}</Text>
                  {image ? <Image accessibilityLabel="共同记忆图片" resizeMode="cover" source={{ uri: image.localPath }} style={styles.memoryImage} /> : null}
                  <Text style={styles.body}>{markdownToPlainText(post.bodyMarkdown) || (extractAudioEmbeds(post.bodyMarkdown).length ? `${extractAudioEmbeds(post.bodyMarkdown).length} 段语音` : '一张照片')}</Text>
                </Pressable>
              );
            })}
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.deleteButton}><Text style={styles.deleteText}>删除这个人物</Text></Pressable>
          </>
        ) : ready ? (
          <Text style={styles.missing}>这个人物不存在或已被删除。</Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function markdownToPlainText(markdown: string): string {
  return markdown.replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/^#{1,3}\s+/gm, '').replace(/^[-*>]\s+/gm, '').replace(/[*_`]/g, '').trim();
}

function firstMediaId(markdown: string): string | null {
  return markdown.match(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/)?.[1] ?? null;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  backButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 76, height: 76, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 38, backgroundColor: colors.life },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 31 },
  name: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 38 },
  relation: { marginTop: spacing.xs, color: colors.life, fontSize: 11 },
  impression: { marginTop: spacing.md, color: colors.inkSoft, fontFamily: typography.display, fontSize: 16, lineHeight: 27 },
  profileMeta: { marginTop: spacing.lg, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet },
  profileMetaTitle: { color: colors.ink, fontSize: 12 },
  profileMetaHint: { marginTop: 5, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  emptyMeta: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 9 },
  tags: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tag: { paddingHorizontal: 11, paddingVertical: 7, borderRadius: 15, backgroundColor: colors.lifeLight },
  tagText: { color: colors.life, fontSize: 9 },
  albumEntry: { minHeight: 76, marginTop: spacing.lg, padding: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: radius.md, backgroundColor: colors.sheet },
  albumTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  albumHint: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  albumCount: { color: colors.life, fontSize: 10 },
  memorySetting: { minHeight: 58, marginTop: spacing.lg, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: radius.md, backgroundColor: colors.sheet },
  memoryIndicator: { width: 9, height: 9, borderRadius: 5, borderWidth: 1, borderColor: colors.inkFaint },
  memoryIndicatorOn: { borderColor: colors.life, backgroundColor: colors.life },
  memorySettingText: { flex: 1, marginLeft: spacing.md },
  memorySettingTitle: { color: colors.ink, fontSize: 11 },
  memorySettingHint: { marginTop: 3, color: colors.inkFaint, fontSize: 9 },
  sectionLine: { marginTop: spacing.xxl, paddingBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  sectionTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 18 },
  count: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  emptyCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 20 },
  memory: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  memoryPressed: { opacity: 0.62 },
  date: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  memoryImage: { width: '100%', height: 190, marginTop: spacing.md, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.lifeLight },
  body: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 16, lineHeight: 28 },
  missing: { marginTop: spacing.xxl, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
  deleteButton: { minHeight: 48, marginTop: spacing.xxl, alignItems: 'center', justifyContent: 'center' },
  deleteText: { color: colors.danger, fontSize: typography.size.meta },
});
