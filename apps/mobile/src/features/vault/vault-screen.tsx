import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'expo-router';
import type { RelativePathString } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { feedback } from '../../shared/feedback';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from '../../shared/components/app-keyboard-avoiding-view';
import { usePasswordVaultState } from './password-vault-state';
import { createThemedStyles } from '../../shared/theme/app-theme';

export default function PasswordVaultScreen() {
  const router = useRouter();
  const vault = usePasswordVaultState();
  const [masterPassword, setMasterPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState<'create' | 'unlock' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const creating = !vault.hasVault;
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const searching = normalizedSearchQuery.length > 0;
  const entries = useMemo(() => {
    const sorted = [...vault.entries].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    if (!normalizedSearchQuery) return sorted;
    const terms = normalizedSearchQuery.split(' ');
    return sorted.filter((entry) => {
      const fields = [entry.name, entry.username, entry.url].map(normalizeSearchText);
      return terms.every((term) => fields.some((field) => fuzzyMatch(field, term)));
    });
  }, [normalizedSearchQuery, vault.entries]);

  useEffect(() => {
    if (vault.phase === 'unlocked') return;
    setSearchQuery('');
    setSearchFocused(false);
  }, [vault.phase]);

  const run = async (operation: 'create' | 'unlock', action: () => Promise<void>) => {
    try { Keyboard.dismiss(); setBusy(operation); await action(); setMasterPassword(''); setConfirmation(''); }
    catch (cause: unknown) { feedback.alert('无法继续', errorMessage(cause)); }
    finally { setBusy(null); }
  };

  if (vault.phase === 'loading') return <SafeAreaView style={styles.safeArea}><View style={styles.loading}><Text style={styles.loadingMark}>仍在</Text><Text style={styles.loadingText}>正在确认密码本状态…</Text></View></SafeAreaView>;

  if (vault.phase === 'unlocked') {
    return <SafeAreaView style={styles.safeArea}>
      <VaultHeader onBack={() => router.back()} right={<View style={styles.headerActions}><Pressable accessibilityLabel="立即锁定密码本" onPress={vault.lock} style={styles.headerButton}><SymbolView name={{ android: 'lock', ios: 'lock', web: 'lock' }} size={20} tintColor={colors.inkSoft} type="hierarchical" /></Pressable><Pressable accessibilityLabel="密码本安全设置" onPress={() => router.push('/vault/settings')} style={styles.headerButton}><SymbolView name={{ android: 'shield', ios: 'checkmark.shield', web: 'shield' }} size={20} tintColor={colors.life} type="hierarchical" /></Pressable></View>} />
      <AppKeyboardAvoidingView key="unlocked" mode="system" style={styles.flex}>
        <ScrollView contentContainerStyle={styles.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.hero}><View style={styles.heroSeal}><SymbolView name={{ android: 'key', ios: 'key', web: 'key' }} size={25} tintColor={colors.sun} type="hierarchical" /></View><Text style={styles.heroEyebrow}>PASSWORD VAULT</Text><Text style={styles.heroTitle}>密码本</Text><Text style={styles.heroText}>账号和密码会加密存储在本机。离开密码本后会立即锁定。</Text><View style={styles.heroRule} /></View>
        <View style={[styles.searchField, searchFocused && styles.searchFieldFocused]}>
          <View style={styles.searchIcon}><SymbolView name={{ android: 'search', ios: 'magnifyingglass', web: 'search' }} pointerEvents="none" size={17} tintColor={searchFocused ? colors.life : colors.inkFaint} type="hierarchical" /></View>
          <TextInput accessibilityLabel="搜索密码名称、账号或网址" autoCapitalize="none" autoCorrect={false} importantForAutofill="no" maxLength={256} onBlur={() => setSearchFocused(false)} onChangeText={setSearchQuery} onFocus={() => setSearchFocused(true)} placeholder="搜索名称、账号或网址" placeholderTextColor={colors.inkFaint} returnKeyType="search" style={styles.searchInput} textContentType="none" value={searchQuery} />
          {searchQuery ? <Pressable accessibilityLabel="清除密码本搜索" accessibilityRole="button" hitSlop={8} onPress={() => setSearchQuery('')} style={({ pressed }) => [styles.clearSearchButton, pressed && styles.clearSearchButtonPressed]}><SymbolView name={{ android: 'close', ios: 'xmark.circle.fill', web: 'close' }} pointerEvents="none" size={17} tintColor={colors.inkFaint} type="hierarchical" /></Pressable> : null}
        </View>
        <View style={styles.listHeading}><View><Text style={styles.sectionEyebrow}>{searching ? 'SEARCH RESULTS' : 'PASSWORDS'}</Text><Text accessibilityLiveRegion="polite" style={styles.sectionTitle}>{searching ? `${entries.length} 条匹配结果` : entries.length ? `${entries.length} 条密码记录` : '尚无密码记录'}</Text></View><Pressable accessibilityLabel="新建密码记录" onPress={() => router.push('/vault/entry')} style={styles.addButton}><SymbolView name={{ android: 'add', ios: 'plus', web: 'add' }} size={21} tintColor={colors.onLife} type="hierarchical" /></Pressable></View>
        {entries.length ? <View style={styles.entryList}>{entries.map((entry, index) => <Pressable key={entry.id} accessible accessibilityLabel="打开密码记录" accessibilityRole="button" onPress={() => router.push({ pathname: '/vault/entry', params: { id: entry.id } })} style={({ pressed }) => [styles.entryCard, index > 0 && styles.entryBorder, pressed && styles.pressed]}><View style={styles.entryMonogram}><Text style={styles.entryMonogramText}>{entry.name.slice(0, 1).toUpperCase()}</Text></View><View style={styles.entryCopy}><Text numberOfLines={1} style={styles.entryName}>{entry.name}</Text><Text numberOfLines={1} style={styles.entryUsername}>{entry.username || '未填写账号'}</Text></View><SymbolView name={{ android: 'chevron_right', ios: 'chevron.right', web: 'chevron_right' }} size={18} tintColor={colors.inkFaint} type="hierarchical" /></Pressable>)}</View> : <View style={styles.empty}><View style={styles.emptyIcon}><SymbolView name={searching ? { android: 'search_off', ios: 'magnifyingglass', web: 'search_off' } : { android: 'key', ios: 'key', web: 'key' }} size={32} tintColor={colors.life} type="hierarchical" /></View><Text style={styles.emptyTitle}>{searching ? '没有匹配的密码记录' : '密码本还是空的'}</Text><Text style={styles.emptyText}>{searching ? '支持按名称、账号或网址模糊匹配，可以尝试缩短关键词。' : '添加一条密码记录。名称、账号、密码、网址和备注都会加密存储。'}</Text><Pressable accessibilityRole="button" onPress={() => searching ? setSearchQuery('') : router.push('/vault/entry')} style={styles.emptyButton}><Text style={styles.emptyButtonText}>{searching ? '清除搜索' : '添加第一条密码'}</Text></Pressable></View>}
        </ScrollView>
      </AppKeyboardAvoidingView>
    </SafeAreaView>;
  }

  return <SafeAreaView style={styles.safeArea}>
    <VaultHeader onBack={() => router.back()} />
    <AppKeyboardAvoidingView key="auth" mode="system" style={styles.flex}>
      <ScrollView contentContainerStyle={styles.authContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.lockIllustration}><View style={styles.lockRing}><SymbolView name={{ android: 'lock', ios: 'lock.fill', web: 'lock' }} size={31} tintColor={colors.life} type="hierarchical" /></View></View>
        <Text style={styles.authTitle}>{creating ? '创建主密码' : '输入主密码'}</Text>
        <Text style={styles.authHint}>{creating ? '至少 6 个字符，忘记后无法找回。' : '解锁后即可查看密码记录。'}</Text>
        <View style={styles.authForm}>
          <TextInput accessibilityLabel="主密码" autoCapitalize="none" autoCorrect={false} editable={busy === null} importantForAutofill="no" onChangeText={setMasterPassword} placeholder="主密码" placeholderTextColor={colors.inkFaint} secureTextEntry style={styles.input} textContentType="none" value={masterPassword} />
          {creating ? <TextInput accessibilityLabel="再次输入主密码" autoCapitalize="none" autoCorrect={false} editable={busy === null} importantForAutofill="no" onChangeText={setConfirmation} placeholder="再次输入主密码" placeholderTextColor={colors.inkFaint} secureTextEntry style={[styles.input, styles.confirmationInput]} textContentType="none" value={confirmation} /> : null}
          <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void run(creating ? 'create' : 'unlock', () => creating ? vault.create(masterPassword, confirmation) : vault.unlock(masterPassword))} style={({ pressed }) => [styles.primaryButton, busy !== null && styles.disabled, pressed && styles.pressed]}><Text style={styles.primaryButtonText}>{busy === 'create' ? '正在创建…' : busy === 'unlock' ? '正在解锁…' : creating ? '创建密码本' : '解锁'}</Text></Pressable>
          {!creating && vault.biometricAvailable && vault.biometricEnabled ? <Pressable accessibilityRole="button" disabled={busy !== null} onPress={() => void run('unlock', vault.unlockWithBiometrics)} style={({ pressed }) => [styles.secondaryButton, busy !== null && styles.disabled, pressed && styles.pressed]}><SymbolView name={{ android: 'fingerprint', ios: 'faceid', web: 'fingerprint' }} size={21} tintColor={colors.life} type="hierarchical" /><Text style={styles.secondaryButtonText}>{busy === 'unlock' ? '正在解锁…' : '使用生物识别'}</Text></Pressable> : null}
        </View>
        {!creating ? <Pressable accessibilityRole="button" onPress={() => router.push('/vault/forgot-password' as RelativePathString)} style={styles.forgotButton}><Text style={styles.forgotText}>忘记主密码？</Text></Pressable> : null}
      </ScrollView>
    </AppKeyboardAvoidingView>
  </SafeAreaView>;
}

