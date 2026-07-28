import { argon2idAsync } from '@noble/hashes/argon2.js';
import * as Crypto from 'expo-crypto';
import { strFromU8, strToU8 } from 'fflate';
import type { PasswordVaultEntry, PasswordVaultPayloadV1 } from '../domain/password-vault';
import { logPasswordVaultDiagnostic, passwordVaultErrorKind } from './password-vault-logging';

export const PASSWORD_VAULT_AUTH_ERROR = '主密码不正确或密码本已损坏';
export const PASSWORD_VAULT_MAX_FILE_BYTES = 4 * 1024 * 1024;
export const PASSWORD_VAULT_MAX_PAYLOAD_BYTES = 3 * 1024 * 1024;

const CURRENT_KDF = { algorithm: 'argon2id' as const, memoryCostKiB: 16_384, timeCost: 2, parallelism: 1, keyLength: 32 as const };
const KDF_LIMITS = { minMemoryCostKiB: 16_384, maxMemoryCostKiB: 262_144, minTimeCost: 1, maxTimeCost: 10, minParallelism: 1, maxParallelism: 4 };
const SALT_BYTES = 16;
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const DEK_BYTES = 32;
const MAX_ENTRIES = 10_000;
const WRAPPED_KEY_AAD = strToU8('still-alive/password-vault/wrapped-dek/v1');
const PAYLOAD_AAD = strToU8('still-alive/password-vault/payload/v1');

interface KdfConfigV1 {
  algorithm: 'argon2id';
  salt: string;
  memoryCostKiB: number;
  timeCost: number;
  parallelism: number;
  keyLength: 32;
}

interface SealedFieldV1 {
  algorithm: 'aes-256-gcm';
  nonce: string;
  ciphertext: string;
  tag: string;
}

export interface PasswordVaultEnvelopeV1 {
  version: 1;
  kdf: KdfConfigV1;
  wrappedKey: SealedFieldV1;
  payload: SealedFieldV1;
}

export interface UnlockedPasswordVault {
  dek: Uint8Array;
  envelope: PasswordVaultEnvelopeV1;
  payload: PasswordVaultPayloadV1;
}

export async function createPasswordVault(masterPassword: string): Promise<UnlockedPasswordVault> {
  logPasswordVaultDiagnostic('create.start');
  const dek = await Crypto.getRandomBytesAsync(DEK_BYTES);
  const salt = await Crypto.getRandomBytesAsync(SALT_BYTES);
  const kdf: KdfConfigV1 = { ...CURRENT_KDF, salt: encodeBase64(salt) };
  let kek: Uint8Array | null = null;
  let stage = 'derive';
  try {
    kek = await deriveKey(masterPassword, kdf);
    stage = 'wrap-key';
    const wrappedKey = await seal(dek, kek, WRAPPED_KEY_AAD);
    await verifyWrappedKey(wrappedKey, kek, dek);
    const payload = { schemaVersion: 1, entries: [] } satisfies PasswordVaultPayloadV1;
    stage = 'seal-payload';
    const sealedPayload = await seal(strToU8(JSON.stringify(payload)), dek, PAYLOAD_AAD);
    logPasswordVaultDiagnostic('create.success');
    return { dek, envelope: { version: 1, kdf, wrappedKey, payload: sealedPayload }, payload };
  } catch (cause) {
    logPasswordVaultDiagnostic('create.failed', { stage, error: passwordVaultErrorKind(cause) });
    dek.fill(0);
    throw cause;
  } finally {
    salt.fill(0);
    kek?.fill(0);
  }
}

