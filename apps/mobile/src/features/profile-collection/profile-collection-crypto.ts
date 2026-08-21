import type { ProfileCollectionCryptoCommand, ProfileCollectionCryptoResult } from './profile-collection-crypto.types';

export const isNativeProfileCollectionCryptoAvailable = false;

export async function executeProfileCollectionCrypto(command: ProfileCollectionCryptoCommand): Promise<ProfileCollectionCryptoResult> {
  return { id: command.id, ok: false, error: '当前平台不支持本机资料加密' };
}
