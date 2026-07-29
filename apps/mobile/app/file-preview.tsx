import { useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { FlatList, Image, type NativeScrollEvent, type NativeSyntheticEvent, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { SelectedPreviewFile } from '../src/components/file-preview.types';

export default function FilePreviewScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { files: filesParam, index: indexParam } = useLocalSearchParams<{ files?: string; index?: string }>();
  const initialFiles = parsePreviewFiles(filesParam);
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(Number(indexParam), initialFiles.length));

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentIndex(clampIndex(Math.round(event.nativeEvent.contentOffset.x / width), initialFiles.length));
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="关闭图片预览" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.controlPressed]}>
            <SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={21} tintColor="#FFFFFF" type="hierarchical" />
          </Pressable>
          {initialFiles.length ? <Text accessibilityLiveRegion="polite" style={styles.counter}>{currentIndex + 1} / {initialFiles.length}</Text> : null}
          <View style={styles.headerSpacer} />
        </View>
        <FlatList
          data={initialFiles}
          getItemLayout={(_data, index) => ({ index, length: width, offset: width * index })}
          horizontal
          initialScrollIndex={currentIndex}
          keyExtractor={(item, index) => `${item.url}_${index}`}
          ListEmptyComponent={<View style={[styles.empty, { width }]}><Text style={styles.emptyText}>图片不可用</Text></View>}
          onMomentumScrollEnd={handleScrollEnd}
          pagingEnabled
          renderItem={({ item, index }) => <View style={[styles.page, { width }]}><Image accessibilityLabel={`第 ${index + 1} 张图片`} resizeMode="contain" source={{ uri: item.url }} style={styles.image} /></View>}
          showsHorizontalScrollIndicator={false}
          style={styles.preview}
        />
      </SafeAreaView>
    </View>
  );
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
  safeArea: { flex: 1 },
  header: { height: 52, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  controlPressed: { opacity: 0.62 },
  counter: { color: 'rgba(255, 255, 255, 0.82)', fontSize: 12, fontVariant: ['tabular-nums'], fontWeight: '600', letterSpacing: 0.6 },
  headerSpacer: { width: 44 },
  preview: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  image: { width: '100%', height: '100%' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: 'rgba(255, 255, 255, 0.64)', fontSize: 14 },
});
