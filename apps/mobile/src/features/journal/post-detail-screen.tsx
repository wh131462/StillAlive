import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ComponentProps } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { Animated, Easing, Image, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { useVideoPlayer, type VideoThumbnail } from 'expo-video';
import { feedback } from '../../shared/feedback';
import type { Media } from '@still-alive/types';
import { colors, spacing, typography } from '@still-alive/tokens';
import MarkdownView from './markdown-view.dom';
import VoicePlayer from '../../shared/components/voice-player';
import { previewRouteParams, toSelectedPreviewFile } from '../files/file-preview.types';
import { useAppState } from '../../application/state/app-state';
import { createThemedStyles, editorTheme } from '../../shared/theme/app-theme';
import { MusicShareCard } from '../../application/components/music-share-card';
import { ReadingShareCard } from '../../application/components/reading-share-card';
import { extractMusicShares, withoutMusicShares } from '../../application/music-share';
import { readingSourceTitle, withoutReadingSourceQuote } from '../../application/reading-share';
import { ToolPageHeader, ToolPageHeaderAction } from '../../shared/components/tool-page-header';
import { MediaVideo } from '../../shared/components/media-video';
import { PostShareDialog } from './post-share-dialog';
import * as Clipboard from 'expo-clipboard';

export default function PostDetailScreen() {
  const router = useRouter();
  const window = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { deletePost, media, posts, readingNoteSources, ready } = useAppState();
  const post = useMemo(() => posts.find((item) => item.id === id), [id, posts]);
  const readingSource = useMemo(() => readingNoteSources.find((source) => source.postId === id) ?? null, [id, readingNoteSources]);
  const mediaById = useMemo(() => new Map(media.map((item) => [item.id, item])), [media]);
  const [readyPostId, setReadyPostId] = useState<string | null>(null);
  const [moreOpen, setMoreOpen] = useState(false);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ right: number; top: number }>({ right: spacing.md, top: 60 });
  const moreButtonRef = useRef<View>(null);
  const [shareContentReady, setShareContentReady] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const contentReady = Boolean(post && readyPostId === post.id);
  const centerShareContent = Boolean(post && !readingSource && extractMusicShares(post.bodyMarkdown).length === 0 && !/!\[[^\]]*\]\((?:media|audio):\/\//.test(post.bodyMarkdown) && postMarkdownToPlainText(post.bodyMarkdown).length <= 180);
  const handleContentReady = useCallback(() => {
    if (post) setReadyPostId(post.id);
  }, [post]);
  const handleShareContentReady = useCallback(() => setShareContentReady(true), []);

  const confirmDelete = () => {
    if (!post) return;
    feedback.alert('删除这条记录？', '正文、语音、人物关联和不再使用的本地媒体也会一并清理。', [
      { text: '取消', style: 'cancel' },
      {
        text: '删除',
        style: 'destructive',
        onPress: () => void deletePost(post.id).then(
          () => router.replace('/'),
          (cause: unknown) => feedback.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。'),
        ),
      },
    ]);
  };

  const editPost = () => {
    if (!post) return;
    setMoreOpen(false);
    router.push({ pathname: '/editor', params: { postId: post.id } });
  };

  const deleteCurrentPost = () => {
    setMoreOpen(false);
    confirmDelete();
  };

  const copyPost = async (includeMeta: boolean) => {
    if (!post) return;
    setMoreOpen(false);
    const music = extractMusicShares(post.bodyMarkdown).map((share) => `音乐：${share.title}${share.artist ? ` / ${share.artist}` : ''}`);
    const sources = [readingSource ? `阅读：${readingSourceTitle(readingSource)}` : null, ...music].filter((item): item is string => Boolean(item));
    const visibleBody = postMarkdownToPlainText(withoutReadingSourceQuote(withoutMusicShares(post.bodyMarkdown), readingSource));
    const body = [...sources, visibleBody].filter(Boolean).join('\n\n');
    const meta = `${post.locationName ? `${post.locationName} / ` : ''}记录于 ${formatDate(post.dayKey)} ${formatTime(post.createdAt)}`;
    try {
      await Clipboard.setStringAsync(includeMeta ? `${body}\n\n${meta}` : body);
      feedback.alert(includeMeta ? '已复制全文' : '已复制正文');
    } catch (cause) {
      feedback.alert('复制失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  const openShare = () => {
    setShareContentReady(false);
    setShareOpen(true);
  };

  const openMore = () => {
    moreButtonRef.current?.measureInWindow((x, y, width, height) => {
      setMoreMenuPosition({
        right: Math.max(spacing.md, window.width - x - width),
        top: y + height + 4,
      });
      setMoreOpen(true);
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ToolPageHeader
        onBack={() => router.back()}
        right={post ? <><ToolPageHeaderAction accessibilityLabel="分享记录长图" disabled={!contentReady} onPress={openShare}><SymbolView name={{ android: 'share', ios: 'square.and.arrow.up', web: 'share' }} size={20} tintColor={colors.life} type="hierarchical" /></ToolPageHeaderAction><View collapsable={false} ref={moreButtonRef}><ToolPageHeaderAction accessibilityLabel="更多记录操作" onPress={openMore}><SymbolView name={{ android: 'more_vert', ios: 'ellipsis', web: 'more_vert' }} size={21} tintColor={colors.inkSoft} type="hierarchical" /></ToolPageHeaderAction></View></> : undefined}
        title="记录详情"
      />

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
              readingSource={readingSource}
            />
            <Text style={styles.detailTime}>{post.locationName ? `${post.locationName} / ` : ''}记录于 {formatDate(post.dayKey)} {formatTime(post.createdAt)}</Text>
          </ScrollView>
          {!contentReady ? <View pointerEvents="none" style={styles.loadingOverlay}><DetailLoading /></View> : null}
        </View>
      ) : (
        <Text style={styles.missing}>这条记录不存在或已被删除。</Text>
      )}

      {post && shareOpen ? (
        <PostShareDialog centerContent={centerShareContent} contentReady={shareContentReady} createdAt={post.createdAt} dayKey={post.dayKey} locationName={post.locationName} onClose={() => setShareOpen(false)}>
          <PostBody markdown={post.bodyMarkdown} mediaById={mediaById} onImagePress={() => {}} onReady={handleShareContentReady} readingSource={readingSource} sharing />
        </PostShareDialog>
      ) : null}

      {moreOpen ? <><Pressable accessibilityLabel="关闭记录菜单" onPress={() => setMoreOpen(false)} style={styles.menuBackdrop} /><View accessibilityLabel="记录更多操作" accessibilityRole="menu" style={[styles.moreMenu, moreMenuPosition]}>
        <MoreMenuItem icon={{ android: 'edit', ios: 'pencil', web: 'edit' }} label="编辑记录" onPress={editPost} />
        <MoreMenuItem icon={{ android: 'content_copy', ios: 'doc.on.doc', web: 'content_copy' }} label="复制正文" onPress={() => void copyPost(false)} />
        <MoreMenuItem icon={{ android: 'copy_all', ios: 'doc.on.clipboard', web: 'copy_all' }} label="复制全文" onPress={() => void copyPost(true)} />
        <MoreMenuItem destructive icon={{ android: 'delete_outline', ios: 'trash', web: 'delete_outline' }} label="删除记录" onPress={deleteCurrentPost} />
      </View></> : null}
    </SafeAreaView>
  );
}

function MoreMenuItem({ destructive = false, icon, label, onPress }: { destructive?: boolean; icon: ComponentProps<typeof SymbolView>['name']; label: string; onPress(): void }) {
  const tint = destructive ? colors.danger : colors.ink;
  return <Pressable accessibilityRole="menuitem" onPress={onPress} style={({ pressed }) => [styles.menuItem, pressed && styles.pressed]}><SymbolView name={icon} size={18} tintColor={tint} type="hierarchical" /><Text style={[styles.menuItemText, destructive && styles.menuItemDanger]}>{label}</Text></Pressable>;
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
    <ScrollView accessibilityLabel="正在加载记录详情" accessibilityLiveRegion="polite" contentContainerStyle={styles.loadingContent} scrollEnabled={false} style={styles.loadingScroll}>
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

function PostBody({ markdown, mediaById, onImagePress, onReady, readingSource, sharing = false }: { markdown: string; mediaById: Map<string, Media>; onImagePress(item: Media): void; onReady(): void; readingSource: ReturnType<typeof useAppState>['readingNoteSources'][number] | null; sharing?: boolean }) {
  const musicShares = extractMusicShares(markdown);
  const segments = splitPostBody(withoutReadingSourceQuote(withoutMusicShares(markdown), readingSource));
  const markdownSegmentCount = segments.filter((segment) => segment.type === 'markdown' && segment.value.trim()).length;
  const shareImageSegmentCount = sharing ? segments.filter((segment) => segment.type === 'image' && mediaById.get(segment.id)).length : 0;
  const requiredReadyCount = markdownSegmentCount + shareImageSegmentCount;
  const readinessRef = useRef({ markdown, sharing, readyKeys: new Set<string>() });
  if (readinessRef.current.markdown !== markdown || readinessRef.current.sharing !== sharing) readinessRef.current = { markdown, sharing, readyKeys: new Set<string>() };

  useEffect(() => {
    if (requiredReadyCount === 0) onReady();
  }, [onReady, requiredReadyCount]);

  const markReady = (key: string) => {
    readinessRef.current.readyKeys.add(key);
    if (readinessRef.current.readyKeys.size === requiredReadyCount) onReady();
  };

  return <>{readingSource ? <View pointerEvents={sharing ? 'none' : 'auto'} style={styles.readingShare}><ReadingShareCard source={readingSource} variant="detail" /></View> : null}{musicShares.map((share, index) => <View key={`music_${share.trackId}_${index}`} pointerEvents={sharing ? 'none' : 'auto'} style={styles.musicShare}><MusicShareCard share={share} variant="detail" /></View>)}{segments.map((segment, index) => {
    if (segment.type === 'markdown') {
      if (!segment.value.trim()) return null;
      return (
        <MarkdownView
          key={`markdown_${index}`}
          dom={{ containerStyle: styles.markdownView, matchContents: true, scrollEnabled: false, style: styles.markdownView }}
          markdown={segment.value.trim()}
          media={[]}
          onReady={() => markReady(`markdown_${index}`)}
          theme={editorTheme()}
        />
      );
    }

    if (segment.type === 'audio') {
      const item = mediaById.get(segment.id);
      return item
        ? sharing
          ? <ShareAudio key={`audio_${segment.id}_${index}`} durationMs={segment.durationMs} />
          : <View key={`audio_${segment.id}_${index}`} style={styles.audioSection}><VoicePlayer durationMs={segment.durationMs} uri={item.localPath} /></View>
        : <View key={`audio_missing_${segment.id}_${index}`} style={styles.audioMissing}><Text style={styles.audioMissingText}>本地语音文件暂时无法播放</Text></View>;
    }

    const item = mediaById.get(segment.id);
    if (!item) return <ImageFallback key={`missing_${segment.id}_${index}`} />;
    return <PostMedia alt={segment.alt} item={item} key={`media_${segment.id}_${index}`} onPress={() => onImagePress(item)} onReady={sharing ? () => markReady(`image_${index}`) : undefined} sharing={sharing} />;
  })}</>;
}

function ShareAudio({ durationMs }: { durationMs: number }) {
  return <View style={styles.shareAudio}><View style={styles.shareAudioIcon}><SymbolView name={{ android: 'mic', ios: 'waveform', web: 'mic' }} size={17} tintColor={colors.life} type="hierarchical" /></View><View style={styles.shareAudioWaves}>{[7, 13, 19, 11, 22, 15, 9, 18, 12, 16, 8, 14].map((height, index) => <View key={index} style={[styles.shareAudioWave, { height }]} />)}</View><Text style={styles.shareAudioDuration}>{formatAudioDuration(durationMs)}</Text></View>;
}

function PostMedia({ alt, item, onPress, onReady, sharing = false }: { alt: string; item: Media; onPress(): void; onReady?(): void; sharing?: boolean }) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const aspectRatio = item.width && item.height ? item.width / item.height : 4 / 3;

  if (item.mimeType.startsWith('video/')) return sharing ? <ShareVideoPlaceholder aspectRatio={aspectRatio} onReady={onReady} uri={item.localPath} /> : <MediaVideo style={[styles.postImage, { aspectRatio }]} uri={item.localPath} />;

  if (failed) {
    return <ImageFallback aspectRatio={aspectRatio} onRetry={() => { setAttempt((value) => value + 1); setFailed(false); }} />;
  }

  return <Pressable accessibilityLabel={alt || '预览记录媒体'} accessibilityRole="button" onPress={onPress} style={styles.postImagePressable}>
    <Image
      key={attempt}
      accessibilityLabel={alt || '记录图片'}
      onError={() => { setFailed(true); onReady?.(); }}
      onLoad={onReady}
      resizeMode="contain"
      source={{ uri: item.localPath }}
      style={[styles.postImage, { aspectRatio }]}
    />
  </Pressable>;
}

function ShareVideoPlaceholder({ aspectRatio, onReady, uri }: { aspectRatio: number; onReady?(): void; uri: string }) {
  const [thumbnail, setThumbnail] = useState<VideoThumbnail | null>(null);
  const [failed, setFailed] = useState(false);
  const player = useVideoPlayer(uri, (currentPlayer) => { currentPlayer.muted = true; });

  useEffect(() => {
    let active = true;
    void player.generateThumbnailsAsync(0.1, { maxWidth: 1200 }).then((thumbnails) => {
      if (!active) return;
      setThumbnail(thumbnails[0] ?? null);
      onReady?.();
    }, () => {
      if (!active) return;
      setFailed(true);
      onReady?.();
    });
    return () => { active = false; };
  }, [onReady, player, uri]);

  return <View style={[styles.shareVideo, { aspectRatio }]}>{thumbnail && !failed ? <ExpoImage contentFit="cover" source={thumbnail} style={StyleSheet.absoluteFill} /> : null}<View style={styles.shareVideoShade} /><View style={styles.shareVideoIcon}><SymbolView name={{ android: 'play_arrow', ios: 'play.fill', web: 'play_arrow' }} size={21} tintColor={colors.onLife} type="hierarchical" /></View><Text style={styles.shareVideoLabel}>视频记录</Text></View>;
}

function formatAudioDuration(durationMs: number): string {
  const seconds = Math.max(0, Math.round(durationMs / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
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

function postMarkdownToPlainText(markdown: string): string {
  return markdown
    .replace(/!\[([^]]*)\]\(media:\/\/[^)]+\)/g, (_match, alt: string) => alt ? `[图片：${alt}]` : '[图片]')
    .replace(/!\[语音\]\(audio:\/\/[^)]+\)/g, '[语音]')
    .replace(/\[([^]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s*(?:[-+*]|\d+\.)\s+(?:\[[ xX]\]\s*)?/gm, '')
    .replace(/^\s*>\s?/gm, '')
    .replace(/(?:\*\*|__|~~|`)/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.sheet },
  detailContainer: { flex: 1 },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  contentHidden: { opacity: 0 },
  detailTime: { marginTop: spacing.lg, color: colors.inkFaint, fontSize: 9, textAlign: 'right' },
  markdownView: { width: '100%', alignSelf: 'stretch', backgroundColor: 'transparent' },
  musicShare: { marginBottom: spacing.lg },
  readingShare: { marginBottom: spacing.lg },
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
  menuBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 5 },
  moreMenu: { position: 'absolute', zIndex: 6, width: 188, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 8, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOpacity: 0.16, shadowRadius: 12, elevation: 8 },
  menuItem: { minHeight: 48, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.lineSoft },
  menuItemText: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  menuItemDanger: { color: colors.danger },
  shareAudio: { minHeight: 64, marginTop: spacing.md, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderTopRightRadius: 18, borderBottomLeftRadius: 18, backgroundColor: colors.lifeLight },
  shareAudioIcon: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 17, backgroundColor: colors.sheet },
  shareAudioWaves: { flex: 1, height: 26, marginHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 3 },
  shareAudioWave: { width: 2, borderRadius: 1, backgroundColor: colors.life },
  shareAudioDuration: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  shareVideo: { width: '100%', marginBottom: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: colors.codeBackground },
  shareVideoShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(10, 16, 12, 0.3)' },
  shareVideoIcon: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', paddingLeft: 2, borderRadius: 21, backgroundColor: colors.life },
  shareVideoLabel: { marginTop: spacing.sm, color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: 8, letterSpacing: 0.7 },
  pressed: { opacity: 0.62 },
}));
