import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

interface PasswordVaultCryptoModule {
  deriveArgon2idAsync(password: string, saltBase64: string, memoryCostKiB: number, timeCost: number, parallelism: number, keyLength: number): Promise<string>;
}

const nativeCrypto = Platform.OS === 'android'
  ? requireOptionalNativeModule<PasswordVaultCryptoModule>('StillAlivePasswordVaultCrypto')
  : null;

export function derivePasswordVaultKeyNative(
  password: string,
  saltBase64: string,
  memoryCostKiB: number,
  timeCost: number,
  parallelism: number,
  keyLength: number,
): Promise<string> | null {
  return nativeCrypto?.deriveArgon2idAsync(password, saltBase64, memoryCostKiB, timeCost, parallelism, keyLength) ?? null;
}
