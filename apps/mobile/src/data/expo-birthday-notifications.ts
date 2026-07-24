import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import type * as ExpoNotifications from 'expo-notifications';
import type { BirthdayNotificationAdapter, PlannedBirthdayNotification } from '../domain/birthday-notifications';

const CHANNEL_ID = 'birthday-reminders';
let notificationsModule: typeof ExpoNotifications | null | undefined;

export const expoBirthdayNotificationAdapter: BirthdayNotificationAdapter = {
  async getPermission() {
    const notifications = loadNotifications();
    return notifications ? permissionStatus(await notifications.getPermissionsAsync(), notifications) : 'denied';
  },
  async requestPermission() {
    const notifications = requireNotifications();
    await ensureAndroidChannel(notifications);
    return permissionStatus(await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }), notifications);
  },
  async schedule(item: PlannedBirthdayNotification) {
    const notifications = requireNotifications();
    await ensureAndroidChannel(notifications);
    return notifications.scheduleNotificationAsync({
      content: {
        title: item.eventType === 'advance' ? `${item.personName}的生日快到了` : `今天是${item.personName}的生日`,
        body: item.eventType === 'advance' ? '还有 3 天，可以提前准备一份心意。' : '愿今天留下一段温柔的记忆。',
        data: { personId: item.personId, eventType: item.eventType },
        sound: 'default',
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: item.triggerAt,
        channelId: CHANNEL_ID,
      },
    });
  },
  async cancel(platformIdentifier: string) {
    await requireNotifications().cancelScheduledNotificationAsync(platformIdentifier);
  },
};

export async function initializeBirthdayNotificationChannel(): Promise<void> {
  await ensureAndroidChannel(loadNotifications());
}

export function getLastBirthdayNotificationResponse(): ExpoNotifications.NotificationResponse | null {
  try {
    return loadNotifications()?.getLastNotificationResponse() ?? null;
  } catch {
    return null;
  }
}

export function addBirthdayNotificationResponseListener(listener: (response: ExpoNotifications.NotificationResponse) => void): { remove(): void } {
  try {
    return loadNotifications()?.addNotificationResponseReceivedListener(listener) ?? { remove() {} };
  } catch {
    return { remove() {} };
  }
}

function permissionStatus(status: ExpoNotifications.NotificationPermissionsStatus, notifications: typeof ExpoNotifications): 'granted' | 'denied' | 'undetermined' {
  if (status.granted || status.ios?.status === notifications.IosAuthorizationStatus.PROVISIONAL) return 'granted';
  return status.status === 'denied' ? 'denied' : 'undetermined';
}

async function ensureAndroidChannel(notifications: typeof ExpoNotifications | null): Promise<void> {
  if (Platform.OS !== 'android' || !notifications) return;
  await notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: '人物生日提醒',
    description: '人物生日提前三天和当天的本地提醒',
    importance: notifications.AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: [0, 250, 180, 250],
  });
}

function requireNotifications(): typeof ExpoNotifications {
  const notifications = loadNotifications();
  if (!notifications) throw new Error('Expo Go 不支持 Android 通知，请使用开发构建。');
  return notifications;
}

function loadNotifications(): typeof ExpoNotifications | null {
  if (notificationsModule !== undefined) return notificationsModule;
  if (Platform.OS === 'android' && isRunningInExpoGo()) {
    notificationsModule = null;
    return notificationsModule;
  }
  try {
    notificationsModule = require('expo-notifications') as typeof ExpoNotifications;
    notificationsModule.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
  } catch {
    notificationsModule = null;
  }
  return notificationsModule;
}
