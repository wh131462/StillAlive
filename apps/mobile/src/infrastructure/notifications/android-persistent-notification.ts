import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

interface PersistentNotificationStatus {
  enabled: boolean;
  running: boolean;
}

interface PersistentNotificationModule {
  setEnabledAsync(enabled: boolean): Promise<void>;
  refreshAsync(): Promise<void>;
  getStatusAsync(): Promise<PersistentNotificationStatus>;
}

const nativeModule = Platform.OS === 'android'
  ? requireOptionalNativeModule<PersistentNotificationModule>('StillAlivePersistentNotification')
  : null;

export const persistentNotificationSupported = Platform.OS === 'android' && Boolean(nativeModule);

export async function setPersistentNotificationEnabled(enabled: boolean): Promise<void> {
  if (!nativeModule) throw new Error('当前环境不支持常驻快捷栏');
  await nativeModule.setEnabledAsync(enabled);
}

export async function refreshPersistentNotification(): Promise<void> {
  if (nativeModule) await nativeModule.refreshAsync();
}

export async function getPersistentNotificationStatus(): Promise<PersistentNotificationStatus> {
  return nativeModule?.getStatusAsync() ?? { enabled: false, running: false };
}
