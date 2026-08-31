import type { PropsWithChildren } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing } from '@still-alive/tokens';
import { createThemedStyles } from '../theme/app-theme';

interface FeedbackDialogProps extends PropsWithChildren {
  onBackdropPress?: () => void;
  onRequestClose(): void;
}

export function FeedbackDialog({ children, onBackdropPress, onRequestClose }: FeedbackDialogProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const maxSurfaceHeight = Math.max(280, height - insets.top - insets.bottom - spacing.lg * 2);

  return (
    <Modal animationType="fade" onRequestClose={onRequestClose} transparent visible>
      <View style={styles.backdrop}>
        <Pressable accessible={false} onPress={onBackdropPress} style={StyleSheet.absoluteFill} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} pointerEvents="box-none" style={styles.keyboardView}>
          <View accessibilityRole="none" accessibilityViewIsModal style={[styles.surface, { maxHeight: maxSurfaceHeight }]}>
            {children}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const styles = createThemedStyles(() => ({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: colors.backdropStrong },
  keyboardView: { width: '100%', alignItems: 'center' },
  surface: { width: '100%', maxWidth: 420, padding: spacing.xl, borderRadius: radius.xl, backgroundColor: colors.sheet, shadowColor: colors.ink, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 24, elevation: 20 },
}));
