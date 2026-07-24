import type { Media } from '@still-alive/types';

export interface SelectedPreviewFile {
  name: string;
  type: string;
  url: string;
  size?: number;
}

export function toSelectedPreviewFile(item: Media): SelectedPreviewFile {
  return {
    name: `${item.id}.${extensionForMimeType(item.mimeType)}`,
    type: item.mimeType || 'application/octet-stream',
    url: item.localPath,
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
