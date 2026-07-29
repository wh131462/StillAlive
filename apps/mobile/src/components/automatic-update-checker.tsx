import { useEffect, useRef } from 'react';
import { Alert } from 'react-native';
import { ANDROID_UPDATE_MANIFEST_URL, checkForAndroidUpdate, downloadAndInstallAndroidUpdate } from '../update/android-update';

export function AutomaticUpdateChecker() {
  const checked = useRef(false);

  useEffect(() => {
    if (checked.current || !ANDROID_UPDATE_MANIFEST_URL.trim()) return;
    checked.current = true;
    void checkForAndroidUpdate().then((result) => {
      if (result.status !== 'available') return;
      const { manifest } = result;
      Alert.alert(
        `发现新版本 ${manifest.versionName}`,
        manifest.releaseNotes || '新版本已经可以下载。',
        [
          { text: '稍后', style: 'cancel' },
          {
            text: '下载更新',
            onPress: () => void downloadAndInstallAndroidUpdate(manifest).then((installResult) => {
              if (installResult === 'permission-required') Alert.alert('需要安装权限', '请允许“仍在”安装未知应用，返回后再次检查更新。');
            }).catch((cause: unknown) => Alert.alert('更新失败', errorMessage(cause))),
          },
        ],
      );
    }).catch(() => undefined);
  }, []);

  return null;
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : '请稍后重试。';
}
