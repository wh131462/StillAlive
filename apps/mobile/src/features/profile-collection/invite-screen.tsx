import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Platform, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { feedback } from '../../shared/feedback';
import { PROFILE_COLLECTION_FIELDS, type ProfileCollectionField, type ProfileCollectionRequest } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import ProfileCollectionCrypto from './profile-collection-crypto.dom';
import type { ProfileCollectionCryptoCommand, ProfileCollectionCryptoResult } from './profile-collection-crypto.types';
import { useAppState } from '../../application/state/app-state';
import { encodeProfileCollectionInvitation, PROFILE_COLLECTION_INVITATION_DAYS, profileCollectionInvitationUrl } from './profile-collection';
import type { ProfileCollectionInvitationV1, ProfileCollectionTagOption } from './profile-collection';
import { createThemedStyles } from '../../shared/theme/app-theme';
import { ToolPageHeader } from '../../shared/components/tool-page-header';
import { executeProfileCollectionCrypto, isNativeProfileCollectionCryptoAvailable } from './profile-collection-crypto';

const FIELD_COPY: Record<ProfileCollectionField, { label: string; hint: string }> = {
  name: { label: '姓名', hint: '对方平时希望被怎样称呼' },
  nickname: { label: '昵称', hint: '对方更常使用的称呼' },
  bio: { label: '个人简介', hint: '由对方补充自己的介绍' },
  gender: { label: '性别', hint: '由对方自己选择' },
  birthday: { label: '生日', hint: '公历或农历都可以' },
  mbti: { label: 'MBTI', hint: '由对方选择自己的类型' },
  customTags: { label: '人物标签', hint: '由对方选择已有标签或创建新标签' },
};
const FIELD_OPTIONS = PROFILE_COLLECTION_FIELDS.map((id) => ({ id, ...FIELD_COPY[id] }));

