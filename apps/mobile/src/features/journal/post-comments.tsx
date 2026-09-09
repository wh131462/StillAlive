import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Post, PostComment } from '@still-alive/types';
import { colors, spacing } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { feedback } from '../../shared/feedback';
import { createThemedStyles } from '../../shared/theme/app-theme';

export function PostCommentPreview({ post }: { post: Post }) {
  const latest = post.comments[post.comments.length - 1];
  if (!latest) return null;
  return <View style={styles.preview}><Text style={styles.count}>{post.comments.length} 条评论</Text><Text numberOfLines={2} style={styles.previewBody}>{latest.body}</Text></View>;
}

export function PostComments({ post }: { post: Post }) {
  const { savePostComment } = useAppState();
  const [body, setBody] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [saving, setSaving] = useState(false);
  const busyRef = useRef(false);
  const inputRef = useRef<TextInput>(null);

  const save = async (value: string | null, commentId?: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    try {
      await savePostComment(post.id, value, commentId);
      if (value !== null || commentId === editingId) {
        setBody('');
        setEditingId(undefined);
      }
    } catch (cause) {
      feedback.alert(value === null ? '删除评论失败' : '保存评论失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      busyRef.current = false;
      setSaving(false);
    }
  };

  const edit = (comment: PostComment) => {
    if (editingId === comment.id) {
      inputRef.current?.focus();
      return;
    }
    const begin = () => {
      setEditingId(comment.id);
      setBody(comment.body);
      inputRef.current?.focus();
    };
    if (body.trim() && editingId !== comment.id) {
      feedback.alert('放弃当前未保存的评论？', undefined, [{ text: '取消', style: 'cancel' }, { text: '放弃', style: 'destructive', onPress: begin }]);
    } else begin();
  };

  const remove = (comment: PostComment) => feedback.alert('删除这条评论？', '删除后无法恢复。', [
    { text: '取消', style: 'cancel' },
    { text: '删除', style: 'destructive', onPress: () => void save(null, comment.id) },
  ]);

  return <View style={styles.section}>
    <Text style={styles.title}>评论{post.comments.length ? ` / ${post.comments.length}` : ''}</Text>
    {post.comments.length ? post.comments.map((comment) => <View key={comment.id} style={styles.comment}>
      <Text selectable style={styles.body}>{comment.body}</Text>
      <View style={styles.metaRow}>
        <Text style={styles.time}>{formatCommentTime(comment.createdAt)}{comment.updatedAt !== comment.createdAt ? ' / 已编辑' : ''}</Text>
        <Pressable accessibilityLabel="编辑评论" accessibilityRole="button" disabled={saving} onPress={() => edit(comment)} style={styles.action}><Text style={styles.actionText}>编辑</Text></Pressable>
        <Pressable accessibilityLabel="删除评论" accessibilityRole="button" disabled={saving} onPress={() => remove(comment)} style={styles.action}><Text style={styles.deleteText}>删除</Text></Pressable>
      </View>
    </View>) : <Text style={styles.empty}>用评论补充这条记录的后续。</Text>}
    <View style={styles.composer}>
      <TextInput accessibilityLabel={editingId ? '编辑评论内容' : '补充评论内容'} editable={!saving} multiline onChangeText={setBody} placeholder={editingId ? '编辑评论…' : '补充一点后续…'} placeholderTextColor={colors.inkFaint} ref={inputRef} style={styles.input} textAlignVertical="top" value={body} />
      <View style={styles.composerActions}>
        {editingId ? <Pressable accessibilityRole="button" disabled={saving} onPress={() => { setBody(''); setEditingId(undefined); }} style={styles.action}><Text style={styles.actionText}>取消编辑</Text></Pressable> : null}
        <Pressable accessibilityRole="button" disabled={saving || !body.trim()} onPress={() => void save(body, editingId)} style={[styles.submit, (saving || !body.trim()) && styles.disabled]}><Text style={styles.submitText}>{saving ? '保存中…' : editingId ? '保存修改' : '添加评论'}</Text></Pressable>
      </View>
    </View>
  </View>;
}

function formatCommentTime(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => StyleSheet.create({
  preview: { marginTop: spacing.sm, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.lifeLine, gap: 4 },
  count: { color: colors.life, fontSize: 11 },
  previewBody: { color: colors.inkSoft, fontSize: 12, lineHeight: 19 },
  section: { marginTop: spacing.xl, paddingTop: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  title: { color: colors.ink, fontSize: 15, fontWeight: '600', marginBottom: spacing.md },
  comment: { paddingVertical: spacing.sm, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  body: { color: colors.ink, fontSize: 14, lineHeight: 23 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  time: { flex: 1, color: colors.inkFaint, fontSize: 10 },
  action: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.sm },
  actionText: { color: colors.inkSoft, fontSize: 12 },
  deleteText: { color: colors.danger, fontSize: 12 },
  empty: { color: colors.inkFaint, fontSize: 12, lineHeight: 20 },
  composer: { marginTop: spacing.md, borderRadius: 12, backgroundColor: colors.paper, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.sm },
  input: { minHeight: 88, maxHeight: 220, padding: spacing.sm, color: colors.ink, fontSize: 14, lineHeight: 22 },
  composerActions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm },
  submit: { minHeight: 44, justifyContent: 'center', borderRadius: 8, paddingHorizontal: spacing.md, backgroundColor: colors.life },
  submitText: { color: colors.onLife, fontSize: 12, fontWeight: '600' },
  disabled: { opacity: 0.45 },
}));
