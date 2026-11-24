import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { writePersistentError } from '../infrastructure/platform/persistent-log';

export type HapticKind = 'selection' | 'success' | 'impact';

let hapticsEnabled = true;

export function setHapticsEnabled(enabled: boolean): void {
  hapticsEnabled = enabled;
}

/**
 * A small, central haptics wrapper. Keep this deliberately limited to the
 * moments that confirm a meaningful action; do not use it for every press.
 */
export function haptic(kind: HapticKind = 'selection'): void {
  if (!hapticsEnabled || Platform.OS === 'web') return;
  const task = kind === 'success'
    ? Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)
    : kind === 'impact'
      ? Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      : Haptics.selectionAsync();
  void task.catch((cause: unknown) => writePersistentError('haptics.feedback.failed', cause, { kind }));
}