export default function ProfileCollectionInviteScreen() {
  const router = useRouter();
  const { personId, requestId } = useLocalSearchParams<{ personId?: string; requestId?: string }>();
  const { createProfileCollectionRequest, getProfileCollectionRequest, people, tagDefinitions, tagGroups } = useAppState();
  const person = people.find((item) => item.id === personId);
  const availableFields = useMemo(() => FIELD_OPTIONS, []);
  const [selectedFields, setSelectedFields] = useState<ProfileCollectionField[]>(() => availableFields.map((option) => option.id));
  const [busy, setBusy] = useState(false);
  const [createdInvite, setCreatedInvite] = useState<{ id: string; link: string; expiresAt: string } | null>(null);
  const [cryptoCommand, setCryptoCommand] = useState<ProfileCollectionCryptoCommand | null>(null);
  const activeCryptoIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!requestId) return;
    let active = true;
    void getProfileCollectionRequest(requestId).then((request) => {
      if (!active || !request || !request.invitationUrl) return;
      if (request.status !== 'pending' || new Date(request.expiresAt).getTime() <= Date.now()) {
        feedback.notice('这个邀请已经过期或已使用，请重新生成');
        return;
      }
      setSelectedFields(request.fields);
      setCreatedInvite({ id: request.id, link: request.invitationUrl, expiresAt: request.expiresAt });
    }).catch((cause: unknown) => {
      if (active) feedback.alert('无法读取邀请', cause instanceof Error ? cause.message : '请稍后重试。');
    });
    return () => { active = false; };
  }, [getProfileCollectionRequest, requestId]);

  const shareInvite = useCallback(async (link: string) => {
    try {
      const result = await Share.share({ message: `我最近在「仍在」记录关于你的点滴，如果你愿意，很希望能邀请你一同参与。点击链接就能填写，完成后把回信链接分享给我就好。\n\n${link}`, url: link, title: '有些事，想听你自己说' });
      if (result.action === Share.dismissedAction) feedback.notice('邀请已创建，可以稍后复制或再次分享');
    } catch (cause: unknown) {
      feedback.alert('分享失败，但邀请已创建', cause instanceof Error ? cause.message : '可以在下方复制链接后手动发送。');
    }
  }, []);

  const copyInvite = useCallback(async (link: string) => {
    try {
      await Clipboard.setStringAsync(link);
      feedback.notice('邀请链接已复制');
    } catch (cause: unknown) {
      feedback.alert('复制失败', cause instanceof Error ? cause.message : '请手动选择链接复制。');
    }
  }, []);

  const toggleField = (field: ProfileCollectionField) => setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);

  const createInvitation = () => {
    if (!person || busy) return;
    if (!selectedFields.length) {
      feedback.alert('至少选择一个问题');
      return;
    }
    setBusy(true);
    const command = { id: Date.now(), type: 'generate-key-pair' } as const;
    activeCryptoIdRef.current = command.id;
    if (Platform.OS === 'ios' && isNativeProfileCollectionCryptoAvailable) void executeProfileCollectionCrypto(command).then(handleCryptoResult);
    else setCryptoCommand(command);
  };

  const handleCryptoResult = useCallback(async (result: ProfileCollectionCryptoResult) => {
    if (activeCryptoIdRef.current !== result.id) return;
    activeCryptoIdRef.current = null;
    setCryptoCommand(null);
    if (!result.ok) {
      setBusy(false);
      feedback.alert('无法创建邀请', result.error);
      return;
    }
    if (result.type !== 'generate-key-pair') return;
    if (!person) {
      setBusy(false);
      return;
    }
    const nextRequestId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + PROFILE_COLLECTION_INVITATION_DAYS * 24 * 60 * 60 * 1000);
    const tagMap: Record<string, string> = {};
    const tagOptions: ProfileCollectionTagOption[] = selectedFields.includes('customTags') ? tagDefinitions.map((tag) => {
      const temporaryId = randomUUID().replaceAll('-', '');
      tagMap[temporaryId] = tag.id;
      return { id: temporaryId, label: tag.name, group: tag.groupId ? tagGroups.find((group) => group.id === tag.groupId)?.name ?? null : null };
    }) : [];
    const request: ProfileCollectionRequest = {
      id: nextRequestId,
      personId: person.id,
      fields: selectedFields,
      tagMap,
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      createdAt: createdAt.toISOString(),
      consumedAt: null,
    };
    const invitation: ProfileCollectionInvitationV1 = { v: 1, id: nextRequestId, exp: request.expiresAt, pk: result.publicKey, f: selectedFields, tags: tagOptions };
    try {
      const link = profileCollectionInvitationUrl(encodeProfileCollectionInvitation(invitation));
      await createProfileCollectionRequest({ ...request, invitationUrl: link }, result.privateKeyJwk);
      setCreatedInvite({ id: request.id, link, expiresAt: request.expiresAt });
      setBusy(false);
      await shareInvite(link);
    } catch (cause) {
      setBusy(false);
      feedback.alert('邀请创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    }
  }, [createProfileCollectionRequest, person, selectedFields, shareInvite, tagDefinitions, tagGroups]);

  if (!person) return <SafeAreaView style={styles.safeArea}><ToolPageHeader onBack={() => router.back()} title="邀请对方填写" /><Text style={styles.missing}>这个人物不存在或已被删除。</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}>
    <ToolPageHeader onBack={() => router.back()} title="邀请对方填写" />
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>请本人补充</Text>
        <Text style={styles.introTitle}>哪些信息，想听对方亲自回答？</Text>
        <Text style={styles.introText}>对方愿意填多少都可以。邀请 7 天内有效，答案只在浏览器中加密，并仅能由这台设备解开。</Text>
      </View>
      {createdInvite ? (
        <View style={styles.successCard}>
          <Text style={styles.successEyebrow}>INVITATION READY</Text>
          <Text style={styles.successTitle}>邀请已经准备好</Text>
          <Text style={styles.successText}>7 天内有效。关闭分享面板也没关系，链接会保留在这里。</Text>
          <Text selectable style={styles.linkText}>{createdInvite.link}</Text>
          <Text style={styles.expiryText}>有效至 {formatExpiry(createdInvite.expiresAt)}</Text>
          <Pressable accessibilityRole="button" onPress={() => void copyInvite(createdInvite.link)} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>复制邀请链接</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => void shareInvite(createdInvite.link)} style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}><Text style={styles.secondaryButtonText}>再次分享</Text></Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.doneButton, pressed && styles.pressed]}><Text style={styles.doneButtonText}>完成</Text></Pressable>
        </View>
      ) : <>
      <View style={styles.fieldList}>
        {availableFields.map((option, index) => {
          const selected = selectedFields.includes(option.id);
          return <Pressable key={option.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleField(option.id)} style={[styles.fieldRow, index === availableFields.length - 1 && styles.fieldRowLast]}>
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={14} tintColor={colors.onLife} type="hierarchical" /> : null}</View>
            <View style={styles.fieldCopy}><Text style={styles.fieldTitle}>{option.label}</Text><Text style={styles.fieldHint}>{option.hint}</Text></View>
          </Pressable>;
        })}
      </View>
      <Pressable accessibilityRole="button" disabled={busy || !selectedFields.length} onPress={createInvitation} style={[styles.primaryButton, (busy || !selectedFields.length) && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>{busy ? '正在生成安全邀请…' : '生成邀请并分享'}</Text></Pressable>
      </>}
    </ScrollView>
    {Platform.OS === 'ios' && isNativeProfileCollectionCryptoAvailable ? null : <View pointerEvents="none" style={styles.cryptoWorker}><ProfileCollectionCrypto command={cryptoCommand} dom={{ style: styles.cryptoDom }} onResult={handleCryptoResult} /></View>}
  </SafeAreaView>;
}

