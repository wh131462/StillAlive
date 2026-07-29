import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Alert, Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Media } from '@still-alive/types';
import { colors, spacing, typography } from '@still-alive/tokens';
import MarkdownView from '../../src/components/markdown-view.dom';
import VoicePlayer from '../../src/components/voice-player';
import { previewRouteParams, toSelectedPreviewFile } from '../../src/components/file-preview.types';
import { useAppState } from '../../src/state/app-state';
import { createThemedStyles, editorTheme } from '../../src/theme/app-theme';

export default function PostDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deletePost, media, posts, ready } = useAppState();
  const post = useMemo(() => posts.find((item) => item.id === id), [id, posts]);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const [readyPostId, setReadyPostId] = useState<string | null>(null);
  const contentReady = Boolean(post && readyPostId === post.id);
  const handleContentReady = useCallback(() => {
    if (post) setReadyPostId(post.id);
  }, [post]);

  const confirmDelete = () => {
    if (!post) return;
    Alert.alert('删除这篇日记？', '正文、语音、人物关联和不再使用的本地媒体也会一并清理。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => void deletePost(post.id).then(
          () => router.replace('/'),
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
              <SymbolView name={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} size={20} tintColor={colors.danger} type="hierarchical" />
            </Pressable>
          </View>
        ) : null}
      </View>

      {!ready ? (
        <DetailLoading />
      ) : post ? (
        <View style={styles.detailContainer}>
          <ScrollView contentContainerStyle={styles.content} pointerEvents={contentReady ? 'auto' : 'none'} showsVerticalScrollIndicator={false} style={!contentReady && styles.contentHidden}>
            <PostBody
              markdown={post.bodyMarkdown}
              mediaById={mediaById}
              onImagePress={(item) => router.push({ pathname: '/file-preview', params: previewRouteParams(extractMediaItems(post.bodyMarkdown, mediaById).map(toSelectedPreviewFile), extractMediaItems(post.bodyMarkdown, mediaById).findIndex((candidate) => candidate.id === item.id)) })}
              onReady={handleContentReady}
            />
            <Text style={styles.detailTime}>记录于 {formatDate(post.dayKey)} {formatTime(post.createdAt)}</Text>
          </ScrollView>
          {!contentReady ? <View pointerEvents="none" style={styles.loadingOverlay}><DetailLoading /></View> : null}
        </View>
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
    <ScrollView accessibilityLabel="正在加载日记详情" accessibilityLiveRegion="polite" contentContainerStyle={styles.loadingContent} scrollEnabled={false} style={styles.loadingScroll}>
      <Animated.View style={{ opacity }}>
        <View style={[styles.skeleton, styles.skeletonLineLong]} />
        <View style={[styles.skeleton, styles.skeletonLineFull]} />
        <View style={[styles.skeleton, styles.skeletonLineMedium]} />
        <View style={[styles.skeleton, styles.skeletonLineShort]} />
        <View style={[styles.skeleton, styles.skeletonTime]} />
      </Animated.View>
    </ScrollView>
  );
}

function PostBody({ markdown, mediaById, onImagePress, onReady }: { markdown: string; mediaById: Map<string, Media>; onImagePress(item: Media): void; onReady(): void }) {
  const segments = splitPostBody(markdown);
  const markdownSegmentCount = segments.filter((segment) => segment.type === 'markdown' && segment.value.trim()).length;
  const readinessRef = useRef({ markdown, readyIndexes: new Set<number>() });
  if (readinessRef.current.markdown !== markdown) readinessRef.current = { markdown, readyIndexes: new Set<number>() };

  useEffect(() => {
    if (markdownSegmentCount === 0) onReady();
  }, [markdownSegmentCount, onReady]);

  const markMarkdownReady = (index: number) => {
    readinessRef.current.readyIndexes.add(index);
    if (readinessRef.current.readyIndexes.size === markdownSegmentCount) onReady();
  };

  return segments.map((segment, index) => {
    if (segment.type === 'markdown') {
      if (!segment.value.trim()) return null;
      return (
        <MarkdownView
          key={`markdown_${index}`}
          dom={{ containerStyle: styles.markdownView, matchContents: true, scrollEnabled: false, style: styles.markdownView }}
          markdown={segment.value.trim()}
          media={[]}
          onReady={() => markMarkdownReady(index)}
          theme={editorTheme()}
        />
      );
    }

    if (segment.type === 'audio') {
      const item = mediaById.get(segment.id);
      return item
        ? <View key={`audio_${segment.id}_${index}`} style={styles.audioSection}><VoicePlayer durationMs={segment.durationMs} uri={item.localPath} /></View>
        : <View key={`audio_missing_${segment.id}_${index}`} style={styles.audioMissing}><Text style={styles.audioMissingText}>本地语音文件暂时无法播放</Text></View>;
    }

    const item = mediaById.get(segment.id);
    if (!item) return <ImageFallback key={`missing_${segment.id}_${index}`} />;
    return <PostImage alt={segment.alt} item={item} key={`image_${segment.id}_${index}`} onPress={() => onImagePress(item)} />;
  });
}