export async function unlockPasswordVault(envelope: PasswordVaultEnvelopeV1, masterPassword: string): Promise<UnlockedPasswordVault> {
  logPasswordVaultDiagnostic('unlock.start', {
    memoryCostKiB: envelope.kdf?.memoryCostKiB,
    timeCost: envelope.kdf?.timeCost,
    parallelism: envelope.kdf?.parallelism,
  });
  let kek: Uint8Array | null = null;
  let dek: Uint8Array | null = null;
  let stage = 'validate-envelope';
  try {
    validatePasswordVaultEnvelope(envelope);
    stage = 'derive-kek';
    kek = await deriveKey(masterPassword, envelope.kdf);
    stage = 'unwrap-dek';
    dek = await open(envelope.wrappedKey, kek, WRAPPED_KEY_AAD);
    if (dek.byteLength !== DEK_BYTES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
    stage = 'decrypt-payload';
    const payload = await decryptPayload(envelope, dek);
    logPasswordVaultDiagnostic('unlock.success');
    return { dek, envelope, payload };
  } catch (cause) {
    logPasswordVaultDiagnostic('unlock.failed', { stage, error: passwordVaultErrorKind(cause) });
    dek?.fill(0);
    throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  } finally {
    kek?.fill(0);
  }
}

export async function unlockPasswordVaultWithKey(envelope: PasswordVaultEnvelopeV1, dek: Uint8Array): Promise<UnlockedPasswordVault> {
  logPasswordVaultDiagnostic('unlock-with-key.start');
  let stage = 'validate-envelope';
  try {
    validatePasswordVaultEnvelope(envelope);
    if (dek.byteLength !== DEK_BYTES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
    stage = 'decrypt-payload';
    const payload = await decryptPayload(envelope, dek);
    logPasswordVaultDiagnostic('unlock-with-key.success');
    return { dek, envelope, payload };
  } catch (cause) {
    logPasswordVaultDiagnostic('unlock-with-key.failed', { stage, error: passwordVaultErrorKind(cause) });
    throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  }
}

export async function encryptPasswordVaultPayload(session: UnlockedPasswordVault, payload: PasswordVaultPayloadV1): Promise<UnlockedPasswordVault> {
  logPasswordVaultDiagnostic('payload-encrypt.start');
  let stage = 'validate-payload';
  try {
    validatePayload(payload);
    const plaintext = strToU8(JSON.stringify(payload));
    if (plaintext.byteLength > PASSWORD_VAULT_MAX_PAYLOAD_BYTES) throw new Error('密码本内容过大，无法保存');
    stage = 'seal-payload';
    const envelope = { ...session.envelope, payload: await seal(plaintext, session.dek, PAYLOAD_AAD) };
    logPasswordVaultDiagnostic('payload-encrypt.success', { bytes: plaintext.byteLength });
    return { dek: session.dek, envelope, payload };
  } catch (cause) {
    logPasswordVaultDiagnostic('payload-encrypt.failed', { stage, error: passwordVaultErrorKind(cause) });
    throw cause;
  }
}

export async function changePasswordVaultMasterPassword(session: UnlockedPasswordVault, currentPassword: string, nextPassword: string): Promise<UnlockedPasswordVault> {
  logPasswordVaultDiagnostic('change-password.start');
  const verified = await unlockPasswordVault(session.envelope, currentPassword);
  try {
    if (!equalBytes(verified.dek, session.dek)) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  } finally {
    verified.dek.fill(0);
  }
  const salt = await Crypto.getRandomBytesAsync(SALT_BYTES);
  const kdf: KdfConfigV1 = { ...CURRENT_KDF, salt: encodeBase64(salt) };
  let kek: Uint8Array | null = null;
  try {
    kek = await deriveKey(nextPassword, kdf);
    const wrappedKey = await seal(session.dek, kek, WRAPPED_KEY_AAD);
    await verifyWrappedKey(wrappedKey, kek, session.dek);
    const envelope = { ...session.envelope, kdf, wrappedKey };
    logPasswordVaultDiagnostic('change-password.success');
    return { ...session, envelope };
  } finally {
    salt.fill(0);
    kek?.fill(0);
  }
}

export function parsePasswordVaultEnvelope(text: string): PasswordVaultEnvelopeV1 {
  const bytes = strToU8(text);
  if (bytes.byteLength > PASSWORD_VAULT_MAX_FILE_BYTES) {
    logPasswordVaultDiagnostic('envelope.parse.rejected', { reason: 'file-too-large', bytes: bytes.byteLength });
    throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  }
  let stage = 'json-parse';
  try {
    const envelope = JSON.parse(text) as unknown;
    stage = 'envelope-validate';
    validatePasswordVaultEnvelope(envelope);
    return envelope;
  } catch (cause) {
    logPasswordVaultDiagnostic('envelope.parse.failed', { stage, error: passwordVaultErrorKind(cause) });
    throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  }
}

export function validatePasswordVaultEnvelope(value: unknown): asserts value is PasswordVaultEnvelopeV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, ['version', 'kdf', 'wrappedKey', 'payload']) || value.version !== 1 || !isRecord(value.kdf) || !isRecord(value.wrappedKey) || !isRecord(value.payload)) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  const kdf = value.kdf;
  if (!hasOnlyKeys(kdf, ['algorithm', 'salt', 'memoryCostKiB', 'timeCost', 'parallelism', 'keyLength']) || kdf.algorithm !== 'argon2id' || kdf.keyLength !== DEK_BYTES || !integerInRange(kdf.memoryCostKiB, KDF_LIMITS.minMemoryCostKiB, KDF_LIMITS.maxMemoryCostKiB) || !integerInRange(kdf.timeCost, KDF_LIMITS.minTimeCost, KDF_LIMITS.maxTimeCost) || !integerInRange(kdf.parallelism, KDF_LIMITS.minParallelism, KDF_LIMITS.maxParallelism)) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  decodeBase64(kdf.salt, SALT_BYTES, SALT_BYTES);
  validateSealedField(value.wrappedKey, DEK_BYTES, DEK_BYTES);
  validateSealedField(value.payload, 1, PASSWORD_VAULT_MAX_PAYLOAD_BYTES);
}

