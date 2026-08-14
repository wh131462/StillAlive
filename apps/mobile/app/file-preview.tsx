import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { StatusBar } from 'expo-status-bar';
import { Animated, FlatList, type ImageLoadEventData, type LayoutChangeEvent, Modal, type NativeScrollEvent, type NativeSyntheticEvent, PanResponder, PixelRatio, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SelectedPreviewFile } from '../src/components/file-preview.types';

const DOUBLE_TAP_DELAY_MS = 280;
const DOUBLE_TAP_DISTANCE = 36;
const DOUBLE_TAP_SCALE = 2.5;
const MAX_SCALE = 100;
const MIN_GESTURE_DISTANCE = 4;

interface Size {
  width: number;
  height: number;
}

interface GestureStart {
  mode: 'idle' | 'pan' | 'pinch';
  scale: number;
  translateX: number;
  translateY: number;
  distance: number;
  imagePointX: number;
  imagePointY: number;
  moved: boolean;
}

interface InfoRow {
  detail?: string;
  icon: ComponentProps<typeof SymbolView>['name'];
  label: string;
  value: string;
}

export default function FilePreviewScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { files: filesParam, index: indexParam } = useLocalSearchParams<{ files?: string; index?: string }>();
  const initialFiles = parsePreviewFiles(filesParam);
  const [currentIndex, setCurrentIndex] = useState(() => clampIndex(Number(indexParam), initialFiles.length));
  const [imageSizes, setImageSizes] = useState<Record<number, Size>>({});
  const [infoOpen, setInfoOpen] = useState(false);
  const currentFile = initialFiles[currentIndex];
  const currentSize = imageSizes[currentIndex] ?? previewFileSize(currentFile);

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    setCurrentIndex(clampIndex(Math.round(event.nativeEvent.contentOffset.x / width), initialFiles.length));
  };

  const handleImageSize = useCallback((index: number, size: Size) => {
    setImageSizes((current) => current[index]?.width === size.width && current[index]?.height === size.height ? current : { ...current, [index]: size });
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable accessibilityLabel="关闭图片预览" accessibilityRole="button" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.closeButton, pressed && styles.controlPressed]}>
            <SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={21} tintColor="#FFFFFF" type="hierarchical" />
          </Pressable>
          {initialFiles.length ? <Text accessibilityLiveRegion="polite" style={styles.counter}>{currentIndex + 1} / {initialFiles.length}</Text> : null}
          {currentFile ? <Pressable accessibilityLabel="查看图片信息" accessibilityRole="button" hitSlop={8} onPress={() => setInfoOpen(true)} style={({ pressed }) => [styles.infoButton, pressed && styles.controlPressed]}><SymbolView name={{ android: 'info', ios: 'info.circle', web: 'info' }} size={21} tintColor="#FFFFFF" type="hierarchical" /></Pressable> : <View style={styles.headerSpacer} />}
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
          renderItem={({ item, index }) => <View style={[styles.page, { width }]}><ZoomableImage active={index === currentIndex} index={index} onSourceSize={(size) => handleImageSize(index, size)} uri={item.url} /></View>}
          showsHorizontalScrollIndicator={false}
          style={styles.preview}
        />
      </SafeAreaView>
      <ImageInfoSheet file={currentFile} onClose={() => setInfoOpen(false)} open={infoOpen} size={currentSize} />
    </View>
  );
}