function formatExpiry(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { padding: spacing.lg, borderRadius: 6, backgroundColor: colors.life },
  introEyebrow: { color: colors.sunInk, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  introTitle: { marginTop: spacing.md, color: colors.onLife, fontFamily: typography.display, fontSize: 25, lineHeight: 34 },
  introText: { marginTop: spacing.sm, color: colors.onLife, opacity: 0.72, fontSize: 11, lineHeight: 19 },
  fieldList: { marginTop: spacing.lg, paddingHorizontal: spacing.md, overflow: 'hidden', borderRadius: 6, backgroundColor: colors.sheet },
  fieldRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  fieldRowLast: { borderBottomWidth: 0 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  checkboxSelected: { borderColor: colors.life, backgroundColor: colors.life },
  fieldCopy: { flex: 1, marginLeft: spacing.md },
  fieldTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  fieldHint: { marginTop: 5, color: colors.inkFaint, fontSize: 10 },
  primaryButton: { minHeight: 54, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: 6, backgroundColor: colors.life },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  secondaryButton: { minHeight: 44, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lifeLine, borderRadius: 6 },
  secondaryButtonText: { color: colors.life, fontSize: 11, fontWeight: '700' },
  doneButton: { minHeight: 44, marginTop: spacing.sm, alignItems: 'center', justifyContent: 'center' },
  doneButtonText: { color: colors.inkFaint, fontSize: 11 },
  successCard: { marginTop: spacing.lg, padding: spacing.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lifeLine, borderRadius: 6, backgroundColor: colors.sheet },
  successEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  successTitle: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 22 },
  successText: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: 11, lineHeight: 18 },
  linkText: { marginTop: spacing.md, padding: spacing.md, borderRadius: 6, backgroundColor: colors.paper, color: colors.ink, fontSize: 10, lineHeight: 16 },
  expiryText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: 10 },
  pressed: { opacity: 0.72 },
  missing: { margin: spacing.xl, color: colors.inkSoft },
  cryptoWorker: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  cryptoDom: { width: 1, height: 1, opacity: 0 },
}));
