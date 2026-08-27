import * as Location from 'expo-location';
import { Platform } from 'react-native';
import { writePersistentError, writePersistentLog } from './persistent-log';

export interface ResolvedDeviceLocation {
  address: string;
  city: string;
}

export type DeviceLocationDetail = 'address' | 'city';

interface LocationProfile {
  cacheMaxAgeMs: number;
  lastKnownMaxAgeMs: number;
  lastKnownRequiredAccuracy: number;
  accuracy: Location.Accuracy;
  maxAccuracy: number;
  timeoutMs: number;
}

const LOCATION_PROFILES: Record<DeviceLocationDetail, LocationProfile> = {
  city: {
    cacheMaxAgeMs: 5 * 60 * 1000,
    lastKnownMaxAgeMs: 5 * 60 * 1000,
    lastKnownRequiredAccuracy: 3_000,
    accuracy: Location.Accuracy.Balanced,
    maxAccuracy: 5_000,
    timeoutMs: 10_000,
  },
  address: {
    cacheMaxAgeMs: 60 * 1000,
    lastKnownMaxAgeMs: 60 * 1000,
    lastKnownRequiredAccuracy: 500,
    accuracy: Location.Accuracy.High,
    maxAccuracy: 500,
    timeoutMs: 15_000,
  },
};

const currentPositionTasks = new Map<DeviceLocationDetail, Promise<Location.LocationObject>>();
const resolveLocationTasks = new Map<DeviceLocationDetail, Promise<ResolvedDeviceLocation>>();
const resolvedLocationCaches = new Map<DeviceLocationDetail, { resolvedAt: number; accuracy: number | null; value: ResolvedDeviceLocation }>();

export async function resolveDeviceLocation(detail: DeviceLocationDetail = 'address'): Promise<ResolvedDeviceLocation> {
  writePersistentLog('INFO', 'location.resolve.started', { detail, platform: Platform.OS, cached: resolvedLocationCaches.has(detail) });
  if (Platform.OS === 'web') throw new Error('网页端暂不支持记录实际地址');

  let resolveLocationTask = resolveLocationTasks.get(detail);
  if (!resolveLocationTask) {
    const task = resolveDeviceLocationOnce(detail);
    resolveLocationTasks.set(detail, task);
    void task.finally(() => {
      if (resolveLocationTasks.get(detail) === task) resolveLocationTasks.delete(detail);
    }).catch(() => undefined);
    resolveLocationTask = task;
  }
  return resolveLocationTask.then((value) => {
    writePersistentLog('INFO', 'location.resolve.finished', { address: value.address, city: value.city, detail });
    return value;
  }, (cause) => {
    writePersistentError('location.resolve.failed', cause);
    throw cause;
  });
}

async function resolveDeviceLocationOnce(detail: DeviceLocationDetail): Promise<ResolvedDeviceLocation> {
  const profile = LOCATION_PROFILES[detail];
  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('定位权限未开启');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('系统定位服务未开启');
  const providerStatus = await Location.getProviderStatusAsync();
  writePersistentLog('INFO', 'location.providers.status', providerStatus);

  const resolvedLocationCache = resolvedLocationCaches.get(detail);
  if (resolvedLocationCache && Date.now() - resolvedLocationCache.resolvedAt <= profile.cacheMaxAgeMs && isAccurateEnough(resolvedLocationCache.accuracy, profile.maxAccuracy)) {
    return resolvedLocationCache.value;
  }

  const cachedPosition = await withTimeout(
    Location.getLastKnownPositionAsync({ maxAge: profile.lastKnownMaxAgeMs, requiredAccuracy: profile.lastKnownRequiredAccuracy }),
    800,
    '缓存位置读取超时',
  ).catch(() => null);
  const position = cachedPosition && isUsablePosition(cachedPosition, profile.maxAccuracy)
    ? cachedPosition
    : await getCurrentPosition(detail);
  if (!isUsablePosition(position, profile.maxAccuracy)) {
    throw new Error(detail === 'city' ? '系统未返回有效城市定位，请稍后重试' : '系统未返回足够精确的位置，请移到室外后重试');
  }
  const [place] = await withTimeout(Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }), 4_000, '位置解析超时，请稍后重试');
  if (!place) throw new Error('暂时无法识别当前位置');

  const city = formatCityLabel(place);
  const address = appendCountry(place.formattedAddress?.trim() || joinUnique([
    place.region,
    place.city,
    place.district,
    place.street,
    place.streetNumber,
    place.name,
    place.country,
  ]), place);
  if (!city || !address) throw new Error('暂时无法识别当前位置');
  const value = { address: address.slice(0, 80), city: city.slice(0, 40) };
  resolvedLocationCaches.set(detail, { resolvedAt: Date.now(), accuracy: position.coords.accuracy ?? null, value });
  return value;
}

function isUsablePosition(position: Location.LocationObject, maxAccuracy: number): boolean {
  const { latitude, longitude } = position.coords;
  return Number.isFinite(latitude)
    && Number.isFinite(longitude)
    && Math.abs(latitude) > 0.0001
    && Math.abs(longitude) > 0.0001
    && isAccurateEnough(position.coords.accuracy ?? null, maxAccuracy);
}

function isAccurateEnough(accuracy: number | null, maxAccuracy: number): boolean {
  return accuracy === null || (Number.isFinite(accuracy) && accuracy <= maxAccuracy);
}

function getCurrentPosition(detail: DeviceLocationDetail): Promise<Location.LocationObject> {
  let currentPositionTask = currentPositionTasks.get(detail);
  if (!currentPositionTask) {
    const task = getCurrentPositionWithTimeout(detail);
    currentPositionTasks.set(detail, task);
    void task.finally(() => {
      if (currentPositionTasks.get(detail) === task) currentPositionTasks.delete(detail);
    }).catch(() => undefined);
    currentPositionTask = task;
  }
  return currentPositionTask;
}

function getCurrentPositionWithTimeout(detail: DeviceLocationDetail): Promise<Location.LocationObject> {
  const profile = LOCATION_PROFILES[detail];
  if (detail === 'city') return getCurrentPositionAttempt(profile.accuracy, profile.timeoutMs);

  // 详细地址先使用系统融合定位；精度不足或超时时再请求 GPS，避免室内设备无谓等待。
  return getCurrentPositionAttempt(Location.Accuracy.Balanced, 7_000)
    .then((position) => isUsablePosition(position, profile.maxAccuracy) ? position : getHighAccuracyFallback(position, profile))
    .catch((cause) => getHighAccuracyFallback(cause, profile));
}

function getCurrentPositionAttempt(accuracy: Location.Accuracy, timeoutMs: number): Promise<Location.LocationObject> {
  return withTimeout(
    Location.getCurrentPositionAsync({ accuracy, mayShowUserSettingsDialog: true }),
    timeoutMs,
    '定位超时，请稍后重试',
  );
}

function getHighAccuracyFallback(cause: unknown, profile: LocationProfile): Promise<Location.LocationObject> {
  writePersistentLog('WARN', 'location.resolve.high-accuracy-fallback', {
    cause: cause instanceof Error ? cause.message : '平衡定位精度不足',
  });
  return getCurrentPositionAttempt(Location.Accuracy.High, profile.timeoutMs - 7_000);
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

function withTimeout<T>(task: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    void task.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}
