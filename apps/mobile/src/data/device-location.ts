import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface ResolvedDeviceLocation {
  address: string;
  city: string;
}

export async function resolveDeviceLocation(): Promise<ResolvedDeviceLocation> {
  if (Platform.OS === 'web') throw new Error('网页端暂不支持记录实际地址');

  const permission = await Location.getForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('定位权限未开启');
  if (!await Location.hasServicesEnabledAsync()) throw new Error('系统定位服务未开启');

  const cachedPosition = await withTimeout(
    Location.getLastKnownPositionAsync({ maxAge: 2 * 60 * 1000, requiredAccuracy: 500 }),
    1_000,
    '缓存位置读取超时',
  ).catch(() => null);
  const position = cachedPosition ?? await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, mayShowUserSettingsDialog: false }),
    8_000,
    '定位超时，请移到开阔处后重试',
  );
  const [place] = await withTimeout(Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  }), 5_000, '位置解析超时，请稍后重试');
  if (!place) throw new Error('暂时无法识别当前位置');

  const city = normalizeCity(place.city ?? place.subregion ?? place.region);
  const address = place.formattedAddress?.trim() || joinUnique([
    place.region,
    place.city,
    place.district,
    place.street,
    place.streetNumber,
    place.name,
  ]);
  if (!city || !address) throw new Error('暂时无法识别当前位置');
  return { address: address.slice(0, 80), city: city.slice(0, 40) };
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