function PostImage({ alt, item, onPress }: { alt: string; item: Media; onPress(): void }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const aspectRatio = item.width && item.height ? item.width / item.height : 4 / 3;

  if (failed) {
    return <ImageFallback aspectRatio={aspectRatio} onRetry={() => { setAttempt((value) => value + 1); setFailed(false); }} />;
  }

  return <Pressable accessibilityLabel={alt || '预览日记图片'} accessibilityRole="button" onPress={onPress} style={styles.postImagePressable}>
    <Image
      key={attempt}
      accessibilityLabel={alt || '日记图片'}
      onError={() => setFailed(true)}
      resizeMode="contain"
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
  | { type: 'image'; id: string; alt: string }
  | { type: 'audio'; id: string; durationMs: number };

function splitPostBody(markdown: string): PostBodySegment[] {
  const segments: PostBodySegment[] = [];
  const pattern = /!\[([^\]]*)\]\(media:\/\/([^)]+)\)|!\[语音\]\(audio:\/\/([^)?]+)(?:\?duration=(\d+))?\)/g;
  let offset = 0;
  for (const match of markdown.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > offset) segments.push({ type: 'markdown', value: markdown.slice(offset, index) });
    if (match[3]) segments.push({ type: 'audio', durationMs: Number(match[4] ?? 0), id: match[3] });
    else segments.push({ type: 'image', alt: match[1], id: match[2] });
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

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.sheet },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  actions: { flexDirection: 'row' },
  detailContainer: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  contentHidden: { opacity: 0 },
  detailTime: { marginTop: spacing.lg, color: colors.inkFaint, fontSize: 9, textAlign: 'right' },
  markdownView: { width: '100%', alignSelf: 'stretch', backgroundColor: 'transparent' },
  audioSection: { marginTop: spacing.md },
  audioMissing: { minHeight: 64, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderTopRightRadius: 18, borderBottomLeftRadius: 18, backgroundColor: colors.paper },
  audioMissingText: { color: colors.inkFaint, fontSize: 10 },
  postImagePressable: { width: '100%' },
  postImage: { width: '100%', marginBottom: spacing.lg, borderRadius: 4, backgroundColor: colors.lifeLight },
  imageFallback: { width: '100%', marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 4, backgroundColor: colors.paper },
  imageFallbackTitle: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 },
  imageFallbackHint: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  loadingOverlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.sheet },
  loadingScroll: { flex: 1 },
  loadingContent: { flexGrow: 1, padding: spacing.lg, paddingBottom: spacing.xxl },
  skeleton: { borderRadius: 5, backgroundColor: colors.lifeLight },
  skeletonLineLong: { width: '86%', height: 18, marginTop: spacing.md },
  skeletonLineFull: { width: '100%', height: 18, marginTop: spacing.md },
  skeletonLineMedium: { width: '74%', height: 18, marginTop: spacing.md },
  skeletonLineShort: { width: '48%', height: 18, marginTop: spacing.md },
  skeletonTime: { width: 126, height: 8, marginTop: spacing.lg, marginLeft: 'auto' },
  missing: { margin: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
}));