function ImageInfoSheet({ file, onClose, open, size }: { file: SelectedPreviewFile | undefined; onClose(): void; open: boolean; size: Size | undefined }) {
  const insets = useSafeAreaInsets();
  if (!file) return null;
  const rows: InfoRow[] = [
    { icon: { android: 'aspect_ratio', ios: 'aspectratio', web: 'aspect_ratio' }, label: '分辨率', value: size ? `${Math.round(size.width)} × ${Math.round(size.height)}` : '未知' },
    { detail: file.type, icon: { android: 'image', ios: 'photo', web: 'image' }, label: '格式', value: imageFormat(file.type) },
    { icon: { android: 'hard_drive', ios: 'externaldrive', web: 'hard_drive' }, label: '文件大小', value: typeof file.size === 'number' ? formatBytes(file.size) : '未知' },
  ];
  if (file.createdAt) rows.push({ icon: { android: 'schedule', ios: 'clock', web: 'schedule' }, label: '添加时间', value: formatDateTime(file.createdAt) });
  return (
    <Modal animationType="slide" onRequestClose={onClose} statusBarTranslucent transparent visible={open}>
      <Pressable onPress={onClose} style={styles.infoBackdrop}>
        <Pressable accessibilityLabel="图片信息" accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={[styles.infoSheet, { paddingBottom: Math.max(22, insets.bottom + 12) }]}>
          <View style={styles.infoHandle} />
          <View style={styles.infoHeader}><View style={styles.infoTitleCopy}><Text style={styles.infoTitle}>图片信息</Text><Text numberOfLines={2} style={styles.infoName}>{file.name}</Text></View><Pressable accessibilityLabel="关闭图片信息" accessibilityRole="button" onPress={onClose} style={({ pressed }) => [styles.infoClose, pressed && styles.controlPressed]}><SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={19} tintColor="rgba(255, 255, 255, 0.78)" type="hierarchical" /></Pressable></View>
          <View style={styles.infoRows}>{rows.map((row) => <View key={row.label} style={styles.infoRow}><View style={styles.infoRowIcon}><SymbolView name={row.icon} size={20} tintColor="rgba(255, 255, 255, 0.7)" type="hierarchical" /></View><View style={styles.infoRowCopy}><Text style={styles.infoRowLabel}>{row.label}</Text><Text numberOfLines={1} style={styles.infoRowValue}>{row.value}</Text>{row.detail ? <Text numberOfLines={1} style={styles.infoRowDetail}>{row.detail}</Text> : null}</View></View>)}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ZoomableImage({ active, index, onSourceSize, uri }: { active: boolean; index: number; onSourceSize(size: Size): void; uri: string }) {
  const [viewport, setViewport] = useState<Size>({ width: 0, height: 0 });
  const [source, setSource] = useState<Size>({ width: 0, height: 0 });
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const lastTapRef = useRef({ time: 0, x: 0, y: 0 });
  const gestureRef = useRef<GestureStart>({ mode: 'idle', scale: 1, translateX: 0, translateY: 0, distance: 0, imagePointX: 0, imagePointY: 0, moved: false });
  const fittedSize = useMemo(() => containSize(source, viewport), [source, viewport]);
  const displaySize = fittedSize.width && fittedSize.height ? fittedSize : viewport;
  const maxScaleRef = useRef(MAX_SCALE);
  const viewportRef = useRef(viewport);
  const fittedSizeRef = useRef(fittedSize);

  useEffect(() => { viewportRef.current = viewport; }, [viewport]);
  useEffect(() => { fittedSizeRef.current = fittedSize; }, [fittedSize]);

  const applyTransform = useCallback((nextScale: number, nextX: number, nextY: number, animated = false) => {
    const boundedScale = clamp(nextScale, 1, maxScaleRef.current);
    const boundedTranslation = clampTranslation(nextX, nextY, boundedScale, fittedSizeRef.current, viewportRef.current);
    scaleRef.current = boundedScale;
    translateRef.current = boundedTranslation;
    if (animated) {
      Animated.parallel([
        Animated.spring(scale, { toValue: boundedScale, damping: 22, stiffness: 240, mass: 0.75, overshootClamping: true, useNativeDriver: true }),
        Animated.spring(translateX, { toValue: boundedTranslation.x, damping: 22, stiffness: 240, mass: 0.75, overshootClamping: true, useNativeDriver: true }),
        Animated.spring(translateY, { toValue: boundedTranslation.y, damping: 22, stiffness: 240, mass: 0.75, overshootClamping: true, useNativeDriver: true }),
      ]).start();
      return;
    }
    scale.setValue(boundedScale);
    translateX.setValue(boundedTranslation.x);
    translateY.setValue(boundedTranslation.y);
  }, [scale, translateX, translateY]);

  const reset = useCallback((animated = true) => applyTransform(1, 0, 0, animated), [applyTransform]);

  useEffect(() => {
    if (!active) reset(false);
  }, [active, reset]);

  useEffect(() => {
    const boundedScale = clamp(scaleRef.current, 1, MAX_SCALE);
    applyTransform(boundedScale, translateRef.current.x, translateRef.current.y);
  }, [applyTransform, viewport]);

  const handleTap = useCallback((x: number, y: number) => {
    const now = Date.now();
    const lastTap = lastTapRef.current;
    const isDoubleTap = now - lastTap.time <= DOUBLE_TAP_DELAY_MS && distanceBetween(x, y, lastTap.x, lastTap.y) <= DOUBLE_TAP_DISTANCE;
    lastTapRef.current = { time: now, x, y };
    if (!isDoubleTap || maxScaleRef.current <= 1) return;
    lastTapRef.current.time = 0;
    if (scaleRef.current > 1) {
      reset();
      return;
    }
    const targetScale = Math.min(DOUBLE_TAP_SCALE, maxScaleRef.current);
    const offsetX = x - viewportRef.current.width / 2;
    const offsetY = y - viewportRef.current.height / 2;
    applyTransform(targetScale, offsetX * (1 - targetScale), offsetY * (1 - targetScale), true);
  }, [applyTransform, reset]);

  const beginPinch = useCallback((touches: readonly { locationX: number; locationY: number }[]) => {
    const first = touches[0];
    const second = touches[1];
    if (!first || !second) return;
    const focalX = (first.locationX + second.locationX) / 2;
    const focalY = (first.locationY + second.locationY) / 2;
    gestureRef.current = {
      mode: 'pinch',
      scale: scaleRef.current,
      translateX: translateRef.current.x,
      translateY: translateRef.current.y,
      distance: distanceBetween(first.locationX, first.locationY, second.locationX, second.locationY),
      imagePointX: (focalX - viewportRef.current.width / 2 - translateRef.current.x) / scaleRef.current,
      imagePointY: (focalY - viewportRef.current.height / 2 - translateRef.current.y) / scaleRef.current,
      moved: true,
    };
  }, []);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponderCapture: (event) => event.nativeEvent.touches.length >= 2 || scaleRef.current > 1,
    onMoveShouldSetPanResponderCapture: (event, gesture) => event.nativeEvent.touches.length >= 2 || (scaleRef.current > 1 && (Math.abs(gesture.dx) > MIN_GESTURE_DISTANCE || Math.abs(gesture.dy) > MIN_GESTURE_DISTANCE)),
    onPanResponderGrant: (event) => {
      scale.stopAnimation();
      translateX.stopAnimation();
      translateY.stopAnimation();
      if (event.nativeEvent.touches.length >= 2) {
        beginPinch(event.nativeEvent.touches);
        return;
      }
      gestureRef.current = { mode: 'pan', scale: scaleRef.current, translateX: translateRef.current.x, translateY: translateRef.current.y, distance: 0, imagePointX: 0, imagePointY: 0, moved: false };
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      if (touches.length >= 2) {
        if (gestureRef.current.mode !== 'pinch') beginPinch(touches);
        const first = touches[0];
        const second = touches[1];
        if (!first || !second) return;
        const start = gestureRef.current;
        const pinchDistance = distanceBetween(first.locationX, first.locationY, second.locationX, second.locationY);
        const nextScale = start.distance > 0 ? start.scale * pinchDistance / start.distance : start.scale;
        const focalX = (first.locationX + second.locationX) / 2 - viewportRef.current.width / 2;
        const focalY = (first.locationY + second.locationY) / 2 - viewportRef.current.height / 2;
        applyTransform(nextScale, focalX - start.imagePointX * nextScale, focalY - start.imagePointY * nextScale);
        return;
      }
      const start = gestureRef.current;
      if (start.mode !== 'pan') return;
      start.moved ||= Math.abs(gesture.dx) > MIN_GESTURE_DISTANCE || Math.abs(gesture.dy) > MIN_GESTURE_DISTANCE;
      applyTransform(start.scale, start.translateX + gesture.dx, start.translateY + gesture.dy);
    },
    onPanResponderRelease: (event) => {
      const gesture = gestureRef.current;
      if (gesture.mode === 'pan' && !gesture.moved) handleTap(event.nativeEvent.locationX, event.nativeEvent.locationY);
      if (scaleRef.current <= 1) reset();
      gestureRef.current.mode = 'idle';
    },
    onPanResponderTerminate: () => {
      if (scaleRef.current <= 1) reset();
      gestureRef.current.mode = 'idle';
    },
  }), [applyTransform, beginPinch, handleTap, reset, scale, translateX, translateY]);

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setViewport({ width, height });
  };

  const handleLoad = (event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const { width, height } = event.nativeEvent.source;
    onSourceSize({ width, height });
    const pixelRatio = PixelRatio.get();
    setSource({ width: width / pixelRatio, height: height / pixelRatio });
  };

  return (
    <View onLayout={handleLayout} style={styles.zoomViewport} {...panResponder.panHandlers}>
      <Pressable onPress={(event) => handleTap(event.nativeEvent.locationX, event.nativeEvent.locationY)} style={styles.zoomPressable}>
        <Animated.Image
          accessibilityLabel={`第 ${index + 1} 张图片`}
          onLoad={handleLoad}
          resizeMode="contain"
          source={{ uri }}
          style={[styles.zoomImage, displaySize, { transform: [{ translateX }, { translateY }, { scale }] }]}
        />
      </Pressable>
    </View>
  );
}

