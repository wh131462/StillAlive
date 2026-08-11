import { Platform } from 'react-native';
import { isRunningInExpoGo } from 'expo';
import type * as ExpoNotifications from 'expo-notifications';
import type { BirthdayNotificationAdapter, PlannedBirthdayNotification } from '../domain/birthday-notifications';
import type { MemoryNotificationAdapter, PlannedMemoryNotification } from '../domain/memory-notifications';

const BIRTHDAY_CHANNEL_ID = 'birthday-reminders';
const MEMORY_CHANNEL_ID = 'memory-reminders';
const DEBUG_CHANNEL_ID = 'debug-notifications';
let notificationsModule: typeof ExpoNotifications | null | undefined;

export const expoBirthdayNotificationAdapter: BirthdayNotificationAdapter = {
  async getPermission() {
    const notifications = loadNotifications();
    return notifications ? permissionStatus(await notifications.getPermissionsAsync(), notifications) : 'denied';
  },
  async requestPermission() {
    const notifications = requireNotifications();
    await ensureBirthdayChannel(notifications);
    return permissionStatus(await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }), notifications);
  },
  async schedule(item: PlannedBirthdayNotification) {
    const notifications = requireNotifications();
    await ensureBirthdayChannel(notifications);
    return notifications.scheduleNotificationAsync({
      content: {
        title: item.eventType === 'advance' ? `${item.personName}的${calendarLabel(item.calendar)}生日快到了` : `今天是${item.personName}的${calendarLabel(item.calendar)}生日`,
        body: item.eventType === 'advance' ? '还有 3 天，可以提前准备一份心意。' : '愿今天留下一段温柔的记忆。',
        data: { personId: item.personId, eventType: item.eventType, calendar: item.calendar },
        sound: 'default',
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: item.triggerAt,
        channelId: BIRTHDAY_CHANNEL_ID,
      },
    });
  },
  async cancel(platformIdentifier: string) {
    await requireNotifications().cancelScheduledNotificationAsync(platformIdentifier);
  },
};

function calendarLabel(calendar: PlannedBirthdayNotification['calendar']): string {
  return calendar === 'solar' ? '公历' : '农历';
}

export const expoMemoryNotificationAdapter: MemoryNotificationAdapter = {
  getPermission: expoBirthdayNotificationAdapter.getPermission,
  async requestPermission() {
    const notifications = requireNotifications();
    await ensureMemoryChannel(notifications);
    return permissionStatus(await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }), notifications);
  },
  async schedule(item: PlannedMemoryNotification) {
    const notifications = requireNotifications();
    await ensureMemoryChannel(notifications);
    return notifications.scheduleNotificationAsync({
      content: {
        title: item.onThisDay ? '那年今天，你留下了一段记录' : '偶尔翻到一段以前的你',
        body: `${item.post.dayKey.replaceAll('-', '.')} 的这段记忆，想和你再见一面。`,
        data: { postId: item.post.id, type: 'memory' },
        sound: 'default',
      },
      trigger: {
        type: notifications.SchedulableTriggerInputTypes.DATE,
        date: item.triggerAt,
        channelId: MEMORY_CHANNEL_ID,
      },
    });
  },
  cancel: expoBirthdayNotificationAdapter.cancel,
};

export async function initializeBirthdayNotificationChannel(): Promise<void> {
  await ensureBirthdayChannel(loadNotifications());
}

export async function initializeMemoryNotificationChannel(): Promise<void> {
  await ensureMemoryChannel(loadNotifications());
}

export async function requestNotificationPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
  const notifications = requireNotifications();
  let permission = permissionStatus(await notifications.getPermissionsAsync(), notifications);
  if (permission === 'undetermined') {
    permission = permissionStatus(await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }), notifications);
  }
  return permission;
}

export async function scheduleDebugNotification(): Promise<string> {
  const notifications = requireNotifications();
  await ensureDebugChannel(notifications);
  let permission = permissionStatus(await notifications.getPermissionsAsync(), notifications);
  if (permission === 'undetermined') {
    permission = permissionStatus(await notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowBadge: false, allowSound: true } }), notifications);
  }
  if (permission !== 'granted') throw new Error('系统通知权限未开启');
  return notifications.scheduleNotificationAsync({
    content: {
      title: '通知测试成功',
      body: '这是一条来自“仍在”调试界面的本地通知。',
      data: { type: 'debug' },
      sound: 'default',
    },
    trigger: {
      type: notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + 1000),
      channelId: DEBUG_CHANNEL_ID,
    },
  });
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

async function ensureBirthdayChannel(notifications: typeof ExpoNotifications | null): Promise<void> {
  if (Platform.OS !== 'android' || !notifications) return;
  await notifications.setNotificationChannelAsync(BIRTHDAY_CHANNEL_ID, {
    name: '人物生日提醒',
    description: '人物生日提前三天和当天的本地提醒',
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 180, 250],
  });
}

async function ensureMemoryChannel(notifications: typeof ExpoNotifications | null): Promise<void> {
  if (Platform.OS !== 'android' || !notifications) return;
  await notifications.setNotificationChannelAsync(MEMORY_CHANNEL_ID, {
    name: '旧日回忆',
    description: '偶尔推荐以前留下的本地记录',
    importance: notifications.AndroidImportance.DEFAULT,
  });
}

async function ensureDebugChannel(notifications: typeof ExpoNotifications | null): Promise<void> {
  if (Platform.OS !== 'android' || !notifications) return;
  await notifications.setNotificationChannelAsync(DEBUG_CHANNEL_ID, {
    name: '通知调试',
    description: '仅用于验证本机通知是否正常工作',
    importance: notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 200, 120, 200],
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
