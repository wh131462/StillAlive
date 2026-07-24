import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '@still-alive/tokens';
import MarkdownView from '../../src/components/markdown-view.dom';
import { useAppState } from '../../src/state/app-state';

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deletePost, getPersonIdsByPost, media, people, posts, ready } = useAppState();
  const [personIds, setPersonIds] = useState<string[]>([]);
  const post = useMemo(() => posts.find((item) => item.id === id), [id, posts]);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const relatedPeople = people.filter((person) => personIds.includes(person.id));

  useEffect(() => {
    if (id && post) void getPersonIdsByPost(id).then(setPersonIds);
  }, [getPersonIdsByPost, id, post]);

  const confirmDelete = () => {
    if (!post) return;
    Alert.alert('删除这篇日记？', '正文和人物关联会被删除，不再使用的本地图片也会一并清理。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => void deletePost(post.id).then(
          () => router.replace('/time'),
          (cause: unknown) => Alert.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。'),
        ),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><Text style={styles.backText}>← 返回</Text></Pressable>
        {post ? (
          <View style={styles.actions}>
            <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/editor', params: { postId: post.id } })} style={styles.headerButton}><Text style={styles.editText}>编辑</Text></Pressable>
            <Pressable accessibilityRole="button" onPress={confirmDelete} style={styles.headerButton}><Text style={styles.deleteText}>删除</Text></Pressable>
          </View>
        ) : null}
      </View>

      {post ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>A DAY I KEPT</Text>
          <Text style={styles.date}>{formatDate(post.dayKey)}</Text>
          <Text style={styles.time}>{formatTime(post.createdAt)} 留下{post.updatedAt !== post.createdAt ? ' · 后来修改过' : ''}</Text>
          <View style={styles.rule} />
          <View style={styles.markdown}>
            <MarkdownView
              dom={{ allowFileAccess: true, matchContents: true, scrollEnabled: false, style: styles.markdownView }}
              markdown={post.bodyMarkdown}
              media={[...mediaById].map(([mediaId, item]) => ({ id: mediaId, uri: item.localPath }))}
            />
          </View>

          {relatedPeople.length ? (
            <View style={styles.peopleSection}>
              <Text style={styles.peopleLabel}>这段记忆里的人</Text>
              <View style={styles.peopleRow}>
                {relatedPeople.map((person) => (
                  <Pressable key={person.id} accessibilityRole="button" onPress={() => router.push(`/person/${person.id}`)} style={styles.personChip}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text></View>
                    <Text style={styles.personName}>{person.name}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : ready ? (
        <Text style={styles.missing}>这篇日记不存在或已被删除。</Text>
      ) : null}
    </SafeAreaView>
  );
}

function formatDate(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.sheet },
  header: { minHeight: 54, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { minWidth: 52, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.inkSoft, fontSize: 11 },
  actions: { flexDirection: 'row' },
  editText: { color: colors.life, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  deleteText: { color: '#9B493F', textAlign: 'right', fontSize: 11 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { marginTop: spacing.md, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 },
  date: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 34 },
  time: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 9 },
  rule: { width: 42, height: 2, marginTop: spacing.xl, backgroundColor: colors.sun },
  markdown: { marginTop: spacing.xl },
  markdownView: { width: '100%', backgroundColor: 'transparent' },
  peopleSection: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  peopleLabel: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  peopleRow: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  personChip: { minHeight: 44, paddingRight: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: 22, backgroundColor: colors.paper },
  avatar: { width: 34, height: 34, marginLeft: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.life },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 13 },
  personName: { marginLeft: spacing.sm, color: colors.ink, fontSize: 11 },
  missing: { margin: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
});
