import { requireOptionalNativeModule } from 'expo';
import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { writePersistentError, writePersistentLog } from './persistent-log';

export interface ResolvedDeviceLocation {
  address: string;
  city: string;
}

export type DeviceLocationDetail = 'address' | 'city';

const LOCATION_TIMEOUT_MS = 3_000;
const CITY_TIMEOUT_MS = 3_000;
const MAX_ACCURACY = 5_000;
const ADDRESS_DETAIL_ACCURACY = 2_000;
const MAX_POSITION_AGE_MS = { city: 24 * 60 * 60 * 1000, address: 60 * 1000 };
const nativeLocation = Platform.OS === 'android' ? requireOptionalNativeModule<{
  getPositionAsync(id: number, maxAge: number, maxAccuracy: number, highAccuracy: boolean): Promise<Location.LocationObject>;
  cancelAsync(id: number): Promise<void>;
}>('StillAliveDeviceLocation') : null;
const resolveLocationTasks = new Map<DeviceLocationDetail, Promise<ResolvedDeviceLocation>>();
let resolvedLocationCache: { timestamp: number; value: ResolvedDeviceLocation } | null = null;
let nextRequestId = 0;

export function warmDeviceLocation(detail: DeviceLocationDetail = 'city'): void {
  if (Platform.OS !== 'web') void resolveDeviceLocation(detail).catch(() => undefined);
}

export async function resolveDeviceLocation(detail: DeviceLocationDetail = 'address'): Promise<ResolvedDeviceLocation> {
  if (Platform.OS === 'web') throw new Error('网页端暂不支持记录实际地址');
  const existing = resolveLocationTasks.get(detail);
  if (existing) return existing;

  const startedAt = Date.now();
  const timeoutMs = detail === 'city' ? CITY_TIMEOUT_MS : LOCATION_TIMEOUT_MS;
  const controller = new AbortController();
  writePersistentLog('INFO', 'location.resolve.started', { detail, provider: nativeLocation ? 'android-system' : 'expo' });
  // 定位、缓存读取与地址解析共用预算，不能把各阶段超时相加。
  const task = new Promise<ResolvedDeviceLocation>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('暂未获取到位置，可手动填写'));
      controller.abort();
    }, timeoutMs);
    void resolveDeviceLocationOnce(detail, controller.signal).then(resolve, reject).finally(() => clearTimeout(timer));
  }).then((value) => {
    writePersistentLog('INFO', 'location.resolve.finished', { detail, elapsedMs: Date.now() - startedAt });
    return value;
  }, (cause) => {
    writePersistentError('location.resolve.failed', cause, { detail, elapsedMs: Date.now() - startedAt });
    throw cause;
  }).finally(() => {
    controller.abort();
    if (resolveLocationTasks.get(detail) === task) resolveLocationTasks.delete(detail);
  });
  resolveLocationTasks.set(detail, task);
  return task;
}

async function resolveDeviceLocationOnce(detail: DeviceLocationDetail, signal: AbortSignal): Promise<ResolvedDeviceLocation> {
  const startedAt = Date.now();
  const permission = await Location.getForegroundPermissionsAsync();
  if (signal.aborted) throw new Error('定位已取消');
  if (!permission.granted) throw new Error('定位权限未开启');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('系统定位服务未开启');
  if (signal.aborted) throw new Error('定位已取消');
  const maxAge = MAX_POSITION_AGE_MS[detail];
  if (resolvedLocationCache && isFreshTimestamp(resolvedLocationCache.timestamp, maxAge)) return resolvedLocationCache.value;

  let position: Location.LocationObject;
  if (nativeLocation) {
    const id = ++nextRequestId;
    const cancel = () => { void nativeLocation.cancelAsync(id).catch(() => undefined); };
    signal.addEventListener('abort', cancel, { once: true });
    try {
      position = await nativeLocation.getPositionAsync(id, maxAge, MAX_ACCURACY, detail === 'address');
    } finally {
      signal.removeEventListener('abort', cancel);
    }
  } else {
    const cached = await Location.getLastKnownPositionAsync({ maxAge, requiredAccuracy: MAX_ACCURACY }).catch(() => null);
    if (signal.aborted) throw new Error('定位已取消');
    position = cached && isUsablePosition(cached, maxAge) ? cached : await watchPosition(detail, signal);
  }
  if (signal.aborted) throw new Error('定位已取消');
  if (!isUsablePosition(position, maxAge)) throw new Error('暂未获取到位置，可手动填写');
  writePersistentLog('INFO', 'location.position.received', {
    detail, elapsedMs: Date.now() - startedAt, ageMs: Date.now() - position.timestamp, accuracy: position.coords.accuracy,
  });
  const geocodeTask = Location.reverseGeocodeAsync({ latitude: position.coords.latitude, longitude: position.coords.longitude }).catch(() => []);
  const place = await Promise.race([
    geocodeTask.then(([result]) => result ?? null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), Math.max(0, (detail === 'city' ? CITY_TIMEOUT_MS : LOCATION_TIMEOUT_MS) - (Date.now() - startedAt)))),
  ]);
  if (signal.aborted) throw new Error('定位已取消');
  if (!place) throw new Error('暂时无法识别当前位置');

  const city = formatCityLabel(place);
  const address = appendCountry(place.formattedAddress?.trim() || joinUnique([
    place.region, place.city, place.district, place.street, place.streetNumber, place.name, place.country,
  ]), place);
  if (!city) throw new Error('暂时无法识别当前位置');
  const addressValue = (position.coords.accuracy ?? Infinity) <= ADDRESS_DETAIL_ACCURACY ? address : city;
  const value = { address: (addressValue || city).slice(0, 80), city: city.slice(0, 40) };
  resolvedLocationCache = { timestamp: position.timestamp, value };
  return value;
}

