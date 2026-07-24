import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { File } from 'expo-file-system';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import FilePreview from '../src/components/file-preview.dom';
import type { SelectedPreviewFile } from '../src/components/file-preview.types';

export default function FilePreviewScreen() {
  const router = useRouter();
  const { files: filesParam, index: indexParam } = useLocalSearchParams<{ files?: string; index?: string }>();
  const initialFiles = parsePreviewFiles(filesParam);
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(Number(indexParam), initialFiles.length));

  return (
    <>
      <StatusBar style="light" />
      <SafeAreaView edges={['top']} style={styles.screen}>
        <FilePreview
          currentIndex={currentIndex}
          dom={{
            allowFileAccess: true,
            automaticallyAdjustContentInsets: false,
            contentInsetAdjustmentBehavior: 'never',
            scrollEnabled: false,
            style: styles.preview,
          }}
          files={initialFiles}
          onClose={() => router.back()}
          onNavigate={setCurrentIndex}
          readLocalFile={readLocalFile}
        />
      </SafeAreaView>
    </>
  );
}

async function readLocalFile(uri: string): Promise<string> {
  return new File(uri).base64();
}

function parsePreviewFiles(value: string | string[] | undefined): SelectedPreviewFile[] {
  if (!value || Array.isArray(value)) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPreviewFile);
  } catch {
    return [];
  }
}

function isPreviewFile(value: unknown): value is SelectedPreviewFile {
  if (!value || typeof value !== 'object') return false;
  const file = value as Partial<SelectedPreviewFile>;
  return typeof file.name === 'string' && typeof file.type === 'string' && typeof file.url === 'string';
}

function clampIndex(value: number, length: number): number {
  if (!length || !Number.isFinite(value)) return 0;
  return Math.min(Math.max(0, value), length - 1);
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  preview: { flex: 1, backgroundColor: '#000' },
});
