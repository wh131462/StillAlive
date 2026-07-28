import * as Clipboard from 'expo-clipboard';
import * as Crypto from 'expo-crypto';

export async function copyPasswordToClipboard(password: string): Promise<void> {
  const copied = await Clipboard.setStringAsync(password);
  if (!copied) throw new Error('无法复制密码');
  const copiedDigest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  setTimeout(() => {
    void Clipboard.getStringAsync().then(async (current) => {
      const currentDigest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, current);
      if (currentDigest === copiedDigest) await Clipboard.setStringAsync('');
    }).catch(() => undefined);
  }, 60_000);
}