function containSize(source: Size, viewport: Size): Size {
  if (!source.width || !source.height || !viewport.width || !viewport.height) return { width: 0, height: 0 };
  const scale = Math.min(viewport.width / source.width, viewport.height / source.height, 1);
  return { width: source.width * scale, height: source.height * scale };
}

function previewFileSize(file: SelectedPreviewFile | undefined): Size | undefined {
  if (!file || typeof file.width !== 'number' || typeof file.height !== 'number' || file.width <= 0 || file.height <= 0) return undefined;
  return { width: file.width, height: file.height };
}

function imageFormat(mimeType: string): string {
  const subtype = mimeType.split('/')[1]?.split(';')[0];
  if (!subtype) return '未知';
  if (subtype === 'jpeg') return 'JPEG';
  if (subtype === 'svg+xml') return 'SVG';
  return subtype.toUpperCase();
}

function formatBytes(bytes: number): string {
  if (bytes < 1_024) return `${Math.round(bytes)} B`;
  if (bytes < 1_048_576) return `${(bytes / 1_024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const pad = (part: number) => String(part).padStart(2, '0');
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function clampTranslation(x: number, y: number, scale: number, fitted: Size, viewport: Size): { x: number; y: number } {
  const maxX = Math.max(0, (fitted.width * scale - viewport.width) / 2);
  const maxY = Math.max(0, (fitted.height * scale - viewport.height) / 2);
  return { x: clamp(x, -maxX, maxX), y: clamp(y, -maxY, maxY) };
}

function distanceBetween(x1: number, y1: number, x2: number, y2: number): number {
  return Math.hypot(x2 - x1, y2 - y1);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
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
  infoButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: 'rgba(255, 255, 255, 0.1)' },
  preview: { flex: 1 },
  page: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  zoomViewport: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  zoomPressable: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' },
  zoomImage: { flexGrow: 0, flexShrink: 0 },
  infoBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0, 0, 0, 0.48)' },
  infoSheet: { paddingTop: 10, paddingHorizontal: 20, borderTopLeftRadius: 22, borderTopRightRadius: 22, backgroundColor: '#171717' },
  infoHandle: { width: 36, height: 4, marginBottom: 12, alignSelf: 'center', borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, 0.22)' },
  infoHeader: { minHeight: 62, flexDirection: 'row', alignItems: 'flex-start' },
  infoTitleCopy: { flex: 1, minWidth: 0, paddingTop: 3 },
  infoTitle: { color: '#FFFFFF', fontSize: 18, fontWeight: '700' },
  infoName: { marginTop: 5, color: 'rgba(255, 255, 255, 0.58)', fontSize: 11, lineHeight: 16 },
  infoClose: { width: 42, height: 42, marginLeft: 12, alignItems: 'center', justifyContent: 'center' },
  infoRows: { marginTop: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255, 255, 255, 0.12)' },
  infoRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255, 255, 255, 0.1)' },
  infoRowIcon: { width: 38, alignItems: 'flex-start', justifyContent: 'center' },
  infoRowCopy: { flex: 1, minWidth: 0, paddingVertical: 10 },
  infoRowLabel: { color: 'rgba(255, 255, 255, 0.5)', fontSize: 10 },
  infoRowValue: { marginTop: 3, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  infoRowDetail: { marginTop: 2, color: 'rgba(255, 255, 255, 0.4)', fontSize: 9 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyText: { color: 'rgba(255, 255, 255, 0.64)', fontSize: 14 },
});
