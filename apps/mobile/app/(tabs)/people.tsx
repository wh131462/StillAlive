import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Image, Modal, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../src/state/app-state';

export default function PeopleScreen() {
  const router = useRouter();
  const { createPerson, media, people } = useAppState();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const handleCreate = async () => {
    const value = name.trim();
    if (!value) return;
    try {
      const person = await createPerson(value);
      setName('');
      setCreating(false);
      router.push(`/person/${person.id}`);
    } catch (cause: unknown) {
      Alert.alert('创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.topLine}>
          <Text style={styles.label}>PEOPLE IN MY DAYS</Text>
          <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.addButton}>
            <Text style={styles.addButtonText}>＋ 添加</Text>
          </Pressable>
        </View>
        <Text style={styles.title}>有些日子，{`\n`}因为有人而记得。</Text>
        <Text style={styles.description}>人物从共同经历里自然长出来，不需要先建立一份完整档案。</Text>

        {people.length === 0 ? (
          <Pressable accessibilityRole="button" onPress={() => setCreating(true)} style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>还没有人物</Text>
            <Text style={styles.emptyText}>写日记时使用 @人物，或在这里先记下一个名字。</Text>
            <Text style={styles.emptyAction}>添加第一个人物 →</Text>
          </Pressable>
        ) : (
          <View style={styles.list}>
            {people.map((person) => {
              const avatar = person.avatarMediaId ? media.find((item) => item.id === person.avatarMediaId) : null;
              return <Pressable key={person.id} accessibilityRole="button" onPress={() => router.push(`/person/${person.id}`)} style={({ pressed }) => [styles.personRow, pressed && styles.personRowPressed]}>
                <View style={styles.avatar}>{avatar ? <Image accessibilityLabel={`${person.name}的头像`} resizeMode="cover" source={{ uri: avatar.localPath }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{person.name.slice(0, 1)}</Text>}</View>
                <View style={styles.personInfo}>
                  <Text style={styles.personName}>{person.name}</Text>
                  <Text style={styles.personMeta}>{person.relationToMe ?? '关系会在往后的记录里慢慢清晰'}</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>;
            })}
          </View>
        )}
      </ScrollView>

      <Modal animationType="slide" onRequestClose={() => setCreating(false)} transparent visible={creating}>
        <Pressable style={styles.backdrop} onPress={() => setCreating(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.sheetTitle}>先记下一个名字</Text>
            <Text style={styles.sheetHint}>其他信息以后再补，也可以一直不补。</Text>
            <TextInput autoFocus maxLength={40} onChangeText={setName} onSubmitEditing={() => void handleCreate()} placeholder="名字" placeholderTextColor={colors.inkFaint} returnKeyType="done" style={styles.input} value={name} />
            <Pressable accessibilityRole="button" disabled={!name.trim()} onPress={() => void handleCreate()} style={({ pressed }) => [styles.confirmButton, !name.trim() && styles.confirmButtonDisabled, pressed && styles.confirmButtonPressed]}>
              <Text style={styles.confirmButtonText}>创建人物</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  container: { padding: spacing.lg, paddingBottom: spacing.xxl },
  topLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.5 },
  addButton: { minHeight: 44, justifyContent: 'center', paddingLeft: spacing.md },
  addButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  title: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 36, lineHeight: 47 },
  description: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 12, lineHeight: 21 },
  emptyCard: { marginTop: spacing.xxl, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  emptyTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 19 },
  emptyText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 12, lineHeight: 21 },
  emptyAction: { marginTop: spacing.lg, color: colors.life, fontSize: 11, fontWeight: '700' },
  list: { marginTop: spacing.xxl },
  personRow: { minHeight: 78, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  personRowPressed: { opacity: 0.58 },
  avatar: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: 24, backgroundColor: colors.life },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: colors.onLife, fontFamily: typography.display, fontSize: 19 },
  personInfo: { flex: 1, marginLeft: spacing.md },
  personName: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  personMeta: { marginTop: 4, color: colors.inkFaint, fontSize: 9 },
  chevron: { color: colors.inkFaint, fontFamily: typography.display, fontSize: 25 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(32, 35, 31, 0.28)' },
  sheet: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  handle: { width: 38, height: 4, alignSelf: 'center', marginVertical: spacing.md, borderRadius: 2, backgroundColor: colors.line },
  sheetTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 25 },
  sheetHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11 },
  input: { height: 54, marginTop: spacing.lg, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 16 },
  confirmButton: { height: 52, marginTop: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  confirmButtonDisabled: { opacity: 0.35 },
  confirmButtonPressed: { opacity: 0.82 },
  confirmButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
});