export function serializePasswordVaultEnvelope(envelope: PasswordVaultEnvelopeV1): string {
  validatePasswordVaultEnvelope(envelope);
  const text = JSON.stringify(envelope);
  if (strToU8(text).byteLength > PASSWORD_VAULT_MAX_FILE_BYTES) throw new Error('密码本内容过大，无法保存');
  return text;
}

export function encodePasswordVaultKey(dek: Uint8Array): string {
  if (dek.byteLength !== DEK_BYTES) throw new Error('密码本密钥格式无效');
  return encodeBase64(dek);
}

export function decodePasswordVaultKey(value: string): Uint8Array {
  return decodeBase64(value, DEK_BYTES, DEK_BYTES);
}

async function deriveKey(masterPassword: string, kdf: KdfConfigV1): Promise<Uint8Array> {
  const password = strToU8(masterPassword);
  const salt = decodeBase64(kdf.salt, SALT_BYTES, SALT_BYTES);
  try {
    return await argon2idAsync(password, salt, {
      t: kdf.timeCost,
      m: kdf.memoryCostKiB,
      p: kdf.parallelism,
      dkLen: kdf.keyLength,
      maxmem: kdf.memoryCostKiB * 256,
      asyncTick: 8,
    });
  } finally {
    password.fill(0);
    salt.fill(0);
  }
}