function isFreshTimestamp(timestamp: number, maxAge: number): boolean {
  const age = Date.now() - timestamp;
  return Number.isFinite(age) && age >= 0 && age <= maxAge;
}

function isUsablePosition(position: Location.LocationObject, maxAge: number): boolean {
  const { latitude, longitude, accuracy } = position.coords;
  return Number.isFinite(latitude) && Math.abs(latitude) <= 90
    && Number.isFinite(longitude) && Math.abs(longitude) <= 180
    && !(latitude === 0 && longitude === 0)
    && accuracy !== null && Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MAX_ACCURACY
    && isFreshTimestamp(position.timestamp, maxAge);
}

function watchPosition(detail: DeviceLocationDetail, signal: AbortSignal): Promise<Location.LocationObject> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let subscription: Location.LocationSubscription | undefined;
    const finish = (result: Location.LocationObject | Error) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', cancel);
      subscription?.remove();
      if (result instanceof Error) reject(result);
      else resolve(result);
    };
    const cancel = () => finish(new Error('定位已取消'));
    if (signal.aborted) { cancel(); return; }
    signal.addEventListener('abort', cancel, { once: true });
    void Location.watchPositionAsync(
      { accuracy: detail === 'city' ? Location.Accuracy.Balanced : Location.Accuracy.High, timeInterval: 500, distanceInterval: 0, mayShowUserSettingsDialog: false },
      (position) => { if (isUsablePosition(position, MAX_POSITION_AGE_MS[detail])) finish(position); },
      (reason) => finish(new Error(reason || '定位失败')),
    ).then((value) => {
      subscription = value;
      if (settled) subscription.remove();
    }, (cause) => finish(cause instanceof Error ? cause : new Error('定位失败')));
  });
}

function formatCityLabel(place: Location.LocationGeocodedAddress): string {
  const city = normalizePlaceName(place.city ?? place.subregion ?? place.district ?? place.region ?? place.country);
  const country = place.country?.trim();
  if (!city || !country || isDomesticChina(place) || samePlaceName(city, country)) return city;
  return `${city}，${country}`;
}

function normalizePlaceName(value: string | null): string {
  return value?.trim().replace(/(?:特别行政区|市)$/u, '') ?? '';
}

function appendCountry(address: string, place: Location.LocationGeocodedAddress): string {
  const country = place.country?.trim();
  if (!address || !country || isDomesticChina(place) || samePlaceName(address, country)) return address;
  return `${address}，${country}`;
}

function isDomesticChina(place: Location.LocationGeocodedAddress): boolean {
  return place.isoCountryCode?.trim().toUpperCase() === 'CN' || place.country?.trim() === '中国';
}

function samePlaceName(left: string, right: string): boolean {
  return left === right || left.includes(right) || right.includes(left);
}

function joinUnique(values: Array<string | null>): string {
  const parts: string[] = [];
  for (const value of values) {
    const part = value?.trim();
    if (part && !parts.some((existing) => existing === part || existing.includes(part))) parts.push(part);
  }
  return parts.join(' ');
}
