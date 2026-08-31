import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SymbolView } from 'expo-symbols';
import * as Sharing from 'expo-sharing';
import { captureRef, releaseCapture } from 'react-native-view-shot';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import type { DayKey } from '@still-alive/types';
import { feedback } from '../../shared/feedback';
import { FeedbackDialog } from '../../shared/components/feedback-dialog';
import { createThemedStyles } from '../../shared/theme/app-theme';

interface PostShareDialogProps {
  children: ReactNode;
  contentReady: boolean;
  createdAt: string;
  dayKey: DayKey;
  locationName: string | null;
  onClose(): void;
}

export function PostShareDialog({ children, contentReady, createdAt, dayKey, locationName, onClose }: PostShareDialogProps) {
  const scrollRef = useRef<ScrollView>(null);
  const [contentHeight, setContentHeight] = useState(0);
  const [sharing, setSharing] = useState(false);
  const { height } = useWindowDimensions();
  const ready = contentReady && contentHeight > 0;
  const previewHeight = Math.min(430, Math.max(240, height - 300));

  const share = async () => {
    if (!ready || sharing) return;
    let captureUri: string | null = null;
    try {
      setSharing(true);
      await waitForPaint();
      captureUri = await captureRef(scrollRef, {
        format: 'png',
        result: 'tmpfile',
        snapshotContentContainer: true,
      });
      if (!await Sharing.isAvailableAsync()) {
        onClose();
        feedback.alert('当前设备不支持分享', '完整长图已经生成，但无法打开系统分享面板。');
        return;
      }
      await Sharing.shareAsync(toFileUri(captureUri), {
        dialogTitle: '分享这条记录',
        mimeType: 'image/png',
        UTI: 'public.png',
      });
    } catch {
      onClose();
      feedback.alert('长图生成失败', '无法生成完整长图。记录可能过长或媒体尚未加载，请稍后重试。');
    } finally {
      if (captureUri) releaseCapture(captureUri);
      setSharing(false);
    }
  };

  const date = formatCardDate(dayKey);

  return (
    <FeedbackDialog onRequestClose={() => { if (!sharing) onClose(); }}>
      <View style={styles.dialogHeader}>
        <View>
          <Text style={styles.dialogEyebrow}>SHARE AS IMAGE</Text>
          <Text style={styles.dialogTitle}>分享完整长图</Text>
        </View>
        <Pressable accessibilityLabel="关闭分享预览" accessibilityRole="button" disabled={sharing} onPress={onClose} style={({ pressed }) => [styles.closeButton, sharing && styles.disabled, pressed && styles.pressed]}>
          <SymbolView name={{ android: 'close', ios: 'xmark', web: 'close' }} size={19} tintColor={colors.inkSoft} type="hierarchical" />
        </Pressable>
      </View>
      <Text style={styles.dialogHint}>预览可上下滚动，分享时会生成一张包含全部内容的图片。</Text>

      <View style={[styles.previewFrame, { height: previewHeight }]}>
        <ScrollView
          alwaysBounceVertical
          bounces={false}
          canCancelContentTouches
          contentContainerStyle={[styles.shareCanvas, { minHeight: previewHeight }]}
          contentInsetAdjustmentBehavior="never"
          keyboardShouldPersistTaps="handled"
          nestedScrollEnabled
          onContentSizeChange={(_width, height) => setContentHeight(height)}
          removeClippedSubviews={false}
          ref={scrollRef}
          showsVerticalScrollIndicator
          style={styles.preview}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardRule} />
            <Text style={styles.cardEyebrow}>STILL ALIVE / RECORD</Text>
            <Text style={styles.cardDate}>{date.date}</Text>
            <Text style={styles.cardDay}>{date.day}</Text>
          </View>
          <View collapsable={false} pointerEvents="none" style={styles.cardBody}>{children}</View>
          <View style={styles.cardFooter}>
            <Text style={styles.cardMeta}>{locationName ? `${locationName} / ` : ''}记录于 {formatDate(dayKey)} {formatTime(createdAt)}</Text>
            <View style={styles.brandRow}><View style={styles.brandMark} /><Text style={styles.brand}>仍在 STILL ALIVE</Text></View>
          </View>
        </ScrollView>
      </View>

      <View style={styles.actions}>
        <Pressable accessibilityRole="button" disabled={sharing} onPress={onClose} style={({ pressed }) => [styles.cancelButton, sharing && styles.disabled, pressed && styles.pressed]}><Text style={styles.cancelText}>取消</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={!ready || sharing} onPress={() => void share()} style={({ pressed }) => [styles.shareButton, (!ready || sharing) && styles.disabled, pressed && styles.pressed]}>
          <SymbolView name={{ android: 'share', ios: 'square.and.arrow.up', web: 'share' }} size={18} tintColor={colors.onLife} type="hierarchical" />
          <Text style={styles.shareText}>{sharing ? '正在生成…' : ready ? '分享长图' : '正在准备…'}</Text>
        </Pressable>
      </View>
    </FeedbackDialog>
  );
}

