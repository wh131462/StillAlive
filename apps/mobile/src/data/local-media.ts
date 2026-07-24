import { Directory, File, Paths } from 'expo-file-system';
import type { ImagePickerAsset } from 'expo-image-picker';
import type { Media } from '@still-alive/types';

export async function persistPickedImage(asset: ImagePickerAsset): Promise<Media> {
  const id = createLocalId('media');
  const directory = new Directory(Paths.document, 'media');
  directory.create({ idempotent: true, intermediates: true });

  const extension = fileExtension(asset);
  const source = new File(asset.uri);
  const destination = new File(directory, `${id}${extension}`);
  await source.copy(destination);

  return {
    id,
    localPath: destination.uri,
    mimeType: asset.mimeType ?? mimeTypeForExtension(extension),
    width: asset.width || null,
    height: asset.height || null,
    checksum: destination.md5 ?? '',
    createdAt: new Date().toISOString(),
  };
}

function fileExtension(asset: ImagePickerAsset): string {
  const match = asset.fileName?.match(/\.[a-zA-Z0-9]+$/);
  if (match) return match[0].toLowerCase();
  if (asset.mimeType === 'image/png') return '.png';
  if (asset.mimeType === 'image/webp') return '.webp';
  if (asset.mimeType === 'image/heic' || asset.mimeType === 'image/heif') return '.heic';
  return '.jpg';
}

function mimeTypeForExtension(extension: string): string {
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  if (extension === '.heic' || extension === '.heif') return 'image/heic';
  return 'image/jpeg';
}

function createLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}
