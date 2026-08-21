import { File, Paths } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { strFromU8 } from 'fflate';
import {
  PASSWORD_VAULT_AUTH_ERROR,
  PASSWORD_VAULT_MAX_FILE_BYTES,
  decodePasswordVaultKey,
  encodePasswordVaultKey,
  parsePasswordVaultEnvelope,
  serializePasswordVaultEnvelope,
} from './password-vault-crypto';
import type { PasswordVaultEnvelopeV1 } from './password-vault-crypto';
import { logPasswordVaultDiagnostic, passwordVaultErrorKind } from './password-vault-logging';

const VAULT_FILE_NAME = 'vault.enc';
const VAULT_TEMP_FILE_NAME = 'vault.enc.tmp';
const VAULT_BACKUP_FILE_NAME = 'vault.enc.bak';
const BIOMETRIC_KEY = 'still_alive_vault_dek_v1';
const BIOMETRIC_MARKER_KEY = 'still_alive_vault_biometric_v1';
const BIOMETRIC_OPTIONS: SecureStore.SecureStoreOptions = {
  authenticationPrompt: '验证身份以解锁密码本',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  requireAuthentication: true,
};
const BIOMETRIC_MARKER_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export function passwordVaultExists(): boolean {
  return vaultFile().exists || backupFile().exists;
}

export async function readPasswordVaultEnvelope(): Promise<PasswordVaultEnvelopeV1> {
  logPasswordVaultDiagnostic('storage.read-envelope.start');
  try {
    const file = await resolveReadableVaultFile();
    const text = await file.text();
    const envelope = parsePasswordVaultEnvelope(text);
    logPasswordVaultDiagnostic('storage.read-envelope.success', { chars: text.length });
    return envelope;
  } catch (cause) {
    logPasswordVaultDiagnostic('storage.read-envelope.failed', { error: passwordVaultErrorKind(cause) });
    throw cause;
  }
}

export async function readPasswordVaultBytes(): Promise<Uint8Array | null> {
  if (!passwordVaultExists()) {
    logPasswordVaultDiagnostic('storage.read-bytes.missing');
    return null;
  }
  const file = await resolveReadableVaultFile();
  const bytes = await file.bytes();
  parsePasswordVaultEnvelope(strFromU8(bytes));
  logPasswordVaultDiagnostic('storage.read-bytes.success', { bytes: bytes.byteLength });
  return bytes;
}

