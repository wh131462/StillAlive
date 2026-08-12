import { useCallback, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { randomUUID } from 'expo-crypto';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import type { ProfileCollectionField, ProfileCollectionRequest } from '@still-alive/types';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import ProfileCollectionCrypto from '../../src/components/profile-collection-crypto.dom';
import type { ProfileCollectionCryptoCommand, ProfileCollectionCryptoResult } from '../../src/components/profile-collection-crypto.types';
import { useAppState } from '../../src/state/app-state';
import { encodeProfileCollectionInvitation, PROFILE_COLLECTION_INVITATION_DAYS, profileCollectionInvitationUrl } from '../../src/domain/profile-collection';
import type { ProfileCollectionInvitationV1, ProfileCollectionTagOption } from '../../src/domain/profile-collection';
import { createThemedStyles } from '../../src/theme/app-theme';

const FIELD_OPTIONS: Array<{ id: ProfileCollectionField; label: string; hint: string }> = [
  { id: 'name', label: '姓名', hint: '对方平时希望被怎样称呼' },
  { id: 'gender', label: '性别', hint: '由对方自己选择' },
  { id: 'birthday', label: '生日', hint: '公历或农历都可以' },
  { id: 'mbti', label: 'MBTI', hint: '由对方选择自己的类型' },
  { id: 'customTags', label: '人物标签', hint: '请对方从你已有的选项中选择' },
];

export default function ProfileCollectionInviteScreen() {
  const router = useRouter();
  const { personId } = useLocalSearchParams<{ personId?: string }>();
  const { createProfileCollectionRequest, deleteProfileCollectionRequest, people, tagDefinitions, tagGroups } = useAppState();
  const person = people.find((item) => item.id === personId);
  const availableFields = useMemo(() => FIELD_OPTIONS.filter((option) => option.id !== 'customTags' || tagDefinitions.length > 0), [tagDefinitions.length]);
  const [selectedFields, setSelectedFields] = useState<ProfileCollectionField[]>(() => availableFields.map((option) => option.id));
  const [busy, setBusy] = useState(false);
  const [cryptoCommand, setCryptoCommand] = useState<ProfileCollectionCryptoCommand | null>(null);

  const toggleField = (field: ProfileCollectionField) => setSelectedFields((current) => current.includes(field) ? current.filter((item) => item !== field) : [...current, field]);

  const createInvitation = () => {
    if (!person || busy) return;
    if (!selectedFields.length) {
      Alert.alert('至少选择一个问题');
      return;
    }
    setBusy(true);
    setCryptoCommand({ id: Date.now(), type: 'generate-key-pair' });
  };

  const handleCryptoResult = useCallback(async (result: ProfileCollectionCryptoResult) => {
    if (!busy) return;
    setCryptoCommand(null);
    if (!result.ok) {
      setBusy(false);
      Alert.alert('无法创建邀请', result.error);
      return;
    }
    if (result.type !== 'generate-key-pair') return;
    if (!person) {
      setBusy(false);
      return;
    }
    const requestId = randomUUID();
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + PROFILE_COLLECTION_INVITATION_DAYS * 24 * 60 * 60 * 1000);
    const tagMap: Record<string, string> = {};
    const tagOptions: ProfileCollectionTagOption[] = selectedFields.includes('customTags') ? tagDefinitions.map((tag) => {
      const temporaryId = randomUUID().replaceAll('-', '');
      tagMap[temporaryId] = tag.id;
      return { id: temporaryId, label: tag.name, group: tag.groupId ? tagGroups.find((group) => group.id === tag.groupId)?.name ?? null : null };
    }) : [];
    const request: ProfileCollectionRequest = {
      id: requestId,
      personId: person.id,
      fields: selectedFields,
      tagMap,
      expiresAt: expiresAt.toISOString(),
      status: 'pending',
      createdAt: createdAt.toISOString(),
      consumedAt: null,
    };
    const invitation: ProfileCollectionInvitationV1 = { v: 1, id: requestId, exp: request.expiresAt, pk: result.publicKey, f: selectedFields, tags: tagOptions };
    let stored = false;
    try {
      const link = profileCollectionInvitationUrl(encodeProfileCollectionInvitation(invitation));
      await createProfileCollectionRequest(request, result.privateKeyJwk);
      stored = true;
      const shareResult = await Share.share({ message: `有几件关于你的事，我不想替你猜，想听你自己说。愿意回答多少都可以，答案不会上传。填好后，把生成的回信发给我就好。\n\n${link}`, url: link, title: '有些事，想听你自己说' });
      if (shareResult.action === Share.dismissedAction) {
        await deleteProfileCollectionRequest(requestId);
        stored = false;
      } else {
        router.back();
      }
    } catch (cause) {
      if (stored) await deleteProfileCollectionRequest(requestId).catch(() => undefined);
      Alert.alert('邀请创建失败', cause instanceof Error ? cause.message : '请稍后重试。');
    } finally {
      setBusy(false);
    }
  }, [busy, createProfileCollectionRequest, deleteProfileCollectionRequest, person, router, selectedFields, tagDefinitions, tagGroups]);

  if (!person) return <SafeAreaView style={styles.safeArea}><Text style={styles.missing}>这个人物不存在或已被删除。</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safeArea}>
    <View style={styles.header}>
      <Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={() => router.back()} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable>
      <Text style={styles.headerTitle}>邀请对方填写</Text><View style={styles.headerButton} />
    </View>
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.intro}>
        <Text style={styles.introEyebrow}>请本人补充</Text>
        <Text style={styles.introTitle}>哪些信息，想听对方亲自回答？</Text>
        <Text style={styles.introText}>对方愿意填多少都可以。邀请 7 天内有效，答案只在浏览器中加密，并由这台设备解开。</Text>
      </View>
      <View style={styles.fieldList}>
        {availableFields.map((option, index) => {
          const selected = selectedFields.includes(option.id);
          return <Pressable key={option.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} onPress={() => toggleField(option.id)} style={[styles.fieldRow, index === availableFields.length - 1 && styles.fieldRowLast]}>
            <View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <SymbolView name={{ android: 'check', ios: 'checkmark', web: 'check' }} size={14} tintColor={colors.onLife} type="hierarchical" /> : null}</View>
            <View style={styles.fieldCopy}><Text style={styles.fieldTitle}>{option.label}</Text><Text style={styles.fieldHint}>{option.hint}</Text></View>
          </Pressable>;
        })}
      </View>
      <View style={styles.notice}><Text style={styles.noticeTitle}>不会透露你已经写下的内容</Text><Text style={styles.noticeText}>邀请里没有姓名、头像、关系、印象，也不会带出任何现有记录。</Text></View>
      <Pressable accessibilityRole="button" disabled={busy || !selectedFields.length} onPress={createInvitation} style={[styles.primaryButton, (busy || !selectedFields.length) && styles.primaryButtonDisabled]}><Text style={styles.primaryButtonText}>{busy ? '正在生成安全邀请…' : '生成邀请并分享'}</Text></Pressable>
    </ScrollView>
    <View pointerEvents="none" style={styles.cryptoWorker}><ProfileCollectionCrypto command={cryptoCommand} dom={{ style: styles.cryptoDom }} onResult={handleCryptoResult} /></View>
  </SafeAreaView>;
}

