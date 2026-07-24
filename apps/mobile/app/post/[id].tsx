import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Media } from '@still-alive/types';
import { colors, spacing, typography } from '@still-alive/tokens';
import MarkdownView from '../../src/components/markdown-view.dom';
import { previewRouteParams, toSelectedPreviewFile } from '../../src/components/file-preview.types';
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
        <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}>
          <SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" />
        </Pressable>
        {post ? (
          <View style={styles.actions}>
            <Pressable accessibilityLabel="编辑日记" accessibilityRole="button" onPress={() => router.push({ pathname: '/editor', params: { postId: post.id } })} style={styles.headerButton}>
              <SymbolView name={{ android: 'edit', ios: 'pencil', web: 'edit' }} size={20} tintColor={colors.life} type="hierarchical" />
            </Pressable>
            <Pressable accessibilityLabel="删除日记" accessibilityRole="button" onPress={confirmDelete} style={styles.headerButton}>
              <SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={20} tintColor="#9B493F" type="hierarchical" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {!ready ? (
        <DetailLoading />
      ) : post ? (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.eyebrow}>A DAY I KEPT</Text>
          <Text style={styles.date}>{formatDate(post.dayKey)}</Text>
          <Text style={styles.time}>{formatTime(post.createdAt)} 留下{post.updatedAt !== post.createdAt ? ' 后来修改过' : ''}</Text>
          <View style={styles.rule} />
          <View style={styles.markdown}>
            <PostBody
              markdown={post.bodyMarkdown}
              mediaById={mediaById}
              onImagePress={(item) => router.push({ pathname: '/file-preview', params: previewRouteParams(extractMediaItems(post.bodyMarkdown, mediaById).map(toSelectedPreviewFile), extractMediaItems(post.bodyMarkdown, mediaById).findIndex((candidate) => candidate.id === item.id)) })}
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
      ) : (
        <Text style={styles.missing}>这篇日记不存在或已被删除。</Text>
      )}
    </SafeAreaView>
  );
}

function DetailLoading() {
  const opacity = useRef(new Animated.Value(0.38)).current;

  useEffect(() => {
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(opacity, { duration: 850, easing: Easing.inOut(Easing.ease), toValue: 0.82, useNativeDriver: true }),
      Animated.timing(opacity, { duration: 850, easing: Easing.inOut(Easing.ease), toValue: 0.38, useNativeDriver: true }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [opacity]);

  return (
    <ScrollView accessibilityLabel="正在加载日记详情" accessibilityLiveRegion="polite" contentContainerStyle={styles.loadingContent} scrollEnabled={false}>
      <Animated.View style={{ opacity }}>
        <View style={[styles.skeleton, styles.skeletonEyebrow]} />
        <View style={[styles.skeleton, styles.skeletonDate]} />
        <View style={[styles.skeleton, styles.skeletonTime]} />
        <View style={styles.loadingRule} />
        <View style={[styles.skeleton, styles.skeletonLineLong]} />
        <View style={[styles.skeleton, styles.skeletonLineFull]} />
        <View style={[styles.skeleton, styles.skeletonLineMedium]} />
        <View style={[styles.skeleton, styles.skeletonLineShort]} />
      </Animated.View>
      <Text style={styles.loadingText}>正在打开这段记忆…</Text>
    </ScrollView>
  );
}

function PostBody({ markdown, mediaById, onImagePress }: { markdown: string; mediaById: Map<string, Media>; onImagePress(item: Media): void }) {
  return splitPostBody(markdown).map((segment, index) => {
    if (segment.type === 'markdown') {
      if (!segment.value.trim()) return null;
      return (
        <MarkdownView
          key={`markdown_${index}`}
          dom={{ matchContents: true, scrollEnabled: false, style: styles.markdownView }}
          markdown={segment.value.trim()}
          media={[]}
        />
      );
    }

    const item = mediaById.get(segment.id);
    if (!item) return <ImageFallback key={`missing_${segment.id}_${index}`} />;
    return <PostImage alt={segment.alt} item={item} key={`image_${segment.id}_${index}`} onPress={() => onImagePress(item)} />;
  });
}

function PostImage({ alt, item, onPress }: { alt: string; item: Media; onPress(): void }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const aspectRatio = item.width && item.height ? Math.min(1.8, Math.max(0.8, item.width / item.height)) : 4 / 3;

  if (failed) {
    return <ImageFallback aspectRatio={aspectRatio} onRetry={() => { setAttempt((value) => value + 1); setFailed(false); }} />;
  }

  return <Pressable accessibilityLabel={alt || '预览日记图片'} accessibilityRole="button" onPress={onPress}>
    <Image
      key={attempt}
      accessibilityLabel={alt || '日记图片'}
      onError={() => setFailed(true)}
      resizeMode="cover"
      source={{ uri: item.localPath }}
      style={[styles.postImage, { aspectRatio }]}
    />
  </Pressable>;
}

function ImageFallback({ aspectRatio = 4 / 3, onRetry }: { aspectRatio?: number; onRetry?(): void }) {
  return (
    <Pressable
      accessibilityLabel={onRetry ? '图片加载失败，轻触重试' : '图片暂时无法显示'}
      accessibilityRole={onRetry ? 'button' : undefined}
      disabled={!onRetry}
      onPress={onRetry}
      style={[styles.imageFallback, { aspectRatio }]}
    >
      <SymbolView name={{ android: 'broken_image', ios: 'photo.badge.exclamationmark', web: 'broken_image' }} pointerEvents="none" size={28} tintColor={colors.inkFaint} type="hierarchical" />
      <Text style={styles.imageFallbackTitle}>图片暂时无法显示</Text>
      <Text style={styles.imageFallbackHint}>{onRetry ? '轻触重试' : '本地图片记录已丢失'}</Text>
    </Pressable>
  );
}

type PostBodySegment =
  | { type: 'markdown'; value: string }
  | { type: 'image'; id: string; alt: string };

function splitPostBody(markdown: string): PostBodySegment[] {
  const segments: PostBodySegment[] = [];
  const pattern = /!\[([^\]]*)\]\(media:\/\/([^)]+)\)/g;
  let offset = 0;
  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) segments.push({ type: 'markdown', value: markdown.slice(offset, index) });
    segments.push({ type: 'image', alt: match[1], id: match[2] });
    offset = index + match[0].length;
  }
  if (offset < markdown.length) segments.push({ type: 'markdown', value: markdown.slice(offset) });
  return segments;
}

