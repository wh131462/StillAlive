import { AudioModule } from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';
import { feedback } from '../../shared/feedback';
import type { FeedbackButton } from '../../shared/feedback';
import { writePersistentError, writePersistentLog } from './persistent-log';

type AppPermission = 'camera' | 'location' | 'microphone' | 'photos';

interface PermissionResponse {
  canAskAgain: boolean;
  granted: boolean;
  status: 'denied' | 'granted' | 'undetermined';
}

const permissionCopy: Record<AppPermission, { message: string; title: string }> = {
  camera: { title: '无法使用相机', message: '请在系统设置中允许“仍在”使用相机。' },
  location: { title: '无法获取位置', message: '请在系统设置中允许“仍在”使用位置。' },
  microphone: { title: '无法使用麦克风', message: '请在系统设置中允许“仍在”使用麦克风。' },
  photos: { title: '无法访问照片', message: '请在系统设置中允许“仍在”访问照片。' },
};

export async function ensureAppPermission(permission: AppPermission, extraActions: FeedbackButton[] = []): Promise<boolean> {
  writePersistentLog('INFO', 'permission.check.started', { permission });
  // Android 和 Web 使用系统照片选择器，不需要申请整个照片库访问权限。
  if (permission === 'photos' && Platform.OS !== 'ios') return true;

  let response: PermissionResponse;
  try {
    const handler = permissionHandler(permission);
    response = await handler.get();
    if (!response.granted && response.canAskAgain) {
      response = await handler.request();
    }
  } catch (cause) {
    writePersistentError('permission.check.failed', cause, { permission });
    feedback.alert('权限检查失败', cause instanceof Error ? cause.message : '请稍后重试。');
    return false;
  }
  if (response.granted) {
    writePersistentLog('INFO', 'permission.check.granted', { permission });
    return true;
  }

  writePersistentLog('WARN', 'permission.check.denied', { permission, status: response.status, canAskAgain: response.canAskAgain });

  const copy = permissionCopy[permission];
  feedback.alert(copy.title, copy.message, [
    { text: '取消', style: 'cancel' },
    ...extraActions,
    { text: '打开系统设置', onPress: () => void openAppSettings() },
  ]);
  return false;
}

export function openAppSettings(): Promise<void> {
  return Linking.openSettings();
}

function permissionHandler(permission: AppPermission): { get(): Promise<PermissionResponse>; request(): Promise<PermissionResponse> } {
  if (permission === 'camera') return { get: () => ImagePicker.getCameraPermissionsAsync(), request: () => ImagePicker.requestCameraPermissionsAsync() };
  if (permission === 'photos') return { get: () => ImagePicker.getMediaLibraryPermissionsAsync(), request: () => ImagePicker.requestMediaLibraryPermissionsAsync() };
  if (permission === 'microphone') return { get: () => AudioModule.getRecordingPermissionsAsync(), request: () => AudioModule.requestRecordingPermissionsAsync() };
  return { get: () => Location.getForegroundPermissionsAsync(), request: () => Location.requestForegroundPermissionsAsync() };
}