const styles = createThemedStyles(() => ({
  safeArea: { flex: 1, backgroundColor: colors.paper },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },
  intro: { padding: spacing.lg, borderRadius: radius.lg, backgroundColor: colors.life },
  introEyebrow: { color: colors.sun, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 },
  introTitle: { marginTop: spacing.md, color: colors.onLife, fontFamily: typography.display, fontSize: 25, lineHeight: 34 },
  introText: { marginTop: spacing.sm, color: colors.onLife, opacity: 0.72, fontSize: 11, lineHeight: 19 },
  fieldList: { marginTop: spacing.lg, paddingHorizontal: spacing.md, overflow: 'hidden', borderRadius: radius.lg, backgroundColor: colors.sheet },
  fieldRow: { minHeight: 72, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  fieldRowLast: { borderBottomWidth: 0 },
  checkbox: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: 12 },
  checkboxSelected: { borderColor: colors.life, backgroundColor: colors.life },
  fieldCopy: { flex: 1, marginLeft: spacing.md },
  fieldTitle: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  fieldHint: { marginTop: 5, color: colors.inkFaint, fontSize: 10 },
  notice: { marginTop: spacing.lg, padding: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.sun, borderRadius: radius.md, backgroundColor: colors.sunLight },
  noticeTitle: { color: colors.ink, fontSize: 11, fontWeight: '700' },
  noticeText: { marginTop: 6, color: colors.inkSoft, fontSize: 10, lineHeight: 17 },
  primaryButton: { minHeight: 54, marginTop: spacing.xl, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  primaryButtonDisabled: { opacity: 0.42 },
  primaryButtonText: { color: colors.onLife, fontSize: 12, fontWeight: '700' },
  missing: { margin: spacing.xl, color: colors.inkSoft },
  cryptoWorker: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  cryptoDom: { width: 1, height: 1, opacity: 0 },
}));