function extractMediaItems(markdown: string, mediaById: Map<string, Media>): Media[] {
  const ids = [...new Set([...markdown.matchAll(/!\[[^\]]*\]\(media:\/\/([^)]+)\)/g)].map((match) => match[1]))];
  return ids.map((id) => mediaById.get(id)).filter((item): item is Media => Boolean(item));
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
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { marginTop: spacing.md, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 },
  date: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 34 },
  time: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 9 },
  rule: { width: 42, height: 2, marginTop: spacing.xl, backgroundColor: colors.sun },
  markdown: { marginTop: spacing.xl },
  markdownView: { width: '100%', backgroundColor: 'transparent' },
  postImage: { width: '100%', marginBottom: spacing.lg, borderTopRightRadius: 22, borderBottomLeftRadius: 22, backgroundColor: colors.lifeLight },
  imageFallback: { width: '100%', marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderTopRightRadius: 22, borderBottomLeftRadius: 22, backgroundColor: colors.paper },
  imageFallbackTitle: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 },
  imageFallbackHint: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  peopleSection: { marginTop: spacing.xxl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  peopleLabel: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.1 },
  peopleRow: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  personChip: { minHeight: 44, paddingRight: spacing.md, flexDirection: 'row', alignItems: 'center', borderRadius: 22, backgroundColor: colors.paper },
  avatar: { width: 34, height: 34, marginLeft: 5, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.life },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 13 },
  personName: { marginLeft: spacing.sm, color: colors.ink, fontSize: 11 },
  loadingContent: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  skeleton: { borderRadius: 5, backgroundColor: colors.lifeLight },
  skeletonEyebrow: { width: 88, height: 8, marginTop: spacing.md },
  skeletonDate: { width: '68%', height: 35, marginTop: spacing.md, borderRadius: 8 },
  skeletonTime: { width: 126, height: 8, marginTop: spacing.md },
  loadingRule: { width: 42, height: 2, marginTop: spacing.xl, backgroundColor: colors.sunLight },
  skeletonLineLong: { width: '86%', height: 18, marginTop: spacing.xl },
  skeletonLineFull: { width: '100%', height: 18, marginTop: spacing.md },
  skeletonLineMedium: { width: '74%', height: 18, marginTop: spacing.md },
  skeletonLineShort: { width: '48%', height: 18, marginTop: spacing.md },
  loadingText: { marginTop: spacing.xl, color: colors.inkFaint, fontFamily: typography.display, fontSize: 12 },
  missing: { margin: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
});
