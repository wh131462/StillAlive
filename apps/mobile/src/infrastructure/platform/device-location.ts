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
  resolvedLocationCache = { resolvedAt: Date.now(), value };
  return value;
}

function getCurrentPosition(): Promise<Location.LocationObject> {
  if (!currentPositionTask) {
    const task = withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low, mayShowUserSettingsDialog: false }),
      10_000,
      '定位超时，请稍后重试',
    );
    currentPositionTask = task;
    void task.finally(() => {
      if (currentPositionTask === task) currentPositionTask = null;
    }).catch(() => undefined);
  }
  return currentPositionTask;
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
