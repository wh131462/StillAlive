import { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Animated, Dimensions, Easing, Modal, PanResponder, Pressable, View } from 'react-native';
import type { ComponentProps, ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { colors, radius } from '@still-alive/tokens';
import { AppKeyboardAvoidingView } from './app-keyboard-avoiding-view';
import { createThemedStyles } from '../theme/app-theme';

const DISMISS_THRESHOLD = 110;
const DISMISS_VELOCITY = 0.85;
const ANIMATION_DURATION = 240;
const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

interface DraggableBottomSheetProps {
  children: ReactNode;
  open: boolean;
  onClose(): void;
  onRequestClose?(): void;
  accessibilityLabel?: string;
  accessibilityRole?: ComponentProps<typeof Pressable>['accessibilityRole'];
  backdropStyle?: StyleProp<ViewStyle>;
  dismissDisabled?: boolean;
  handleStyle?: StyleProp<ViewStyle>;
  keyboardAvoiding?: boolean;
  sheetStyle?: StyleProp<ViewStyle>;
  statusBarTranslucent?: boolean;
}

/** Bottom-sheet shell with a consistent grabber and pull-down-to-dismiss gesture. */
export function DraggableBottomSheet({ accessibilityLabel, accessibilityRole, backdropStyle, children, dismissDisabled = false, handleStyle, keyboardAvoiding = false, onClose, onRequestClose, open, sheetStyle, statusBarTranslucent = false }: DraggableBottomSheetProps) {
  const entryOffset = useRef(Math.max(Dimensions.get('screen').height, 640)).current;
  const translateY = useRef(new Animated.Value(entryOffset)).current;
  const dismissing = useRef(false);

  useLayoutEffect(() => {
    if (!open) return;
    dismissing.current = false;
    translateY.setValue(entryOffset);
    Animated.timing(translateY, {
      toValue: 0,
      duration: ANIMATION_DURATION,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [entryOffset, open, translateY]);

  const dismiss = useCallback(() => {
    if (dismissDisabled) return;
    if (dismissing.current) return;
    dismissing.current = true;
    Animated.timing(translateY, {
      toValue: entryOffset,
      duration: ANIMATION_DURATION,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished) onClose();
    });
  }, [dismissDisabled, entryOffset, onClose, translateY]);

  const pan = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 6 && gesture.dy > Math.abs(gesture.dx),
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => translateY.stopAnimation(),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (dismissDisabled) {
        Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
        return;
      }
      if (gesture.dy > DISMISS_THRESHOLD || gesture.vy > DISMISS_VELOCITY) {
        dismiss();
        return;
      }
      Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start();
    },
    onPanResponderTerminate: () => Animated.spring(translateY, { toValue: 0, damping: 22, stiffness: 260, mass: 0.8, useNativeDriver: true }).start(),
  }), [dismiss, dismissDisabled, translateY]);

  const body = (
    <Pressable onPress={dismiss} style={[styles.backdrop, backdropStyle]}>
      <AnimatedPressable accessibilityRole={accessibilityRole} accessibilityViewIsModal onPress={(event) => event.stopPropagation()} style={[styles.sheet, sheetStyle, styles.sheetTopAligned, { transform: [{ translateY }] }]}>
        <View {...pan.panHandlers} accessibilityLabel={accessibilityLabel ?? '向下拖动关闭'} accessibilityRole="button" hitSlop={12} style={styles.grabber}><View style={[styles.handle, handleStyle]} /></View>
        {children}
      </AnimatedPressable>
    </Pressable>
  );

  return <Modal animationType="none" onRequestClose={onRequestClose ?? dismiss} statusBarTranslucent={statusBarTranslucent} transparent visible={open}>{keyboardAvoiding ? <AppKeyboardAvoidingView style={styles.flex}>{body}</AppKeyboardAvoidingView> : body}</Modal>;
}

const styles = createThemedStyles(() => ({
  flex: { flex: 1 },
  backdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.backdrop },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: colors.sheet },
  sheetTopAligned: { paddingTop: 0 },
  grabber: { width: 64, height: 20, alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  handle: { width: 38, height: 4, borderRadius: 2, backgroundColor: colors.line },
}));
