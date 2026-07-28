import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import * as Crypto from 'expo-crypto';
import * as ScreenCapture from 'expo-screen-capture';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { colors, typography } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';
import type { PasswordVaultEntry, PasswordVaultEntryDraft } from '../domain/password-vault';
import {
  PASSWORD_VAULT_AUTH_ERROR,
  changePasswordVaultMasterPassword,
  createPasswordVault,
  encryptPasswordVaultPayload,
  unlockPasswordVault,
  unlockPasswordVaultWithKey,
} from '../data/password-vault-crypto';
import type { UnlockedPasswordVault } from '../data/password-vault-crypto';
import {
  canUsePasswordVaultBiometrics,
  deletePasswordVaultStorage,
  disablePasswordVaultBiometrics,
  enablePasswordVaultBiometrics,
  passwordVaultBiometricsEnabled,
  passwordVaultExists,
  readPasswordVaultBiometricKey,
  readPasswordVaultEnvelope,
  writePasswordVaultEnvelope,
} from '../data/password-vault-storage';
import { logPasswordVaultDiagnostic, passwordVaultErrorKind } from '../data/password-vault-logging';

type PasswordVaultPhase = 'loading' | 'locked' | 'unlocked';

interface PasswordVaultStateValue {
  phase: PasswordVaultPhase;
  hasVault: boolean;
  entries: PasswordVaultEntry[];
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  privacyHidden: boolean;
  create(masterPassword: string, confirmation: string): Promise<void>;
  unlock(masterPassword: string): Promise<void>;
  unlockWithBiometrics(): Promise<void>;
  lock(): void;
  saveEntry(id: string | null, draft: PasswordVaultEntryDraft): Promise<void>;
  deleteEntry(id: string): Promise<void>;
  setBiometricsEnabled(enabled: boolean): Promise<void>;
  changeMasterPassword(currentPassword: string, nextPassword: string, confirmation: string): Promise<void>;
  deleteVault(masterPassword: string): Promise<void>;
  forceDeleteVault(): Promise<void>;
}

const PasswordVaultStateContext = createContext<PasswordVaultStateValue | null>(null);

