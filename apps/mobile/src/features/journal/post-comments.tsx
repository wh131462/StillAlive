import { useEffect, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { Media, Post, PostComment } from '@still-alive/types';
import { colors, spacing } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { MediaThumbnail } from '../../shared/components/media-thumbnail';
import { pickMediaFromLibrary } from '../../infrastructure/platform/media-picker';
import { persistPickedImage } from '../../infrastructure/files/local-media';
import { previewRouteParams, toSelectedPreviewFile } from '../files/file-preview.types';

export function PostCommentMenu({ onComment }: { onComment(): void }) {
  return <Pressable
    accessibilityLabel="写一句评论"
    accessibilityRole="button"
    hitSlop={6}
    onPress={(event) => {
      event.stopPropagation();
      Keyboard.dismiss();
      onComment();
    }}
    style={({ pressed }) => [styles.commentTrigger, pressed && styles.commentTriggerPressed]}
  >
    <SymbolView name={{ android: 'chat_bubble_outline', ios: 'bubble.right', web: 'chat_bubble_outline' }} size={14} tintColor={colors.inkFaint} />
    <Text style={styles.commentTriggerText}>写一句</Text>
  </Pressable>;
}

export function PostCommentPreview({ post, onEdit }: { post: Post; onEdit?(comment: PostComment): void }) {
  return <PostComments post={post} onEdit={onEdit} preview />;
}

export function PostComments({ post, onEdit, preview = false }: { post: Post; onEdit?(comment: PostComment): void; preview?: boolean }) {
  const router = useRouter();
  const { media, preferences, savePostComment } = useAppState();
  const deletingRef = useRef(false);
  const author = preferences.nickname || preferences.profileName || '我';
  const comments = preview ? post.comments.slice(-3) : post.comments;
  const hasMoreComments = preview && post.comments.length > comments.length;
  if (!comments.length) return null;

  const remove = async (comment: PostComment) => {
    if (deletingRef.current) return;
    deletingRef.current = true;
    try { await savePostComment(post.id, null, comment.id); }
    catch (cause) { feedback.alert('删除评论失败', cause instanceof Error ? cause.message : '请稍后重试。'); }
    finally { deletingRef.current = false; }
  };
  const actions = (comment: PostComment) => feedback.alert('评论操作', undefined, [
    { text: '编辑', onPress: () => onEdit ? onEdit(comment) : router.push({ pathname: '/post/[id]', params: { id: post.id, commentId: comment.id } }) },
    { text: '删除', style: 'destructive', onPress: () => feedback.alert('删除这条评论？', '删除后无法恢复。', [{ text: '取消', style: 'cancel' }, { text: '删除', style: 'destructive', onPress: () => void remove(comment) }]) },
    { text: '取消', style: 'cancel' },
  ]);

  return <View style={styles.comments}>
    <View style={styles.notch} />
    {comments.map((comment, index) => {
      const images = (comment.mediaIds ?? []).map((id) => media.find((item) => item.id === id));
      const visibleImages = preview ? images.slice(0, 3) : images;
      return <Pressable accessibilityHint="长按编辑或删除评论" accessibilityLabel={`${author}的评论${comment.body ? `：${comment.body}` : '，包含图片'}`} key={comment.id} onLongPress={(event) => { event.stopPropagation(); actions(comment); }} onPress={(event) => { event.stopPropagation(); if (preview) router.push(`/post/${post.id}`); }} style={({ pressed }) => [styles.comment, index === 0 && styles.firstComment, index === comments.length - 1 && !hasMoreComments && styles.lastComment, pressed && styles.commentPressed]}>
        <Text numberOfLines={preview ? 3 : undefined} style={styles.body}><Text style={styles.author}>{author}：</Text>{comment.body}</Text>
        {images.length ? <View style={styles.images}>{visibleImages.map((item, index) => <Pressable accessibilityLabel={`查看评论图片 ${index + 1}`} accessibilityRole="button" key={comment.mediaIds![index]} onLongPress={(event) => { event.stopPropagation(); actions(comment); }} onPress={(event) => {
          event.stopPropagation();
          if (!item) { feedback.alert('图片无法打开', '本地图片文件不存在。'); return; }
          const available = images.filter((image): image is Media => Boolean(image));
          router.push({ pathname: '/file-preview', params: previewRouteParams(available.map(toSelectedPreviewFile), available.findIndex((image) => image.id === item.id)) });
        }}><MediaThumbnail item={item} style={[styles.image, images.length === 1 && styles.singleImage]} />{preview && index === 2 && images.length > 3 ? <View pointerEvents="none" style={styles.imageCount}><Text style={styles.imageCountText}>+{images.length - 3}</Text></View> : null}</Pressable>)}</View> : null}
        {!preview ? <Text style={styles.time}>{formatCommentTime(comment.createdAt)}{comment.updatedAt !== comment.createdAt ? ' · 已编辑' : ''}</Text> : null}
      </Pressable>;
    })}
    {hasMoreComments ? <Pressable accessibilityRole="button" onPress={(event) => { event.stopPropagation(); router.push(`/post/${post.id}`); }} style={styles.allComments}><Text style={styles.allCommentsText}>查看全部 {post.comments.length} 条评论</Text></Pressable> : null}
  </View>;
}

export function PostCommentComposer({ post, comment, onClose }: { post: Post; comment?: PostComment; onClose(): void }) {
  const { discardMedia, media, saveMedia, savePostComment } = useAppState();
  const [body, setBody] = useState(comment?.body ?? '');
  const [mediaIds, setMediaIds] = useState(comment?.mediaIds ?? []);
  const [assets, setAssets] = useState<ImagePickerAsset[]>([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<TextInput>(null);
  const hasContent = Boolean(body.trim() || mediaIds.length || assets.length);
  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);

  const pickImages = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await pickMediaFromLibrary({ allowsMultipleSelection: true, mediaTypes: ['images'], quality: 0.9 });
      if (!result.canceled) setAssets((current) => [...current, ...result.assets.filter((asset) => !current.some((item) => item.uri === asset.uri))]);
    } catch (cause) { feedback.alert('选择图片失败', cause instanceof Error ? cause.message : '请稍后重试。'); }
    finally { busyRef.current = false; setBusy(false); inputRef.current?.focus(); }
  };

  const send = async () => {
    if (busyRef.current || !hasContent) return;
    busyRef.current = true;
    setBusy(true);
    const imported: Media[] = [];
    try {
      for (const asset of assets) {
        const image = await persistPickedImage(asset);
        imported.push(image);
        await saveMedia(image);
      }
      await savePostComment(post.id, body, comment?.id, [...mediaIds, ...imported.map((image) => image.id)]);
      Keyboard.dismiss();
      onClose();
    } catch (cause) {
      await Promise.allSettled(imported.map(discardMedia));
      feedback.alert('发送评论失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally { busyRef.current = false; setBusy(false); }
  };

  return <View style={styles.composer}>
    <View style={styles.composerHeader}>
      <Text numberOfLines={1} style={styles.composerTitle}>{comment ? '编辑评论' : '评论'} · {post.dayKey.replaceAll('-', '.')} 的记录</Text>
      <Pressable accessibilityLabel="收起评论输入" accessibilityRole="button" disabled={busy} hitSlop={8} onPress={() => {
        const close = () => { Keyboard.dismiss(); onClose(); };
        if (hasContent && (body !== (comment?.body ?? '') || assets.length || mediaIds.join() !== (comment?.mediaIds ?? []).join())) feedback.alert('放弃未发送的评论？', undefined, [{ text: '继续编辑', style: 'cancel' }, { text: '放弃', style: 'destructive', onPress: close }]);
        else close();
      }} style={styles.close}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={15} tintColor={colors.inkSoft} /></Pressable>
    </View>
    {mediaIds.length || assets.length ? <ScrollView horizontal keyboardShouldPersistTaps="handled" contentContainerStyle={styles.selectedImages} showsHorizontalScrollIndicator={false}>
      {mediaIds.map((id) => <View key={id}><MediaThumbnail item={media.find((item) => item.id === id)} style={styles.selectedImage} /><RemoveImage disabled={busy} onPress={() => setMediaIds((current) => current.filter((value) => value !== id))} /></View>)}
      {assets.map((asset) => <View key={asset.uri}><Image source={{ uri: asset.uri }} style={styles.selectedImage} /><RemoveImage disabled={busy} onPress={() => setAssets((current) => current.filter((item) => item.uri !== asset.uri))} /></View>)}
    </ScrollView> : null}
    <View style={styles.inputRow}>
      <TextInput accessibilityLabel="评论内容" editable={!busy} multiline onChangeText={setBody} placeholder="写评论…" placeholderTextColor={colors.inkFaint} ref={inputRef} style={styles.input} textAlignVertical="top" value={body} />
      <Pressable accessibilityLabel="插入评论图片" accessibilityRole="button" disabled={busy} onPress={() => void pickImages()} style={styles.photoButton}><SymbolView name={{ android: 'image', ios: 'photo', web: 'image' }} size={24} tintColor={colors.inkSoft} /></Pressable>
      <Pressable accessibilityRole="button" disabled={busy || !hasContent} onPress={() => void send()} style={[styles.send, (busy || !hasContent) && styles.disabled]}><Text style={styles.sendText}>{busy ? '处理中' : comment ? '保存' : '发送'}</Text></Pressable>
    </View>
  </View>;
}

function RemoveImage({ disabled, onPress }: { disabled: boolean; onPress(): void }) {
  return <Pressable accessibilityLabel="移除待发送图片" accessibilityRole="button" disabled={disabled} hitSlop={8} onPress={onPress} style={styles.removeImage}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={11} tintColor={colors.onLife} /></Pressable>;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => StyleSheet.create({
  commentTrigger: { minHeight: 44, paddingHorizontal: 6, flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 16 },
  commentTriggerPressed: { backgroundColor: colors.lineSoft, opacity: 0.72 },
  commentTriggerText: { color: colors.inkFaint, fontSize: 10, fontWeight: '500', letterSpacing: 0.2 },
  comments: { marginTop: 10, borderRadius: 4, backgroundColor: colors.paper, paddingHorizontal: 10 },
  notch: { position: 'absolute', top: -5, left: 14, width: 10, height: 10, backgroundColor: colors.paper, transform: [{ rotate: '45deg' }] },
  comment: { paddingVertical: 4, paddingHorizontal: 10, marginHorizontal: -10 },
  firstComment: { paddingTop: 9, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  lastComment: { paddingBottom: 9, borderBottomLeftRadius: 4, borderBottomRightRadius: 4 },
  commentPressed: { backgroundColor: 'rgba(128, 128, 128, 0.16)' },
  body: { color: colors.ink, fontSize: 13, lineHeight: 21 },
  author: { color: colors.lifeDeep, fontWeight: '600' },
  time: { marginTop: 4, color: colors.inkFaint, fontSize: 10, lineHeight: 16 },
  images: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 5, marginBottom: 2 },
  image: { width: 64, height: 64, borderRadius: 3 },
  singleImage: { width: 116, height: 88 },
  imageCount: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, borderRadius: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.overlay },
  imageCountText: { color: colors.onLife, fontSize: 17, fontWeight: '600' },
  allComments: { paddingTop: 8, paddingBottom: 13 },
  allCommentsText: { color: colors.lifeDeep, fontSize: 12 },
  composer: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line, backgroundColor: colors.paper, paddingHorizontal: spacing.md, paddingTop: 6, paddingBottom: 10 },
  composerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  composerTitle: { flex: 1, color: colors.inkSoft, fontSize: 11 },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 42, maxHeight: 120, borderRadius: 5, backgroundColor: colors.sheet, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10, color: colors.ink, fontSize: 14, lineHeight: 22 },
  photoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  send: { height: 44, marginBottom: 2, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 5, backgroundColor: colors.life },
  sendText: { color: colors.onLife, fontSize: 13, fontWeight: '600' },
  disabled: { opacity: 0.4 },
  selectedImages: { gap: 10, paddingTop: 6, paddingBottom: 10, paddingRight: 8 },
  selectedImage: { width: 60, height: 60, borderRadius: 4 },
  removeImage: { position: 'absolute', top: -4, right: -4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.inkSoft, alignItems: 'center', justifyContent: 'center' },
}));
