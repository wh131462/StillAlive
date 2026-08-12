import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Birthday, Person, ProfileCollectionField, ProfileCollectionRequest } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { strToU8 } from 'fflate';
import ProfileCollectionCrypto from '../../src/components/profile-collection-crypto.dom';
import type { ProfileCollectionCryptoCommand, ProfileCollectionCryptoResult } from '../../src/components/profile-collection-crypto.types';
import { readProfileCollectionPrivateKey } from '../../src/data/profile-collection-key-storage';
import { decodeProfileCollectionResponseCode, parseProfileCollectionResponseInput, PROFILE_COLLECTION_PLAINTEXT_MAX_BYTES, validateProfileCollectionPayload } from '../../src/domain/profile-collection';
import type { ProfileCollectionResponseEnvelopeV1, ProfileCollectionResponsePayloadV1 } from '../../src/domain/profile-collection';
import { formatGender } from '../../src/components/gender-picker';
import { formatBirthday } from '../../src/domain/person-profile';
import { useAppState } from '../../src/state/app-state';
import { createThemedStyles } from '../../src/theme/app-theme';

interface ImportContext {
  request: ProfileCollectionRequest;
  envelope: ProfileCollectionResponseEnvelopeV1;
  personId: string;
}

interface Difference {
  field: ProfileCollectionField;
  label: string;
  before: string;
  after: string;
}

