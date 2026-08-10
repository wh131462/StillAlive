import { useEffect, useRef, useState } from 'react';
import { AndroidUpdateDialog } from './android-update-dialog';
import { ANDROID_UPDATE_MANIFEST_URL, checkForAndroidUpdate, type AndroidUpdateManifest } from '../update/android-update';

export function AutomaticUpdateChecker() {
  const checked = useRef(false);
  const [manifest, setManifest] = useState<AndroidUpdateManifest | null>(null);

  useEffect(() => {
    if (checked.current || !ANDROID_UPDATE_MANIFEST_URL.trim()) return;
    checked.current = true;
    void checkForAndroidUpdate().then((result) => {
      if (result.status !== 'available') return;
      setManifest(result.manifest);
    }).catch(() => undefined);
  }, []);

  return <AndroidUpdateDialog manifest={manifest} onDismiss={() => setManifest(null)} />;
}
