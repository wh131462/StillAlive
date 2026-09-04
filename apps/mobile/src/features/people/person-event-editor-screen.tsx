import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { PersonEvent } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { useAppState } from '../../application/state/app-state';
import { personDisplayName } from './person-profile';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { ToolPageHeader, ToolPageHeaderTextAction } from '../../shared/components/tool-page-header';
import { feedback } from '../../shared/feedback';

export default function PersonEventEditorScreen() {
  const router = useRouter();
  const { id, eventId } = useLocalSearchParams<{ id?: string; eventId?: string }>();
  const { people, personEvents, ready, savePersonEvent } = useAppState();
  const person = useMemo(() => people.find((item) => item.id === id), [id, people]);
  const event = useMemo(() => eventId ? personEvents.find((item) => item.id === eventId) : undefined, [eventId, personEvents]);
  const [title, setTitle] = useState('');
  const [timeText, setTimeText] = useState('');
  const [description, setDescription] = useState('');
  const [participantIds, setParticipantIds] = useState<string[]>(id ? [id] : []);
  const [saving, setSaving] = useState(false);
  const [started, setStarted] = useState(false);
  const initialValueRef = useRef('');
  const currentValue = JSON.stringify({ title, timeText, description, participantIds: [...participantIds].sort() });
  const dirty = started && currentValue !== initialValueRef.current;

  useEffect(() => {
    if (!person || started) return;
    setTitle(event?.title ?? '');
    setTimeText(event?.timeText ?? '');
    setDescription(event?.description ?? '');
    setParticipantIds(event?.participantIds.length ? event.participantIds : [person.id]);
    initialValueRef.current = JSON.stringify({ title: event?.title ?? '', timeText: event?.timeText ?? '', description: event?.description ?? '', participantIds: [...(event?.participantIds.length ? event.participantIds : [person.id])].sort() });
    setStarted(true);
  }, [event, person, started]);

  useEffect(() => {
    if (ready && !person) router.replace('/people');
  }, [person, ready, router]);

  const handleBack = () => {
    if (!dirty || saving) {
      router.back();
      return;
    }
    feedback.alert('放弃这段经历？', '尚未保存的内容会被丢弃。', [
      { text: '继续编写', style: 'cancel' },
      { text: '放弃', style: 'destructive', onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (!person || !title.trim()) {
      feedback.alert('请先写下经历标题', '标题会帮助你以后快速找到这段记忆。');
      return;
    }
    const now = new Date().toISOString();
    const nextEvent: PersonEvent = event
      ? { ...event, title, timeText: timeText || null, description: description || null, participantIds, updatedAt: now }
      : { id: `person_event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, personId: person.id, title, description: description || null, timeText: timeText || null, participantIds: participantIds.length ? participantIds : [person.id], pinned: false, sortOrder: 0, createdAt: now, updatedAt: now };
    try {
      setSaving(true);
      await savePersonEvent(nextEvent);
      router.back();
    } catch (cause) {
      feedback.alert('保存经历失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setSaving(false);
    }
  };

  if (!person) return <SafeAreaView style={styles.safeArea}><ToolPageHeader onBack={handleBack} title="编写经历" /><Text style={styles.missing}>这个人物不存在或已被删除。</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader backAccessibilityLabel="返回人物详情" onBack={handleBack} right={<ToolPageHeaderTextAction accessibilityLabel="保存经历" disabled={saving} emphasized label={saving ? '保存中' : '保存'} onPress={() => void save()} />} title={event ? '编辑经历' : '写一段经历'} />
    <AppKeyboardAvoidingView mode="active" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.heroEyebrow}>{event ? 'REVISIT A MEMORY' : 'A MEMORY TO KEEP'}</Text>
          <Text style={styles.heroTitle}>{event ? '把这段经历写得更完整' : '从一个瞬间开始'}</Text>
          <Text style={styles.heroText}>{event ? '可以补充细节，或修正当时留下的时间和参与人物。' : '不需要一次写完。先记下最重要的那句话，其他细节以后再补。'}</Text>
        </View>

        <View style={styles.formCard}>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>这段经历是</Text>
            <TextInput accessibilityLabel="经历标题" autoFocus={!event} maxLength={80} onChangeText={setTitle} placeholder="例如：第一次一起旅行" placeholderTextColor={colors.inkFaint} returnKeyType="next" style={styles.titleInput} value={title} />
            <Text style={styles.counter}>{title.length}/80</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>大约发生在</Text>
            <TextInput accessibilityLabel="经历时间" maxLength={40} onChangeText={setTimeText} placeholder="可以模糊一些，如：2018 年夏天" placeholderTextColor={colors.inkFaint} style={styles.input} value={timeText} />
            <Text style={styles.helper}>不确定具体日期也没关系，留下你记得的时间。</Text>
          </View>
          <View style={styles.field}>
            <Text style={styles.fieldLabel}>写下细节</Text>
            <TextInput accessibilityLabel="经历描述" maxLength={1000} multiline onChangeText={setDescription} placeholder="当时发生了什么？你记住了什么？" placeholderTextColor={colors.inkFaint} style={[styles.input, styles.descriptionInput]} textAlignVertical="top" value={description} />
            <View style={styles.descriptionFooter}><Text style={styles.helper}>想到什么就写什么，之后还可以继续编辑。</Text><Text style={styles.counter}>{description.length}/1000</Text></View>
          </View>
        </View>

        <View style={styles.participantCard}>
          <Text style={styles.fieldLabel}>谁也在场</Text>
          <Text style={styles.helper}>选择参与这段经历的人，至少保留当前人物。</Text>
          <View style={styles.participantList}>{people.map((member) => {
            const selected = participantIds.includes(member.id);
            return <Pressable key={member.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setParticipantIds((current) => {
              if (member.id === person.id) return current.includes(member.id) ? current : [...current, member.id];
              return current.includes(member.id) ? current.filter((value) => value !== member.id) : [...current, member.id];
            })} style={({ pressed }) => [styles.participant, selected && styles.participantSelected, pressed && styles.pressed]}><View style={[styles.dot, selected && styles.dotSelected]} /><Text style={[styles.participantText, selected && styles.participantTextSelected]}>{personDisplayName(member)}</Text></Pressable>;
          })}</View>
        </View>

        <Pressable accessibilityRole="button" disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.saveButton, saving && styles.disabled, pressed && styles.pressed]}><Text style={styles.saveButtonText}>{saving ? '正在保存…' : event ? '保存修改' : '保存这段经历'}</Text></Pressable>
        <Text style={styles.bottomHint}>这段经历会出现在人物详情的共同回忆中。</Text>
      </ScrollView>
    </AppKeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  hero: { padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.lifeDeep },
  heroEyebrow: { color: colors.sun, fontFamily: typography.mono, fontSize: 9, letterSpacing: 1.3 },
  heroTitle: { marginTop: spacing.sm, color: colors.onLife, fontFamily: typography.display, fontSize: 27, lineHeight: 34 },
  heroText: { marginTop: spacing.sm, color: colors.onLifeMuted, fontSize: 11, lineHeight: 19 },
  formCard: { marginTop: spacing.lg, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.sheet },
  field: { paddingVertical: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  fieldLabel: { color: colors.inkSoft, fontSize: 11, fontWeight: '800' },
  titleInput: { minHeight: 55, marginTop: spacing.sm, padding: 0, color: colors.ink, fontFamily: typography.display, fontSize: 23 },
  input: { minHeight: 50, marginTop: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: colors.paper, color: colors.ink, fontSize: 13 },
  descriptionInput: { minHeight: 170, paddingTop: spacing.md, lineHeight: 21 },
  helper: { flex: 1, marginTop: 7, color: colors.inkFaint, fontSize: 10, lineHeight: 16 },
  counter: { color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9 },
  descriptionFooter: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  participantCard: { marginTop: spacing.md, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  participantList: { marginTop: spacing.md, flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  participant: { minHeight: 38, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 20, backgroundColor: colors.paper },
  participantSelected: { borderColor: colors.life, backgroundColor: colors.lifeLight },
  dot: { width: 8, height: 8, marginRight: 7, borderRadius: 4, backgroundColor: colors.line },
  dotSelected: { backgroundColor: colors.life },
  participantText: { color: colors.inkSoft, fontSize: 11 },
  participantTextSelected: { color: colors.life, fontWeight: '700' },
  saveButton: { minHeight: 54, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  saveButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '800' },
  bottomHint: { marginTop: spacing.md, color: colors.inkFaint, fontSize: 10, lineHeight: 17, textAlign: 'center' },
  missing: { marginTop: spacing.xxl, padding: spacing.lg, color: colors.inkSoft, fontFamily: typography.display, fontSize: 17 },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.62 },
}));
