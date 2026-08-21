import * as SecureStore from 'expo-secure-store';

const KEY_PREFIX = 'still_alive_profile_collection_v1_';
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

export async function saveProfileCollectionPrivateKey(requestId: string, privateKeyJwk: string): Promise<void> {
  validateRequestId(requestId);
  if (!privateKeyJwk || privateKeyJwk.length > 2048) throw new Error('邀请私钥无效');
  await SecureStore.setItemAsync(`${KEY_PREFIX}${requestId}`, privateKeyJwk, OPTIONS);
}

export async function readProfileCollectionPrivateKey(requestId: string): Promise<string | null> {
  validateRequestId(requestId);
  return SecureStore.getItemAsync(`${KEY_PREFIX}${requestId}`, OPTIONS);
}

export async function deleteProfileCollectionPrivateKey(requestId: string): Promise<void> {
  validateRequestId(requestId);
  await SecureStore.deleteItemAsync(`${KEY_PREFIX}${requestId}`, OPTIONS);
}

export async function deleteProfileCollectionPrivateKeys(requestIds: string[]): Promise<void> {
  await Promise.all(requestIds.map((requestId) => deleteProfileCollectionPrivateKey(requestId).catch(() => undefined)));
}

function validateRequestId(value: string): void {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new Error('邀请标识无效');
}

