'use dom';

import { FilePreviewModal } from '@eternalheart/react-file-preview';
import '@eternalheart/react-file-preview/style.css';
import type { DOMProps } from 'expo/dom';
import type { SelectedPreviewFile } from './file-preview.types';

interface FilePreviewProps {
  currentIndex: number;
  files: SelectedPreviewFile[];
  onClose(): void;
  onNavigate(index: number): void;
  readLocalFile(uri: string): Promise<string>;
  dom?: DOMProps;
}

export default function FilePreview({ currentIndex, files, onClose, onNavigate, readLocalFile }: FilePreviewProps) {
  return (
    <>
      <style>{FULLSCREEN_CSS}</style>
      <FilePreviewModal
        currentIndex={currentIndex}
        files={files}
        isOpen
        onClose={() => void onClose()}
        onNavigate={(index) => void onNavigate(index)}
        requestHandler={(url: string, init?: RequestInit) => requestFile(url, init, readLocalFile)}
        showDownload={false}
        shouldFetchAsBlob={() => true}
      />
    </>
  );
}

const FULLSCREEN_CSS = `
  html, body, #root { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #000; }
`;

async function requestFile(url: string, init: RequestInit | undefined, readLocalFile: (uri: string) => Promise<string>): Promise<Response> {
  if (!url.startsWith('file://')) return fetch(url, init);

  const base64 = await readLocalFile(url);
  const bytes = Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
  return new Response(new Blob([bytes], { type: mimeTypeForUrl(url) }), { status: 200 });
}

function mimeTypeForUrl(url: string): string {
  const extension = url.split('?')[0].split('.').pop()?.toLowerCase();
  if (extension === 'heic' || extension === 'heif') return 'image/heic';
  if (extension === 'jpg' || extension === 'jpeg') return 'image/jpeg';
  if (extension === 'png') return 'image/png';
  if (extension === 'webp') return 'image/webp';
  if (extension === 'gif') return 'image/gif';
  return 'application/octet-stream';
}
