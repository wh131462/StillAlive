import * as Location from 'expo-location';
import { Platform } from 'react-native';

export interface ResolvedDeviceLocation {
  address: string;
  city: string;
}

export async function resolveDeviceLocation(): Promise<ResolvedDeviceLocation> {
  if (Platform.OS === 'web') throw new Error('网页端暂不支持记录实际地址');

  const permission = await Location.requestForegroundPermissionsAsync();
  if (!permission.granted) throw new Error('未获得定位权限，请在系统设置中允许“仍在”使用位置');

  const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
  const [place] = await Location.reverseGeocodeAsync({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
  });
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
