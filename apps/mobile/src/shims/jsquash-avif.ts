export async function decode(): Promise<never> {
  throw new Error('当前设备不支持 AVIF 原生解码');
}