function waitForPaint(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

function toFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri}`;
}

function formatCardDate(dayKey: string): { date: string; day: string } {
  const [year, month, day] = dayKey.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return {
    date: `${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`,
    day: `${year} / 周${['日', '一', '二', '三', '四', '五', '六'][date.getDay()]}`,
  };
}

function formatDate(dayKey: string): string {
  const [year, month, day] = dayKey.split('-');
  return `${year} 年 ${Number(month)} 月 ${Number(day)} 日`;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

const styles = createThemedStyles(() => ({
  dialogHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dialogEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 8, fontWeight: '700', letterSpacing: 1.2 },
  dialogTitle: { marginTop: 4, color: colors.ink, fontFamily: typography.display, fontSize: 21 },
  dialogHint: { marginTop: spacing.sm, color: colors.inkFaint, fontSize: typography.size.meta, lineHeight: 17 },
  closeButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19, backgroundColor: colors.paper },
  previewFrame: { height: 430, marginTop: spacing.md, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.sheet },
  preview: { flex: 1, minHeight: 0, backgroundColor: colors.sheet },
  shareCanvas: { padding: spacing.lg, backgroundColor: colors.sheet },
  cardHeader: { marginBottom: spacing.xl },
  cardRule: { width: 34, height: 3, marginBottom: spacing.md, backgroundColor: colors.life },
  cardEyebrow: { color: colors.life, fontFamily: typography.mono, fontSize: 8, fontWeight: '700', letterSpacing: 1.1 },
  cardDate: { marginTop: spacing.md, color: colors.ink, fontFamily: typography.display, fontSize: 37, lineHeight: 42 },
  cardDay: { marginTop: 2, color: colors.inkFaint, fontFamily: typography.mono, fontSize: 9, letterSpacing: 0.7 },
  cardBody: { width: '100%' },
  cardFooter: { marginTop: spacing.xl, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  cardMeta: { color: colors.inkFaint, fontSize: 8, lineHeight: 14 },
  brandRow: { marginTop: spacing.md, flexDirection: 'row', alignItems: 'center' },
  brandMark: { width: 6, height: 6, marginRight: spacing.xs, borderRadius: 3, backgroundColor: colors.life },
  brand: { color: colors.inkSoft, fontFamily: typography.mono, fontSize: 7, fontWeight: '700', letterSpacing: 0.8 },
  actions: { marginTop: spacing.md, flexDirection: 'row', gap: spacing.sm },
  cancelButton: { minHeight: 48, flex: 1, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.paper },
  cancelText: { color: colors.inkSoft, fontSize: typography.size.caption, fontWeight: '700' },
  shareButton: { minHeight: 48, flex: 1.6, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.life },
  shareText: { color: colors.onLife, fontSize: typography.size.caption, fontWeight: '700' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.66 },
}));
