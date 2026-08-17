import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface ResolvedDeviceLocation {
  address: string;
  city: string;
}

let currentPositionTask: Promise<Location.LocationObject> | null = null;
let resolveLocationTask: Promise<ResolvedDeviceLocation> | null = null;
let resolvedLocationCache: { resolvedAt: number; value: ResolvedDeviceLocation } | null = null;

const RESOLVED_LOCATION_MAX_AGE_MS = 5 * 60 * 1000;

export async function resolveDeviceLocation(): Promise<ResolvedDeviceLocation> {
  if (Platform.OS === 'web') throw new Error('网页端暂不支持记录实际地址');

  if (!resolveLocationTask) {
    const task = resolveDeviceLocationOnce();
    resolveLocationTask = task;
    void task.finally(() => {
      if (resolveLocationTask === task) resolveLocationTask = null;
    }).catch(() => undefined);
  }
  return resolveLocationTask;
}

async function resolveDeviceLocationOnce(): Promise<ResolvedDeviceLocation> {
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('定位权限未开启');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('系统定位服务未开启');

  if (resolvedLocationCache && Date.now() - resolvedLocationCache.resolvedAt <= RESOLVED_LOCATION_MAX_AGE_MS) {
    return resolvedLocationCache.value;
  }

  const cachedPosition = await withTimeout(
    Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 1_000 }),
    800,
    '缓存位置读取超时',
  ).catch(() => null);
  const position = cachedPosition ?? await getCurrentPosition();
  const [place] = await withTimeout(Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }), 4_000, '位置解析超时，请稍后重试');
  if (!place) throw new Error('暂时无法识别当前位置');

  const city = normalizeCity(place.city ?? place.subregion ?? place.district ?? place.region);
  const address = place.formattedAddress?.trim() || joinUnique([
    place.region,
    place.city,
    place.district,
    place.street,
    place.streetNumber,
    place.name,
  ]);
  if (!city || !address) throw new Error('暂时无法识别当前位置');
  const value = { address: address.slice(0, 80), city: city.slice(0, 40) };
  resolvedLocationCache = { resolvedAt: Date.now(), value };
  return value;
}

function getCurrentPosition(): Promise<Location.LocationObject> {
  if (!currentPositionTask) {
    const task = getCurrentPositionWithTimeout();
    currentPositionTask = task;
    void task.finally(() => {
      if (currentPositionTask === task) currentPositionTask = null;
    }).catch(() => undefined);
  }
  return currentPositionTask;
}

function getCurrentPositionWithTimeout(): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let subscription: Location.LocationSubscription | null = null;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.remove();
      callback();
    };
    const timer = setTimeout(
      () => finish(() => reject(new Error('定位超时，请稍后重试'))),
      10_000,
    );

    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Low, distanceInterval: 0, mayShowUserSettingsDialog: false },
      (position) => finish(() => resolve(position)),
      (reason) => finish(() => reject(new Error(reason))),
    ).then((value) => {
      subscription = value;
      if (settled) subscription.remove();
    }, (cause: unknown) => {
      finish(() => reject(cause));
    });
  });
}

function normalizeCity(value: string | null): string {
  return value?.trim().replace(/(?:特别行政区|市)$/u, '') ?? '';
}

function joinUnique(values: Array<string | null>): string {
  const parts: string[] = [];
  for (const value of values) {
    const part = value?.trim();
    if (part && !parts.some((existing) => existing === part || existing.includes(part))) parts.push(part);
  }
  return parts.join(' ');
}

function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    void task.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
