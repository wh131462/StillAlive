import type { Media } from '@still-alive/types';

export interface SelectedPreviewFile {
  createdAt?: string;
  height?: number;
  name: string;
  size?: number;
  type: string;
  url: string;
  width?: number;
}

export function toSelectedPreviewFile(item: Media): SelectedPreviewFile {
  return {
    createdAt: item.createdAt,
    height: item.height ?? undefined,
    name: item.originalName || `${item.id}.${extensionForMimeType(item.mimeType)}`,
    size: item.sizeBytes ?? undefined,
    type: item.mimeType || 'application/octet-stream',
    url: item.localPath,
    width: item.width ?? undefined,
  };
}

export function previewRouteParams(files: SelectedPreviewFile[], index = 0): { files: string; index: string } {
  return { files: JSON.stringify(files), index: String(index) };
}

function extensionForMimeType(mimeType: string): string {
  const extension = mimeType.split('/')[1]?.split(';')[0];
  if (!extension || extension === 'jpeg') return 'jpg';
  return extension.replace('svg+xml', 'svg');
}
