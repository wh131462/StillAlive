import { useCallback, useRef } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { Person, Post } from '@still-alive/types';
import { reconcileBirthdayNotifications } from '../../features/people/birthday-notifications';
import { reconcileMemoryNotifications } from '../../features/home/memory-notifications';
import { expoBirthdayNotificationAdapter, expoMemoryNotificationAdapter } from '../../infrastructure/notifications/expo-notifications';
import type { AppPreferences } from '../../infrastructure/database/database-models';
import type { SQLiteStillAliveRepository } from '../../infrastructure/database/sqlite-repository';
import { writePersistentError, writePersistentLog } from '../../infrastructure/platform/persistent-log';

type NotificationPermission = 'granted' | 'denied' | 'undetermined';

export function useNotificationSync(
  repository: SQLiteStillAliveRepository,
  setPreferences: Dispatch<SetStateAction<AppPreferences>>,
  setNotificationPermission: Dispatch<SetStateAction<NotificationPermission>>,
) {
  const queueRef = useRef(Promise.resolve());

  const enqueue = useCallback(<T,>(operation: () => Promise<T>): Promise<T> => {
    const task = queueRef.current.catch((cause) => {
      writePersistentError('notifications.sync.queue.previous-failed', cause);
    }).then(operation);
    queueRef.current = task.then(() => undefined, () => undefined);
    return task;
  }, []);

  const syncBirthdayNotifications = useCallback((people: Person[], preferences: AppPreferences, requestPermission = false) => enqueue(async () => {
    writePersistentLog('INFO', 'notifications.birthday.sync.started', { people: people.length, enabled: preferences.birthdayNotificationsEnabled, requestPermission });
    try {
      await reconcileBirthdayNotifications(repository, expoBirthdayNotificationAdapter, people, preferences.birthdayNotificationsEnabled, preferences.birthdayReminderHour, preferences.birthdayReminderMinute, requestPermission);
      const permission = await expoBirthdayNotificationAdapter.getPermission();
      setNotificationPermission(permission);
      if (preferences.birthdayNotificationError) {
        await repository.updatePreferences({ birthdayNotificationError: null });
        setPreferences((current) => ({ ...current, birthdayNotificationError: null }));
      }
    } catch (cause) {
      writePersistentError('notifications.birthday.sync.failed', cause, { people: people.length, enabled: preferences.birthdayNotificationsEnabled, requestPermission });
      const message = cause instanceof Error ? cause.message : '生日通知调度失败';
      setNotificationPermission(await expoBirthdayNotificationAdapter.getPermission());
      await repository.updatePreferences({ birthdayNotificationError: message });
      setPreferences((current) => ({ ...current, birthdayNotificationError: message }));
      throw cause;
    }
  }), [enqueue, repository, setNotificationPermission, setPreferences]);

  const syncMemoryNotifications = useCallback((posts: Post[], preferences: AppPreferences, requestPermission = false) => enqueue(async () => {
    writePersistentLog('INFO', 'notifications.memory.sync.started', { posts: posts.length, enabled: preferences.memoryNotificationsEnabled, requestPermission });
    try {
      await reconcileMemoryNotifications(repository, expoMemoryNotificationAdapter, posts, preferences.memoryNotificationsEnabled, requestPermission);
      setNotificationPermission(await expoMemoryNotificationAdapter.getPermission());
      if (preferences.memoryNotificationError) {
        await repository.updatePreferences({ memoryNotificationError: null });
        setPreferences((current) => ({ ...current, memoryNotificationError: null }));
      }
    } catch (cause) {
      writePersistentError('notifications.memory.sync.failed', cause, { posts: posts.length, enabled: preferences.memoryNotificationsEnabled, requestPermission });
      const message = cause instanceof Error ? cause.message : '回忆通知调度失败';
      setNotificationPermission(await expoMemoryNotificationAdapter.getPermission());
      await repository.updatePreferences({ memoryNotificationError: message });
      setPreferences((current) => ({ ...current, memoryNotificationError: message }));
      throw cause;
    }
  }), [enqueue, repository, setNotificationPermission, setPreferences]);

  return { syncBirthdayNotifications, syncMemoryNotifications };
}
