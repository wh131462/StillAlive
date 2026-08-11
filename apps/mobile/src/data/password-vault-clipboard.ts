import * as Clipboard from 'expo-clipboard';

export async function copyPasswordToClipboard(password: string): Promise<void> {
  const copied = await Clipboard.setStringAsync(password);
  if (!copied) throw new Error('无法复制密码');
}