export function PasswordVaultStateProvider({ children }: PropsWithChildren) {
  const sessionRef = useRef<UnlockedPasswordVault | null>(null);
  const lifecycleVersionRef = useRef(0);
  const appStateRef = useRef(AppState.currentState ?? 'active');
  const [phase, setPhase] = useState<PasswordVaultPhase>('loading');
  const [hasVault, setHasVault] = useState(false);
  const [entries, setEntries] = useState<PasswordVaultEntry[]>([]);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [privacyHidden, setPrivacyHidden] = useState(false);
  const biometricAvailable = canUsePasswordVaultBiometrics();

  ScreenCapture.usePreventScreenCapture('still-alive-password-vault');

  const lock = useCallback(() => {
    logPasswordVaultDiagnostic('state.lock');
    lifecycleVersionRef.current += 1;
    sessionRef.current?.dek.fill(0);
    sessionRef.current = null;
    setEntries([]);
    setPhase('locked');
  }, []);

  useEffect(() => {
    let active = true;
    void passwordVaultBiometricsEnabled().catch(() => false).then((enabled) => {
      if (!active) return;
      const hasStoredVault = passwordVaultExists();
      logPasswordVaultDiagnostic('state.initialize', { hasVault: hasStoredVault, biometricEnabled: enabled });
      setHasVault(hasStoredVault);
      setBiometricEnabledState(enabled);
      setPhase('locked');
    });
    void ScreenCapture.enableAppSwitcherProtectionAsync(1).catch(() => undefined);
    const subscription = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
      if (nextState !== 'active') {
        setPrivacyHidden(true);
        lock();
      } else {
        setPrivacyHidden(false);
      }
    });
    return () => {
      active = false;
      subscription.remove();
      lock();
      void ScreenCapture.disableAppSwitcherProtectionAsync().catch(() => undefined);
    };
  }, [lock]);

  const isActiveLifecycle = useCallback((version: number) => (
    version === lifecycleVersionRef.current && appStateRef.current === 'active'
  ), []);

  const assertActiveLifecycle = useCallback((version: number) => {
    if (!isActiveLifecycle(version)) throw new Error('密码本已经锁定');
  }, [isActiveLifecycle]);

  const enterSession = useCallback((session: UnlockedPasswordVault, lifecycleVersion: number) => {
    try {
      assertActiveLifecycle(lifecycleVersion);
    } catch (cause) {
      session.dek.fill(0);
      throw cause;
    }
    sessionRef.current?.dek.fill(0);
    sessionRef.current = session;
    setEntries(session.payload.entries);
    setPhase('unlocked');
  }, [assertActiveLifecycle]);

  const create = useCallback(async (masterPassword: string, confirmation: string) => {
    logPasswordVaultDiagnostic('state.create.start');
    validateNewMasterPassword(masterPassword, confirmation);
    if (passwordVaultExists()) throw new Error('密码本已经存在');
    const lifecycleVersion = lifecycleVersionRef.current;
    const session = await createPasswordVault(masterPassword);
    try {
      assertActiveLifecycle(lifecycleVersion);
      await writePasswordVaultEnvelope(session.envelope, async (saved) => { await unlockPasswordVaultWithKey(saved, session.dek); });
      setHasVault(true);
      if (!isActiveLifecycle(lifecycleVersion)) {
        session.dek.fill(0);
        return;
      }
      enterSession(session, lifecycleVersion);
    } catch (cause) {
      logPasswordVaultDiagnostic('state.create.failed', { error: passwordVaultErrorKind(cause) });
      session.dek.fill(0);
      setHasVault(passwordVaultExists());
      throw cause;
    }
  }, [assertActiveLifecycle, enterSession, isActiveLifecycle]);

  const unlock = useCallback(async (masterPassword: string) => {
    logPasswordVaultDiagnostic('state.unlock.start');
    const lifecycleVersion = lifecycleVersionRef.current;
    try {
      enterSession(await unlockPasswordVault(await readPasswordVaultEnvelope(), masterPassword), lifecycleVersion);
      logPasswordVaultDiagnostic('state.unlock.success');
    } catch (cause) {
      logPasswordVaultDiagnostic('state.unlock.failed', { error: passwordVaultErrorKind(cause) });
      throw cause;
    }
  }, [enterSession]);

  const unlockWithBiometrics = useCallback(async () => {
    logPasswordVaultDiagnostic('state.biometric-unlock.start');
    const dek = await readPasswordVaultBiometricKey();
    if (!dek) {
      await disablePasswordVaultBiometrics().catch(() => undefined);
      setBiometricEnabledState(false);
      throw new Error('快捷解锁已失效，请使用主密码');
    }
    try {
      const lifecycleVersion = lifecycleVersionRef.current;
      enterSession(await unlockPasswordVaultWithKey(await readPasswordVaultEnvelope(), dek), lifecycleVersion);
    } catch (cause) {
      logPasswordVaultDiagnostic('state.biometric-unlock.failed', { error: passwordVaultErrorKind(cause) });
      dek.fill(0);
      if (cause instanceof Error && cause.message === '密码本已经锁定') throw cause;
      await disablePasswordVaultBiometrics().catch(() => undefined);
      setBiometricEnabledState(false);
      throw new Error(cause instanceof Error && cause.message === '主密码不正确或密码本已损坏' ? cause.message : '快捷解锁已失效，请使用主密码');
    }
  }, [enterSession]);

  const saveSessionPayload = useCallback(async (payloadEntries: PasswordVaultEntry[]) => {
    const current = sessionRef.current;
    if (!current) throw new Error('密码本已经锁定');
    const lifecycleVersion = lifecycleVersionRef.current;
    try {
      const next = await encryptPasswordVaultPayload(current, { schemaVersion: 1, entries: payloadEntries });
      assertActiveLifecycle(lifecycleVersion);
      if (sessionRef.current !== current) throw new Error('密码本已经锁定');
      await writePasswordVaultEnvelope(next.envelope, async (saved) => {
        await unlockPasswordVaultWithKey(saved, next.dek);
      });
      if (!isActiveLifecycle(lifecycleVersion) || sessionRef.current !== current) return;
      sessionRef.current = next;
      setEntries(next.payload.entries);
    } catch (cause) {
      logPasswordVaultDiagnostic('state.save.failed', { error: passwordVaultErrorKind(cause) });
      if (cause instanceof Error && cause.message === PASSWORD_VAULT_AUTH_ERROR) lock();
      throw cause;
    }
  }, [assertActiveLifecycle, isActiveLifecycle, lock]);

  const saveEntry = useCallback(async (id: string | null, draft: PasswordVaultEntryDraft) => {
    const current = sessionRef.current;
    if (!current) throw new Error('密码本已经锁定');
    const name = draft.name.trim();
    if (!name) throw new Error('请输入名称');
    if (!draft.password) throw new Error('请输入密码');
    const now = new Date().toISOString();
    const existing = id ? current.payload.entries.find((item) => item.id === id) : null;
    if (id && !existing) throw new Error('这条密码记录不存在');
    const entry: PasswordVaultEntry = {
      id: existing?.id ?? Crypto.randomUUID(),
      name,
      username: draft.username,
      password: draft.password,
      url: draft.url,
      note: draft.note,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    };
    const nextEntries = existing ? current.payload.entries.map((item) => item.id === existing.id ? entry : item) : [entry, ...current.payload.entries];
    await saveSessionPayload(nextEntries);
  }, [saveSessionPayload]);

  const deleteEntry = useCallback(async (id: string) => {
    const current = sessionRef.current;
    if (!current) throw new Error('密码本已经锁定');
    if (!current.payload.entries.some((item) => item.id === id)) throw new Error('这条密码记录不存在');
    await saveSessionPayload(current.payload.entries.filter((item) => item.id !== id));
  }, [saveSessionPayload]);

  const setBiometricsEnabled = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const current = sessionRef.current;
      if (!current) throw new Error('密码本已经锁定');
      await enablePasswordVaultBiometrics(current.dek);
    } else {
      await disablePasswordVaultBiometrics();
    }
    setBiometricEnabledState(enabled);
  }, []);

  const changeMasterPassword = useCallback(async (currentPassword: string, nextPassword: string, confirmation: string) => {
    validateNewMasterPassword(nextPassword, confirmation);
    const current = sessionRef.current;
    if (!current) throw new Error('密码本已经锁定');
    const lifecycleVersion = lifecycleVersionRef.current;
    const next = await changePasswordVaultMasterPassword(current, currentPassword, nextPassword);
    assertActiveLifecycle(lifecycleVersion);
    if (sessionRef.current !== current) throw new Error('密码本已经锁定');
    await writePasswordVaultEnvelope(next.envelope, async (saved) => { await unlockPasswordVaultWithKey(saved, next.dek); });
    if (!isActiveLifecycle(lifecycleVersion) || sessionRef.current !== current) return;
    sessionRef.current = next;
  }, [assertActiveLifecycle, isActiveLifecycle]);

  const forceDeleteVault = useCallback(async () => {
    lock();
    await deletePasswordVaultStorage();
    setHasVault(false);
    setBiometricEnabledState(false);
  }, [lock]);

  const deleteVault = useCallback(async (masterPassword: string) => {
    const lifecycleVersion = lifecycleVersionRef.current;
    const envelope = sessionRef.current?.envelope ?? await readPasswordVaultEnvelope();
    const verified = await unlockPasswordVault(envelope, masterPassword);
    verified.dek.fill(0);
    assertActiveLifecycle(lifecycleVersion);
    await forceDeleteVault();
  }, [assertActiveLifecycle, forceDeleteVault]);

  const value = useMemo<PasswordVaultStateValue>(() => ({
    phase,
    hasVault,
    entries,
    biometricAvailable,
    biometricEnabled,
    privacyHidden,
    create,
    unlock,
    unlockWithBiometrics,
    lock,
    saveEntry,
    deleteEntry,
    setBiometricsEnabled,
    changeMasterPassword,
    deleteVault,
    forceDeleteVault,
  }), [biometricAvailable, biometricEnabled, changeMasterPassword, create, deleteEntry, deleteVault, entries, forceDeleteVault, hasVault, lock, phase, privacyHidden, saveEntry, setBiometricsEnabled, unlock, unlockWithBiometrics]);

  return <PasswordVaultStateContext.Provider value={value}>{children}{privacyHidden ? <PrivacyCover /> : null}</PasswordVaultStateContext.Provider>;
}

export function usePasswordVaultState(): PasswordVaultStateValue {
  const value = useContext(PasswordVaultStateContext);
  if (!value) throw new Error('PasswordVaultStateProvider is missing');
  return value;
}

function validateNewMasterPassword(password: string, confirmation: string): void {
  if (password.length < 6) throw new Error('主密码至少需要 6 个字符');
  if (password !== confirmation) throw new Error('两次输入的主密码不一致');
}

function PrivacyCover() {
  return <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={styles.privacyCover}><Text style={styles.privacyMark}>仍在</Text><Text style={styles.privacyText}>密码本已锁定</Text></View>;
}

const styles = createThemedStyles(() => ({
  privacyCover: { ...StyleSheet.absoluteFill, zIndex: 999, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
  privacyMark: { color: colors.life, fontFamily: typography.display, fontSize: 30 },
  privacyText: { marginTop: 8, color: colors.inkFaint, fontSize: typography.size.caption },
}));
