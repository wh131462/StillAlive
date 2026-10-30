import { useEffect, useRef } from 'react';
import { useAppState } from '../state/app-state';
import { feedback } from '../../shared/feedback';
import { expoBirthdayNotificationAdapter } from '../../infrastructure/notifications/expo-notifications';
import { writePersistentError, writePersistentLog } from '../../infrastructure/platform/persistent-log';

export function NotificationReminderPrompt() {
  const { people, preferences, ready, setBirthdayNotificationsEnabled, updatePreferences } = useAppState();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!ready || promptedRef.current) return;
    if (preferences.notificationPromptShownAt || preferences.birthdayNotificationsEnabled) return;
    const birthdayCount = people.filter((person) => person.birthday).length;
    if (birthdayCount === 0) return;

    promptedRef.current = true;
    void (async () => {
      // 系统权限已被用户决定过时不再引导，避免弹出后开启失败。
      if (await expoBirthdayNotificationAdapter.getPermission() !== 'undetermined') return;
      writePersistentLog('INFO', 'notifications.prompt.shown', { birthdayCount });
      await updatePreferences({ notificationPromptShownAt: new Date().toISOString() })
        .catch((cause) => writePersistentError('notifications.prompt.persist.failed', cause));
      feedback.alert(
        '要在生日那天提醒你吗？',
        `已经记下了 ${birthdayCount} 位朋友的生日。开启后会在提前 3 天和当天提醒你，重要日子也会在当天提醒。`,
        [
          { text: '以后再说', style: 'cancel' },
          {
            text: '开启提醒',
            onPress: () => void setBirthdayNotificationsEnabled(true)
              .catch((cause: unknown) => feedback.alert('提醒设置失败', cause instanceof Error ? cause.message : '请稍后重试。')),
          },
        ],
      );
    })().catch((cause) => writePersistentError('notifications.prompt.open.failed', cause));
  }, [people, preferences.birthdayNotificationsEnabled, preferences.notificationPromptShownAt, ready, setBirthdayNotificationsEnabled, updatePreferences]);

  return null;
}
