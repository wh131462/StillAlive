import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';
import { ensureAppPermission } from './app-permissions';

const canceledResult: ImagePicker.ImagePickerCanceledResult = { canceled: true, assets: null };
type MediaLibraryPickerHandler = (options: ImagePicker.ImagePickerOptions) => Promise<ImagePicker.ImagePickerResult>;
let mediaLibraryPickerHandler: MediaLibraryPickerHandler | null = null;

export function registerMediaLibraryPicker(handler: MediaLibraryPickerHandler | null): () => void {
  mediaLibraryPickerHandler = handler;
  return () => {
    if (mediaLibraryPickerHandler === handler) mediaLibraryPickerHandler = null;
  };
}

export async function pickMediaFromCamera(options: ImagePicker.ImagePickerOptions = {}): Promise<ImagePicker.ImagePickerResult> {
  if (Platform.OS !== 'web' && !await ensureAppPermission('camera')) return canceledResult;
  return ImagePicker.launchCameraAsync(options);
}

export async function pickMediaFromLibrary(options: ImagePicker.ImagePickerOptions = {}): Promise<ImagePicker.ImagePickerResult> {
  // The native picker remains the crop editor for cover flows.
  if (options.allowsEditing) {
    if (Platform.OS !== 'web' && !await ensureAppPermission('photos')) return canceledResult;
    return ImagePicker.launchImageLibraryAsync(options);
  }
  if (Platform.OS !== 'web' && mediaLibraryPickerHandler) return mediaLibraryPickerHandler(options);
  if (Platform.OS !== 'web' && !await ensureAppPermission('photos')) return canceledResult;
  return ImagePicker.launchImageLibraryAsync(options);
}