async function decryptPayload(envelope: PasswordVaultEnvelopeV1, dek: Uint8Array): Promise<PasswordVaultPayloadV1> {
  let plaintext: Uint8Array | null = null;
  let stage = 'aead-open';
  try {
    plaintext = await open(envelope.payload, dek, PAYLOAD_AAD);
    if (plaintext.byteLength > PASSWORD_VAULT_MAX_PAYLOAD_BYTES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
    stage = 'json-parse';
    const payload = JSON.parse(strFromU8(plaintext)) as unknown;
    stage = 'payload-validate';
    validatePayload(payload);
    return payload;
  } catch (cause) {
    logPasswordVaultDiagnostic('payload-decrypt.failed', { stage, error: passwordVaultErrorKind(cause) });
    throw cause;
  } finally {
    plaintext?.fill(0);
  }
}

async function seal(plaintext: Uint8Array, keyBytes: Uint8Array, additionalData: Uint8Array): Promise<SealedFieldV1> {
  let stage = 'import-key';
  try {
    const key = await Crypto.AESEncryptionKey.import(encodeBase64(keyBytes), 'base64');
    stage = 'encrypt';
    const sealed = await Crypto.aesEncryptAsync(plaintext, key, { additionalData, nonce: { length: NONCE_BYTES }, tagLength: TAG_BYTES });
    stage = 'extract-parts';
    return {
      algorithm: 'aes-256-gcm',
      nonce: await sealed.iv('base64'),
      ciphertext: encodeBase64(await sealed.ciphertext()),
      tag: await sealed.tag('base64'),
    };
  } catch (cause) {
    logPasswordVaultDiagnostic('aes.seal.failed', { stage, error: passwordVaultErrorKind(cause) });
    throw cause;
  }
}

async function open(field: SealedFieldV1, keyBytes: Uint8Array, additionalData: Uint8Array): Promise<Uint8Array> {
  let stage = 'import-key';
  try {
    const key = await Crypto.AESEncryptionKey.import(encodeBase64(keyBytes), 'base64');
    stage = 'decode-ciphertext';
    const ciphertext = decodeBase64(field.ciphertext, 1, PASSWORD_VAULT_MAX_PAYLOAD_BYTES);
    stage = 'decode-tag';
    const tag = decodeBase64(field.tag, TAG_BYTES, TAG_BYTES);
    stage = 'combine-ciphertext-tag';
    const ciphertextWithTag = new Uint8Array(ciphertext.byteLength + tag.byteLength);
    ciphertextWithTag.set(ciphertext);
    ciphertextWithTag.set(tag, ciphertext.byteLength);
    stage = 'rebuild-sealed-data';
    // Native iOS/Android accept a numeric tag length here, but not a base64 string tag.
    const sealed = Crypto.AESSealedData.fromParts(field.nonce, encodeBase64(ciphertextWithTag), TAG_BYTES);
    stage = 'decrypt';
    return await Crypto.aesDecryptAsync(sealed, key, { additionalData, output: 'bytes' });
  } catch (cause) {
    logPasswordVaultDiagnostic('aes.open.failed', { stage, error: passwordVaultErrorKind(cause) });
    throw cause;
  }
}

async function verifyWrappedKey(field: SealedFieldV1, kek: Uint8Array, expectedDek: Uint8Array): Promise<void> {
  let verified: Uint8Array | null = null;
  try {
    verified = await open(field, kek, WRAPPED_KEY_AAD);
    if (!equalBytes(verified, expectedDek)) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  } catch {
    throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  } finally {
    verified?.fill(0);
  }
}

function validateSealedField(value: Record<string, unknown>, minCiphertextBytes: number, maxCiphertextBytes: number): void {
  if (!hasOnlyKeys(value, ['algorithm', 'nonce', 'ciphertext', 'tag']) || value.algorithm !== 'aes-256-gcm') throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  decodeBase64(value.nonce, NONCE_BYTES, NONCE_BYTES);
  decodeBase64(value.tag, TAG_BYTES, TAG_BYTES);
  decodeBase64(value.ciphertext, minCiphertextBytes, maxCiphertextBytes);
}

function validatePayload(value: unknown): asserts value is PasswordVaultPayloadV1 {
  if (!isRecord(value) || !hasOnlyKeys(value, ['schemaVersion', 'entries']) || value.schemaVersion !== 1 || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  const ids = new Set<string>();
  for (const item of value.entries) {
    if (!isRecord(item) || !hasOnlyKeys(item, ['id', 'name', 'username', 'password', 'url', 'note', 'createdAt', 'updatedAt']) || !validString(item.id, 1, 128) || ids.has(item.id) || !validString(item.name, 1, 256) || !validString(item.username, 0, 1024) || !validString(item.password, 1, 4096) || !validString(item.url, 0, 4096) || !validString(item.note, 0, 65_536) || !validIsoDate(item.createdAt) || !validIsoDate(item.updatedAt)) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
    ids.add(item.id);
  }
}

function decodeBase64(value: unknown, minBytes: number, maxBytes: number): Uint8Array {
  if (typeof value !== 'string' || value.length === 0 || value.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const byteLength = (value.length / 4) * 3 - padding;
  if (byteLength < minBytes || byteLength > maxBytes) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  const output = new Uint8Array(byteLength);
  let offset = 0;
  for (let index = 0; index < value.length; index += 4) {
    const a = base64Value(value[index]);
    const b = base64Value(value[index + 1]);
    const c = value[index + 2] === '=' ? 0 : base64Value(value[index + 2]);
    const d = value[index + 3] === '=' ? 0 : base64Value(value[index + 3]);
    const combined = (a << 18) | (b << 12) | (c << 6) | d;
    if (offset < byteLength) output[offset++] = (combined >>> 16) & 0xff;
    if (offset < byteLength) output[offset++] = (combined >>> 8) & 0xff;
    if (offset < byteLength) output[offset++] = combined & 0xff;
  }
  if (encodeBase64(output) !== value) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  return output;
}

function encodeBase64(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const combined = (a << 16) | (b << 8) | c;
    result += alphabet[(combined >>> 18) & 63] + alphabet[(combined >>> 12) & 63] + (index + 1 < bytes.length ? alphabet[(combined >>> 6) & 63] : '=') + (index + 2 < bytes.length ? alphabet[combined & 63] : '=');
  }
  return result;
}

function base64Value(character: string): number {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const value = alphabet.indexOf(character);
  if (value < 0) throw new Error(PASSWORD_VAULT_AUTH_ERROR);
  return value;
}

function validString(value: unknown, minLength: number, maxLength: number): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

function validIsoDate(value: unknown): value is string {
  return validString(value, 20, 40) && !Number.isNaN(Date.parse(value));
}

function integerInRange(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= minimum && value <= maximum;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, keys: string[]): boolean {
  const allowed = new Set(keys);
  return Object.keys(value).length === keys.length && Object.keys(value).every((key) => allowed.has(key));
}

function equalBytes(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function validatePasswordVaultEntry(entry: PasswordVaultEntry): void {
  validatePayload({ schemaVersion: 1, entries: [entry] });
}
