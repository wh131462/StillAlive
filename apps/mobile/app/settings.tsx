import { useState } from 'react';
import { useRouter } from 'expo-router';
import { Alert, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { toDayKey } from '@still-alive/core';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../src/state/app-state';

export default function SettingsScreen() {
  const router = useRouter();
  const { deleteAllLocalData, preferences, today, updatePreferences } = useAppState();
  const [nickname, setNickname] = useState(preferences.nickname);
  const [birthDate, setBirthDate] = useState(preferences.birthDate);
  const [globalMemoryEnabled, setGlobalMemoryEnabled] = useState(preferences.globalMemoryEnabled);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const normalizedBirthDate = birthDate.trim();
    if (normalizedBirthDate && !validBirthDate(normalizedBirthDate, today)) {
      Alert.alert('出生日期格式不正确', '请使用 YYYY-MM-DD，并且不能晚于今天。');
      return;
    }
    try {
      setSaving(true);
      await updatePreferences({ nickname: nickname.trim(), birthDate: normalizedBirthDate, globalMemoryEnabled });
      router.back();
    } catch (cause: unknown) {
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  const confirmDeleteAll = () => {
    Alert.alert('删除这台设备上的全部内容？', '日记、草稿、人物、图片和设置都会被真实删除。之前导出的备份文件不会被删除。', [
      { text: '取消', style: 'cancel' },
      {
        text: '继续',
        onPress: () => Alert.alert('最后确认', '这个操作无法撤销。确定清空“仍在”的全部本地数据吗？', [
          { text: '保留数据', style: 'cancel' },
          { text: '全部删除', style: 'destructive', onPress: () => void deleteAllLocalData().then(
            () => router.replace('/'),
            (cause: unknown) => Alert.alert('删除失败', cause instanceof Error ? cause.message : '请稍后重试。'),
          ) },
        ]),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><Text style={styles.backText}>取消</Text></Pressable>
        <Text style={styles.headerTitle}>偏好与隐私</Text>
        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void handleSave()} style={styles.headerButton}><Text style={styles.saveText}>{saving ? '保存中' : '保存'}</Text></Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.eyebrow}>ABOUT YOU</Text>
        <Text style={styles.sectionTitle}>可以不填，也可以随时修改。</Text>
        <Field label="昵称" maxLength={30} onChangeText={setNickname} placeholder="怎么称呼你" value={nickname} />
        <Field autoCapitalize="none" keyboardType="numbers-and-punctuation" label="出生日期" maxLength={10} onChangeText={setBirthDate} placeholder="YYYY-MM-DD" value={birthDate} />

        <View style={styles.sectionRule} />
        <Text style={styles.eyebrow}>MEMORIES</Text>
        <Pressable accessibilityRole="switch" accessibilityState={{ checked: globalMemoryEnabled }} onPress={() => setGlobalMemoryEnabled((value) => !value)} style={styles.switchRow}>
          <View style={styles.switchCopy}><Text style={styles.switchTitle}>在今日页展示回忆</Text><Text style={styles.switchHint}>关闭后不再主动出现，那年今日和人物记录仍会保留。</Text></View>
          <View style={[styles.switchTrack, globalMemoryEnabled && styles.switchTrackOn]}><View style={[styles.switchThumb, globalMemoryEnabled && styles.switchThumbOn]} /></View>
        </Pressable>

        <View style={styles.sectionRule} />
        <Text style={styles.eyebrow}>LOCAL FIRST</Text>
        <Text style={styles.privacyText}>数据库和媒体文件保存在应用系统沙箱内。没有账号、后台同步或第三方行为追踪；只有你主动导出时，内容才会通过系统分享面板离开应用。</Text>
        <Text style={styles.location}>存储位置 · 当前设备应用私有目录</Text>

        <Pressable accessibilityRole="button" onPress={confirmDeleteAll} style={styles.deleteButton}><Text style={styles.deleteTitle}>删除全部本地数据</Text><Text style={styles.deleteHint}>不会删除已经保存到其他位置的备份</Text></Pressable>

        <Text style={styles.version}>仍在 Still Alive · 0.1.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Field({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput {...props} placeholderTextColor={colors.inkFaint} style={styles.input} /></View>;
}

function validBirthDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value > today) return false;
  const [year, month, day] = value.split('-').map(Number);
  return toDayKey(new Date(year, month - 1, day)) === value;
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.lg, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 64, minHeight: 44, justifyContent: 'center' },
  backText: { color: colors.inkSoft, fontSize: 11 },
  saveText: { color: colors.life, fontSize: 11, fontWeight: '700', textAlign: 'right' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  eyebrow: { marginTop: spacing.md, color: colors.life, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.4 },
  sectionTitle: { marginTop: spacing.sm, color: colors.ink, fontFamily: typography.display, fontSize: 20 },
  field: { marginTop: spacing.lg },
  fieldLabel: { marginBottom: spacing.sm, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1 },
  input: { minHeight: 52, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 15 },
  sectionRule: { height: StyleSheet.hairlineWidth, marginVertical: spacing.xl, backgroundColor: colors.line },
  switchRow: { minHeight: 72, marginTop: spacing.sm, flexDirection: 'row', alignItems: 'center' },
  switchCopy: { flex: 1, paddingRight: spacing.lg },
  switchTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 16 },
  switchHint: { marginTop: 5, color: colors.inkFaint, fontSize: 9, lineHeight: 16 },
  switchTrack: { width: 46, height: 28, padding: 3, justifyContent: 'center', borderRadius: 14, backgroundColor: colors.line },
  switchTrackOn: { backgroundColor: colors.life },
  switchThumb: { width: 22, height: 22, borderRadius: 11, backgroundColor: colors.sheet },
  switchThumbOn: { alignSelf: 'flex-end' },
  privacyText: { marginTop: spacing.md, color: colors.inkSoft, fontSize: 11, lineHeight: 21 },
  location: { marginTop: spacing.md, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8 },
  deleteButton: { minHeight: 72, marginTop: spacing.xxl, padding: spacing.md, justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(155, 73, 63, 0.35)', borderRadius: radius.md },
  deleteTitle: { color: '#9B493F', fontSize: 11, fontWeight: '700' },
  deleteHint: { marginTop: 5, color: colors.inkFaint, fontSize: 9 },
  version: { marginTop: spacing.xxl, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 8, textAlign: 'center' },
});