export function parsePasswordVaultBytes(bytes: Uint8Array): PasswordVaultEnvelopeV1 {
  if (bytes.byteLength > PASSWORD_VAULT_MAX_FILE_BYTES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  return parsePasswordVaultEnvelope(strFromU8(bytes));
}

export async function writePasswordVaultEnvelope(
  envelope: PasswordVaultEnvelopeV1,
  verify: (saved: PasswordVaultEnvelopeV1) => Promise<void>,
  afterCommit?: () => Promise<void>,
): Promise<void> {
  logPasswordVaultDiagnostic('storage.write.start');
  const file = vaultFile();
  const temporary = temporaryFile();
  const backup = backupFile();
  const text = serializePasswordVaultEnvelope(envelope);
  const hadOriginal = file.exists;
  let replacementStarted = false;
  if (temporary.exists) temporary.delete();
  temporary.create({ overwrite: true });
  try {
    logPasswordVaultDiagnostic('storage.write.stage', { stage: 'write-temp' });
    temporary.write(text);
    const staged = parseWrittenEnvelope(await temporary.text(), text);
    logPasswordVaultDiagnostic('storage.write.stage', { stage: 'verify-temp' });
    await verify(staged);
    if (backup.exists) backup.delete();
    if (file.exists) await file.copy(backup, { overwrite: true });
    replacementStarted = true;
    logPasswordVaultDiagnostic('storage.write.stage', { stage: 'replace-main' });
    await temporary.move(file, { overwrite: true });
    const committed = parseWrittenEnvelope(await file.text(), text);
    logPasswordVaultDiagnostic('storage.write.stage', { stage: 'verify-main' });
    await verify(committed);
    await afterCommit?.();
    if (backup.exists) backup.delete();
  } catch (cause) {
    logPasswordVaultDiagnostic('storage.write.failed', { error: passwordVaultErrorKind(cause), replacementStarted });
    if (!replacementStarted) {
      // 正式文件尚未变化，保留原件。
    } else if (backup.exists) {
      if (file.exists) file.delete();
      await backup.copy(file, { overwrite: true });
      try { backup.delete(); } catch { /* 正式文件已经恢复，残留副本可在下次读取时清理。 */ }
    } else if (!hadOriginal && file.exists) {
      file.delete();
    }
    throw cause;
  } finally {
    // File.move() mutates the source File object's URI to the destination URI.
    const leftoverTemporary = temporaryFile();
    if (leftoverTemporary.exists) leftoverTemporary.delete();
  }
  logPasswordVaultDiagnostic('storage.write.success', {
    mainExists: vaultFile().exists,
    temporaryExists: temporaryFile().exists,
    backupExists: backupFile().exists,
  });
}

export async function replacePasswordVaultEnvelope(bytes: Uint8Array, verify: (saved: PasswordVaultEnvelopeV1) => Promise<void>): Promise<void> {
  const envelope = parsePasswordVaultBytes(bytes);
  await writePasswordVaultEnvelope(envelope, verify, disablePasswordVaultBiometrics);
}

export async function deletePasswordVaultStorage(): Promise<void> {
  await disablePasswordVaultBiometrics();
  for (const file of [temporaryFile(), backupFile(), vaultFile()]) if (file.exists) file.delete();
}

export function canUsePasswordVaultBiometrics(): boolean {
  return SecureStore.canUseBiometricAuthentication();
}

export async function passwordVaultBiometricsEnabled(): Promise<boolean> {
  return await SecureStore.getItemAsync(BIOMETRIC_MARKER_KEY, BIOMETRIC_MARKER_OPTIONS) === '1';
}

export async function enablePasswordVaultBiometrics(dek: Uint8Array): Promise<void> {
  logPasswordVaultDiagnostic('biometric.enable.start');
  if (!canUsePasswordVaultBiometrics()) throw new Error('当前设备未配置可用的生物识别');
  try {
    await SecureStore.setItemAsync(BIOMETRIC_KEY, encodePasswordVaultKey(dek), BIOMETRIC_OPTIONS);
    await SecureStore.setItemAsync(BIOMETRIC_MARKER_KEY, '1', BIOMETRIC_MARKER_OPTIONS);
    logPasswordVaultDiagnostic('biometric.enable.success');
  } catch (cause) {
    logPasswordVaultDiagnostic('biometric.enable.failed', { error: passwordVaultErrorKind(cause) });
    await disablePasswordVaultBiometrics().catch(() => undefined);
    throw cause;
  }
}

export async function readPasswordVaultBiometricKey(): Promise<Uint8Array | null> {
  logPasswordVaultDiagnostic('biometric.read.start');
  const value = await SecureStore.getItemAsync(BIOMETRIC_KEY, BIOMETRIC_OPTIONS);
  logPasswordVaultDiagnostic(value ? 'biometric.read.success' : 'biometric.read.missing');
  return value ? decodePasswordVaultKey(value) : null;
}

export async function disablePasswordVaultBiometrics(): Promise<void> {
  logPasswordVaultDiagnostic('biometric.disable.start');
  await Promise.all([
    SecureStore.deleteItemAsync(BIOMETRIC_KEY, BIOMETRIC_OPTIONS),
    SecureStore.deleteItemAsync(BIOMETRIC_MARKER_KEY, BIOMETRIC_MARKER_OPTIONS),
  ]);
  logPasswordVaultDiagnostic('biometric.disable.success');
}

export function isPasswordVaultBiometricCancellation(cause: unknown): boolean {
  if (!(cause instanceof Error)) return false;
  return cause.message.includes('User canceled the authentication') || cause.message.includes('User canceled the operation');
}

function vaultFile(): File { return new File(Paths.document, VAULT_FILE_NAME); }
function temporaryFile(): File { return new File(Paths.document, VAULT_TEMP_FILE_NAME); }
function backupFile(): File { return new File(Paths.document, VAULT_BACKUP_FILE_NAME); }

function parseWrittenEnvelope(text: string, expectedText: string): PasswordVaultEnvelopeV1 {
  const envelope = parsePasswordVaultEnvelope(text);
  if (serializePasswordVaultEnvelope(envelope) !== expectedText) throw new Error('密码本文件校验失败');
  return envelope;
}

async function resolveReadableVaultFile(): Promise<File> {
  const file = vaultFile();
  const backup = backupFile();
  if (file.exists) {
    let readable = false;
    try {
      if (file.size > PASSWORD_VAULT_MAX_FILE_BYTES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
      parsePasswordVaultEnvelope(await file.text());
      readable = true;
    } catch (cause) {
      logPasswordVaultDiagnostic('storage.read.main-invalid', { error: passwordVaultErrorKind(cause) });
      // 结构损坏时尝试回滚到上一次已验证的密文。
    }
    if (readable) {
      if (backup.exists) {
        logPasswordVaultDiagnostic('storage.read.cleanup-rollback');
        backup.delete();
      }
      logPasswordVaultDiagnostic('storage.read.main-valid');
      return file;
    }
  }
  if (!backup.exists || backup.size > PASSWORD_VAULT_MAX_FILE_BYTES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  parsePasswordVaultEnvelope(await backup.text());
  logPasswordVaultDiagnostic('storage.read.fallback-rollback');
  await backup.copy(file, { overwrite: true });
  parsePasswordVaultEnvelope(await file.text());
  backup.delete();
  return file;
}