export default function ProfileCollectionImportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ response?: string }>();
  const { applyProfileCollectionImport, getProfileCollectionRequest, people, personTags, tagDefinitions } = useAppState();
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [context, setContext] = useState<ImportContext | null>(null);
  const [payload, setPayload] = useState<ProfileCollectionResponsePayloadV1 | null>(null);
  const [selectedFields, setSelectedFields] = useState<ProfileCollectionField[]>([]);
  const [cryptoCommand, setCryptoCommand] = useState<ProfileCollectionCryptoCommand | null>(null);
  const initialHandledRef = useRef(false);
  const initializedPayloadRef = useRef<ProfileCollectionResponsePayloadV1 | null>(null);
  const person = context ? people.find((item) => item.id === context.personId) ?? null : null;
  const currentAssignments = useMemo(() => person ? personTags.filter((item) => item.personId === person.id) : [], [person, personTags]);
  const currentMbti = currentAssignments.find((item) => item.kind === 'mbti')?.value ?? null;
  const currentCustomTagIds = useMemo(() => currentAssignments.filter((item) => item.kind === 'custom').map((item) => item.value), [currentAssignments]);
  const responseCustomTagIds = useMemo(() => context && payload?.answers.customTags ? payload.answers.customTags.map((temporaryId) => context.request.tagMap[temporaryId]).filter(Boolean) : undefined, [context, payload]);

  const differences = useMemo<Difference[]>(() => {
    if (!person || !payload) return [];
    const result: Difference[] = [];
    if (payload.answers.name && payload.answers.name !== person.name) result.push({ field: 'name', label: '姓名', before: person.name, after: payload.answers.name });
    if (payload.answers.gender && payload.answers.gender !== person.gender) result.push({ field: 'gender', label: '性别', before: formatGender(person.gender), after: formatGender(payload.answers.gender) });
    if (payload.answers.birthday && !sameBirthday(person.birthday, payload.answers.birthday)) result.push({ field: 'birthday', label: '生日', before: person.birthday ? formatBirthday(person.birthday) : '未记录', after: formatBirthday(toBirthday(payload.answers.birthday, person.birthday)) });
    if (payload.answers.mbti && payload.answers.mbti !== currentMbti) result.push({ field: 'mbti', label: 'MBTI', before: currentMbti ?? '未记录', after: payload.answers.mbti });
    if (responseCustomTagIds && !sameStringSet(responseCustomTagIds, currentCustomTagIds)) result.push({ field: 'customTags', label: '人物标签', before: formatTags(currentCustomTagIds, tagDefinitions), after: formatTags(responseCustomTagIds, tagDefinitions) });
    return result;
  }, [currentCustomTagIds, currentMbti, payload, person, responseCustomTagIds, tagDefinitions]);

  const processInput = useCallback(async (rawInput: string) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPayload(null);
    setSelectedFields([]);
    try {
      const responseCode = parseProfileCollectionResponseInput(rawInput);
      const envelope = decodeProfileCollectionResponseCode(responseCode);
      const request = await getProfileCollectionRequest(envelope.id);
      if (!request) throw new Error('这台设备上找不到对应的邀请');
      if (request.status !== 'pending') throw new Error('这封回信已经处理过');
      if (new Date(request.expiresAt).getTime() <= Date.now()) throw new Error('对应的邀请已经过期');
      const target = people.find((item) => item.id === request.personId);
      if (!target) throw new Error('对应的人物已经被删除');
      const privateKeyJwk = await readProfileCollectionPrivateKey(request.id);
      if (!privateKeyJwk) throw new Error('这台设备已无法解开这封回信');
      const nextContext = { request, envelope, personId: target.id };
      setContext(nextContext);
      setCryptoCommand({ id: Date.now(), type: 'decrypt', envelope, privateKeyJwk });
    } catch (cause) {
      setBusy(false);
      setContext(null);
      setError(cause instanceof Error ? cause.message : '无法识别这封回信');
    }
  }, [busy, getProfileCollectionRequest, people]);

  useEffect(() => {
    if (initialHandledRef.current || !params.response) return;
    initialHandledRef.current = true;
    setInput(params.response);
    void processInput(params.response);
  }, [params.response, processInput]);

  const handleCryptoResult = useCallback((result: ProfileCollectionCryptoResult) => {
    if (!busy || !context) return;
    setCryptoCommand(null);
    setBusy(false);
    if (!result.ok || result.type !== 'decrypt') {
      setError(result.ok ? '无法读取这封回信' : result.error);
      return;
    }
    try {
      if (strToU8(result.plaintext).byteLength > PROFILE_COLLECTION_PLAINTEXT_MAX_BYTES) throw new Error('回信内容超过允许大小');
      const parsed: unknown = JSON.parse(result.plaintext);
      const nextPayload = validateProfileCollectionPayload(parsed, context.request);
      setPayload(nextPayload);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '回信格式无效');
    }
  }, [busy, context]);

  useEffect(() => {
    if (!payload) {
      initializedPayloadRef.current = null;
      return;
    }
    if (initializedPayloadRef.current === payload) return;
    initializedPayloadRef.current = payload;
    setSelectedFields(differences.map((item) => item.field));
  }, [differences, payload]);

  const confirmImport = async () => {
    if (!context || !payload || !person || !selectedFields.length) return;
    const answers = payload.answers;
    const selected = new Set(selectedFields);
    const nextPerson: Person = {
      ...person,
      name: selected.has('name') && answers.name ? answers.name : person.name,
      gender: selected.has('gender') && answers.gender ? answers.gender : person.gender,
      birthday: selected.has('birthday') && answers.birthday ? toBirthday(answers.birthday, person.birthday) : person.birthday,
    };
    const nextMbti = selected.has('mbti') && answers.mbti ? answers.mbti : currentMbti;
    const nextCustomTagIds = selected.has('customTags') && responseCustomTagIds ? responseCustomTagIds : currentCustomTagIds;
    try {
      setBusy(true);
      await applyProfileCollectionImport(context.request.id, nextPerson, nextMbti, nextCustomTagIds);
      Alert.alert('已保存', `确认的内容已更新到 ${person.name}。`, [{ text: '查看人物', onPress: () => router.replace({ pathname: '/person/[id]', params: { id: person.id } }) }]);
    } catch (cause) {
      Alert.alert('保存失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setBusy(false);
    }
  };

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      <Text style={styles.headerTitle}>查看收到的回答</Text><View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      {!payload ? <>
        <View style={styles.intro}><Text style={styles.introTitle}>粘贴对方发回的内容</Text><Text style={styles.introText}>可以粘贴完整的回信链接或备用码。为了保护剪贴板内容，“仍在”不会自动读取。</Text></View>
        <TextInput autoCapitalize="none" autoCorrect={false} multiline onChangeText={setInput} placeholder="粘贴回信链接或备用码" placeholderTextColor={colors.inkFaint} style={styles.input} value={input} />
        {error ? <View style={styles.errorCard}><Text style={styles.errorTitle}>无法打开回信</Text><Text style={styles.errorText}>{error}</Text></View> : null}
        <Pressable accessibilityRole="button" disabled={busy || !input.trim()} onPress={() => void processInput(input)} style={[styles.primaryButton, (busy || !input.trim()) && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>{busy ? '正在安全解密…' : '解密并查看'}</Text></Pressable>
      </> : <>
        <View style={styles.reviewHead}><Text style={styles.reviewEyebrow}>对方的回答</Text><Text style={styles.reviewTitle}>选择要更新到 {person?.name} 的内容</Text><Text style={styles.reviewText}>回答只在本机解密。未选中的项目不会修改。</Text></View>
        {differences.length ? <View style={styles.differenceList}>{differences.map((item, index) => {
          const selected = selectedFields.includes(item.field);
          return <Pressable key={item.field} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => setSelectedFields((current) => selected ? current.filter((field) => field !== item.field) : [...current, item.field])} style={[styles.differenceRow, index === differences.length - 1 && styles.differenceRowLast]}>
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={14} tintColor={colors.onLife} type="hierarchical" /> : null}</View>
            <View style={styles.differenceCopy}><Text style={styles.differenceLabel}>{item.label}</Text><Text style={styles.beforeValue}>{item.before}</Text><Text style={styles.arrow}>↓</Text><Text style={styles.afterValue}>{item.after}</Text></View>
          </Pressable>;
        })}</View> : <View style={styles.sameCard}><Text style={styles.sameTitle}>没有需要更新的内容</Text><Text style={styles.sameText}>对方的回答与当前记录一致。</Text></View>}
        {error ? <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View> : null}
        {differences.length ? <Pressable accessibilityRole="button" disabled={busy || !selectedFields.length} onPress={() => void confirmImport()} style={[styles.primaryButton, (busy || !selectedFields.length) && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>{busy ? '正在保存…' : `保存选中的 ${selectedFields.length} 项`}</Text></Pressable> : null}
      </>}
    </ScrollView>
    <View pointerEvents="none" style={styles.cryptoWorker}><ProfileCollectionCrypto command={cryptoCommand} dom={{ style: styles.cryptoDom }} onResult={handleCryptoResult} /></View>
  </SafeAreaView>;
}

function toBirthday(answer: NonNullable<ProfileCollectionResponsePayloadV1['answers']['birthday']>, existing: Birthday | null): Birthday {
  return {
    ...answer,
    reminderEnabled: existing?.reminderEnabled ?? true,
    reminderHour: existing?.reminderHour ?? null,
    reminderMinute: existing?.reminderMinute ?? null,
    reminderMode: existing?.reminderMode ?? answer.calendar,
  };
}

function sameBirthday(existing: Birthday | null, answer: NonNullable<ProfileCollectionResponsePayloadV1['answers']['birthday']>): boolean {
  return Boolean(existing && existing.calendar === answer.calendar && existing.year === answer.year && existing.month === answer.month && existing.day === answer.day && existing.isLeapMonth === answer.isLeapMonth);
}

function sameStringSet(left: string[], right: string[]): boolean { return left.length === right.length && [...left].sort().every((item, index) => item === [...right].sort()[index]); }
function formatTags(ids: string[], definitions: Array<{ id: string; name: string }>): string { return ids.map((id) => definitions.find((item) => item.id === id)?.name).filter(Boolean).join('、') || '未记录'; }

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 17, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  introTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 23 },
  introText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 19 },
  input: { minHeight: 150, marginTop: spacing.md, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.md, backgroundColor: colors.sheet, color: colors.ink, fontSize: 12, lineHeight: 19, textAlignVertical: 'top' },
  primaryButton: { minHeight: 54, marginTop: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  errorCard: { marginTop: spacing.md, padding: spacing.md, borderRadius: radius.md, backgroundColor: colors.dangerLight },
  errorTitle: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  errorText: { marginTop: 5, color: colors.danger, fontSize: 10, lineHeight: 17 },
  reviewHead: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.life },
  reviewEyebrow: { color: colors.sun, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.1 },
  reviewTitle: { marginTop: spacing.md, color: colors.onLife, fontFamily: typography.display, fontSize: 24 },
  reviewText: { marginTop: spacing.sm, color: colors.onLife, opacity: 0.72, fontSize: 10, lineHeight: 18 },
  differenceList: { marginTop: spacing.lg, paddingHorizontal: spacing.md, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  differenceRow: { minHeight: 112, paddingVertical: spacing.md, flexDirection: 'row', alignItems: 'flex-start', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  differenceRowLast: { borderBottomWidth: 0 },
  checkbox: { width: 24, height: 24, marginTop: 2, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  checkboxSelected: { borderColor: colors.life, backgroundColor: colors.life },
  differenceCopy: { flex: 1, marginLeft: spacing.md },
  differenceLabel: { color: colors.inkFaint, fontSize: 9, letterSpacing: 1 },
  beforeValue: { marginTop: 8, color: colors.inkFaint, fontSize: 11, textDecorationLine: 'line-through' },
  arrow: { marginVertical: 3, color: colors.sun, fontSize: 10 },
  afterValue: { color: colors.ink, fontFamily: typography.display, fontSize: 15, lineHeight: 22 },
  sameCard: { marginTop: spacing.lg, padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.sheet },
  sameTitle: { color: colors.ink, fontFamily: typography.display, fontSize: 17 },
  sameText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 10, lineHeight: 18 },
  cryptoWorker: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  cryptoDom: { width: 1, height: 1, opacity: 0 },
}));
