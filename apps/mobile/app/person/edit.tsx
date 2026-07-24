import { useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import type { ImagePickerAsset } from 'expo-image-picker';
import { Alert, Image, KeyboardAvoidingView, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';
import { persistPickedImage } from '../../src/data/local-media';
import type { Media } from '@still-alive/types';

export default function EditPersonScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { discardMedia, media, people, saveMedia, updatePerson } = useAppState();
  const person = useMemo(() => people.find((item) => item.id === id), [id, people]);
  const currentAvatar = person?.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
  const [name, setName] = useState(person?.name ?? '');
  const [relation, setRelation] = useState(person?.relationToMe ?? '');
  const [impression, setImpression] = useState(person?.impression ?? '');
  const [pickedAsset, setPickedAsset] = useState<ImagePickerAsset | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const avatarUri = pickedAsset?.uri ?? (!removeAvatar ? currentAvatar?.localPath : null);

  const chooseAvatar = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('无法访问照片', '请在系统设置中允许“仍在”访问照片。');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: true, aspect: [1, 1], mediaTypes: ['images'], quality: 0.9 });
    if (result.canceled) return;
    setPickedAsset(result.assets[0]);
    setRemoveAvatar(false);
  };

  const handleSave = async () => {
    if (!person || !name.trim()) {
      Alert.alert('请填写名字');
      return;
    }
    let importedMedia: Media | null = null;
    try {
      setSaving(true);
      let avatarMediaId = removeAvatar ? null : person.avatarMediaId;
      if (pickedAsset) {
        const item = await persistPickedImage(pickedAsset);
        importedMedia = item;
        await saveMedia(item);
        avatarMediaId = item.id;
      }
      await updatePerson(person.id, {
        name: name.trim(),
        avatarMediaId,
        relationToMe: relation.trim() || null,
        impression: impression.trim() || null,
      });
      router.back();
    } catch (cause: unknown) {
      if (importedMedia) {
        await discardMedia(importedMedia);
      }
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  if (!person) return <SafeAreaView style={styles.safeArea}><Text style={styles.missing}>这个人物不存在或已被删除。</Text></SafeAreaView>;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><Text style={styles.backText}>取消</Text></Pressable>
          <Text style={styles.headerTitle}>人物资料</Text>
          <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleSave()} style={styles.headerButton}><Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text></Pressable>
        </View>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Pressable accessibilityRole="button" onPress={() => void chooseAvatar()} style={styles.avatarButton}>
            <View style={styles.avatar}>{avatarUri ? <Image accessibilityLabel="人物头像预览" resizeMode="cover" source={{ uri: avatarUri }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{name.trim().slice(0, 1) || '人'}</Text>}</View>
            <Text style={styles.avatarAction}>{avatarUri ? '更换照片' : '添加照片'}</Text>
          </Pressable>
          {avatarUri ? <Pressable accessibilityRole="button" onPress={() => { setPickedAsset(null); setRemoveAvatar(true); }} style={styles.removeAvatar}><Text style={styles.removeAvatarText}>移除头像</Text></Pressable> : null}

          <Field label="名字 · 必填" maxLength={40} onChangeText={setName} placeholder="例如：小满" value={name} />
          <Field label="与我的关系" maxLength={40} onChangeText={setRelation} placeholder="例如：朋友、妈妈、同事" value={relation} />
          <Field label="一句话印象" maxLength={100} multiline onChangeText={setImpression} placeholder="不必完整，写下此刻最自然的一句话。" value={impression} />
          <Text style={styles.note}>资料只用于整理你的本地记忆，不会上传。</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput {...props} placeholderTextColor={colors.inkFaint} style={[styles.input, props.multiline && styles.inputMultiline]} textAlignVertical={props.multiline ? 'top' : 'center'} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 64, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.inkSoft, fontSize: 11 },
  saveText: { color: colors.life, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  avatarButton: { alignItems: 'center' },
  avatar: { width: 94, height: 94, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 47, backgroundColor: colors.life },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 36 },
  avatarAction: { marginTop: spacing.sm, color: colors.life, fontSize: 10, fontWeight: '700' },
  removeAvatar: { minHeight: 36, alignItems: 'center', justifyContent: 'center' },
  removeAvatarText: { color: '#9B493F', fontSize: 9 },
  field: { marginTop: spacing.lg },
  fieldLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 15 },
  inputMultiline: { minHeight: 112, paddingTop: spacing.md, lineHeight: 23 },
  note: { marginTop: spacing.xl, color: colors.inkFaint, fontSize: 9, lineHeight: 17, textAlign: 'center' },
  missing: { margin: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
});
