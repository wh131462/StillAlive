import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'still_alive_ai_key_v1_';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export const AI_PROVIDER_ID_PATTERN = /^[a-z0-9_-]{1,64}$/i;

export function createAiProviderId(): string {
  return `ai_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function keyHintOf(key: string): string {
  const trimmed = key.trim();
  return trimmed.length > 4 ? `…${trimmed.slice(-4)}` : '';
}

export function validateAiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length < 8) throw new Error('API Key 太短，请检查是否复制完整');
  if (trimmed.length > 512) throw new Error('API Key 过长，请检查输入');
  if (/\s/u.test(trimmed)) throw new Error('API Key 不能包含空格或换行');
  return trimmed;
}

export async function saveAiKey(providerId: string, key: string): Promise<string> {
  assertProviderId(providerId);
  const normalized = validateAiKey(key);
  await SecureStore.setItemAsync(`${KEY_PREFIX}${providerId}`, normalized, OPTIONS);
  return keyHintOf(normalized);
}

export async function readAiKey(providerId: string): Promise<string | null> {
  assertProviderId(providerId);
  return SecureStore.getItemAsync(`${KEY_PREFIX}${providerId}`, OPTIONS);
}

export async function deleteAiKey(providerId: string): Promise<void> {
  assertProviderId(providerId);
  await SecureStore.deleteItemAsync(`${KEY_PREFIX}${providerId}`, OPTIONS);
}

export async function deleteAiKeys(providerIds: string[]): Promise<void> {
  await Promise.all(providerIds.map((providerId) => deleteAiKey(providerId).catch(() => undefined)));
}

function assertProviderId(providerId: string): void {
  if (!AI_PROVIDER_ID_PATTERN.test(providerId)) throw new Error('服务商标识无效');
}