function VaultHeader({ onBack, right }: { onBack(): void; right?: ReactNode }) {
  return <View style={styles.header}><View style={styles.headerSide}><Pressable accessibilityLabel="返回" accessibilityRole="button" onPress={onBack} style={styles.headerButton}><SymbolView name={{ android: 'chevron_left', ios: 'chevron.left', web: 'chevron_left' }} size={22} tintColor={colors.inkSoft} type="hierarchical" /></Pressable></View><Text style={styles.headerTitle}>密码本</Text><View style={styles.headerRight}>{right}</View></View>;
}

function errorMessage(cause: unknown) { return cause instanceof Error ? cause.message : '请稍后重试。'; }

function normalizeSearchText(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/g, ' ').trim();
}

function fuzzyMatch(value: string, query: string): boolean {
  if (value.includes(query)) return true;
  let queryIndex = 0;
  for (const character of value) {
    if (character === query[queryIndex]) queryIndex += 1;
    if (queryIndex === query.length) return true;
  }
  return false;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 }, safeArea: { flex: 1, backgroundColor: colors.paper }, loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, loadingMark: { color: colors.life, fontFamily: typography.display, fontSize: 30 }, loadingText: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.caption },
  header: { minHeight: 56, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line }, headerSide: { width: 88, alignItems: 'flex-start' }, headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }, headerTitle: { flex: 1, color: colors.ink, fontFamily: typography.display, fontSize: 18, textAlign: 'center' }, headerRight: { width: 88, alignItems: 'flex-end' }, headerActions: { flexDirection: 'row' },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl }, hero: { overflow: 'hidden', padding: spacing.xl, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.lifeDeep }, heroSeal: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.onLifeLine, borderRadius: 26, backgroundColor: colors.onLifeLine }, heroEyebrow: { marginTop: spacing.lg, color: colors.onLifeMuted, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.4 }, heroTitle: { marginTop: spacing.xs, color: colors.onLife, fontFamily: typography.display, fontSize: 34 }, heroText: { maxWidth: 270, marginTop: spacing.sm, color: colors.onLifeMuted, fontSize: typography.size.caption, lineHeight: 19 }, heroRule: { position: 'absolute', right: -12, bottom: 24, width: 104, height: 2, backgroundColor: colors.sun },
  searchField: { height: 52, marginTop: spacing.lg, paddingLeft: 7, paddingRight: 6, flexDirection: 'row', alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderTopRightRadius: radius.lg, borderBottomLeftRadius: radius.lg, backgroundColor: colors.sheet }, searchFieldFocused: { borderColor: colors.life }, searchIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.lifeLight }, searchInput: { flex: 1, height: '100%', paddingHorizontal: spacing.sm, paddingVertical: 0, color: colors.ink, fontSize: typography.size.body }, clearSearchButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 }, clearSearchButtonPressed: { backgroundColor: colors.lifeLight },
  listHeading: { marginTop: spacing.xl, marginBottom: spacing.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: typography.size.meta, letterSpacing: 1.2 }, sectionTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 21 }, addButton: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderRadius: 23, backgroundColor: colors.life },
  entryList: { overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet }, entryCard: { minHeight: 76, paddingHorizontal: spacing.md, flexDirection: 'row', alignItems: 'center' }, entryBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.lineSoft }, entryMonogram: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: radius.md, borderBottomLeftRadius: radius.md, backgroundColor: colors.sunLight }, entryMonogramText: { color: colors.lifeDeep, fontFamily: typography.display, fontSize: 18 }, entryCopy: { flex: 1, marginHorizontal: spacing.md }, entryName: { color: colors.ink, fontSize: typography.size.body, fontWeight: '700' }, entryUsername: { marginTop: 5, color: colors.inkFaint, fontSize: typography.size.meta },
  empty: { padding: spacing.xl, alignItems: 'center', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.lineSoft, borderRadius: radius.lg, backgroundColor: colors.sheet }, emptyIcon: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center', borderRadius: 34, backgroundColor: colors.lifeLight }, emptyTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 20 }, emptyText: { maxWidth: 260, marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 19, textAlign: 'center' }, emptyButton: { minHeight: 44, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.lifeLight }, emptyButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  authContent: { padding: spacing.lg, paddingBottom: spacing.xxl }, lockIllustration: { marginTop: spacing.xl, alignItems: 'center' }, lockRing: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lifeLine, borderRadius: 38, backgroundColor: colors.sheet }, authTitle: { marginTop: spacing.lg, color: colors.ink, fontFamily: typography.display, fontSize: 28, lineHeight: 36, textAlign: 'center' }, authHint: { marginTop: spacing.sm, color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 18, textAlign: 'center' }, authForm: { marginTop: spacing.lg, padding: spacing.lg, borderTopRightRadius: radius.xl, borderBottomLeftRadius: radius.xl, backgroundColor: colors.sheet }, input: { minHeight: 50, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper, fontSize: typography.size.body }, confirmationInput: { marginTop: spacing.md }, primaryButton: { minHeight: 52, marginTop: spacing.lg, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life }, primaryButtonText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '800' }, secondaryButton: { minHeight: 50, marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lifeLine, borderRadius: radius.md }, secondaryButtonText: { color: colors.life, fontSize: typography.size.caption, fontWeight: '700' },
  forgotButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' }, forgotText: { color: colors.inkFaint, fontSize: typography.size.caption, textDecorationLine: 'underline' }, disabled: { opacity: 0.4 }, pressed: { opacity: 0.72 },
}));
