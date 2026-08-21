import { requireOptionalNativeModule } from 'expo';
import type { ProfileCollectionCryptoCommand, ProfileCollectionCryptoResult } from './profile-collection-crypto.types';

interface NativeProfileCollectionCryptoModule {
  generateKeyPair(): Promise<{ privateKey: string; publicKey: string }>;
  decrypt(privateKey: string, publicKey: string, salt: string, iv: string, ciphertext: string, requestId: string): Promise<string>;
}

const nativeCrypto = requireOptionalNativeModule<NativeProfileCollectionCryptoModule>('StillAliveProfileCollectionCrypto');

export const isNativeProfileCollectionCryptoAvailable = nativeCrypto !== null;

export async function executeProfileCollectionCrypto(command: ProfileCollectionCryptoCommand): Promise<ProfileCollectionCryptoResult> {
  try {
    if (!nativeCrypto) throw new Error('Native profile collection cryptography is unavailable');
    if (command.type === 'generate-key-pair') {
      const result = await nativeCrypto.generateKeyPair();
      return { id: command.id, ok: true, type: command.type, publicKey: result.publicKey, privateKeyJwk: result.privateKey };
    }
    const plaintext = await nativeCrypto.decrypt(
      privateKeyBytes(command.privateKeyJwk),
      command.envelope.epk,
      command.envelope.salt,
      command.envelope.iv,
      command.envelope.data,
      command.envelope.id,
    );
    return { id: command.id, ok: true, type: command.type, plaintext };
  } catch {
    return { id: command.id, ok: false, error: command.type === 'generate-key-pair' ? '无法生成加密邀请' : '无法验证或解密这份资料' };
  }
}

function privateKeyBytes(value: string): string {
  if (!value.startsWith('{')) return value;
  const parsed: unknown = JSON.parse(value);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !('d' in parsed) || typeof parsed.d !== 'string') throw new Error('Invalid private key');
  return parsed.d;
}
