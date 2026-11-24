import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { registerFeedbackPresenter } from '../shared/feedback';
import type { FeedbackAlertRequest, FeedbackButton, FeedbackNoticeRequest, FeedbackPromptRequest, FeedbackRequest } from '../shared/feedback';
import { createThemedStyles } from '../shared/theme/app-theme';
import { FeedbackDialog } from '../shared/components/feedback-dialog';

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<FeedbackAlertRequest | FeedbackPromptRequest | null>(null);
  const [notice, setNotice] = useState<FeedbackNoticeRequest | null>(null);
  const activeRequest = useRef<FeedbackAlertRequest | FeedbackPromptRequest | null>(null);
  const queuedRequests = useRef<Array<FeedbackAlertRequest | FeedbackPromptRequest>>([]);

  const show = useCallback((nextRequest: FeedbackRequest) => {
    if (nextRequest.kind === 'notice') {
      setNotice(nextRequest);
      return;
    }
    if (activeRequest.current) {
      queuedRequests.current.push(nextRequest);
      return;
    }
    activeRequest.current = nextRequest;
    setRequest(nextRequest);
  }, []);
  const hideNotice = useCallback(() => setNotice(null), []);

  useEffect(() => registerFeedbackPresenter(show), [show]);

  const dismiss = useCallback((button?: FeedbackButton, value?: string) => {
    const completedRequest = activeRequest.current;
    activeRequest.current = null;
    setRequest(null);
    if (completedRequest?.kind === 'prompt') {
      if (value !== undefined) completedRequest.onSubmit(value);
    } else {
      button?.onPress?.();
    }
    if (!activeRequest.current) {
      const nextRequest = queuedRequests.current.shift();
      if (nextRequest) show(nextRequest);
    }
  }, [show]);

  const close = useCallback(() => {
    if (!request) return;
    if (request.kind === 'prompt') {
      dismiss();
      return;
    }
    const cancelButton = request.buttons.find((button) => button.style === 'cancel');
    if (cancelButton) dismiss(cancelButton);
    else if (request.buttons.length === 1) dismiss(request.buttons[0]);
    else if (request.buttons.length === 0) dismiss();
  }, [dismiss, request]);

  return (
    <>
      {children}
      <FeedbackModal request={request} onClose={close} onPress={dismiss} />
      <QuietNotice request={notice} onHide={hideNotice} />
    </>
  );
}

function FeedbackModal({ request, onClose, onPress }: { request: FeedbackAlertRequest | FeedbackPromptRequest | null; onClose(): void; onPress(button?: FeedbackButton, value?: string): void }) {
  const [value, setValue] = useState('');
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const messageMaxHeight = Math.max(180, height - insets.top - insets.bottom - 360);

  useEffect(() => {
    if (request?.kind === 'prompt') setValue(request.defaultValue ?? '');
  }, [request]);

  if (!request) return null;
  const buttons = request.kind === 'alert' ? request.buttons : [];
  const visibleButtons = buttons.length ? buttons : [{ text: request.kind === 'prompt' ? '取消' : '知道了', style: 'default' as const }];
  const hasDestructive = visibleButtons.some((button) => button.style === 'destructive');
  const hasError = hasDestructive || /失败|错误|无法|不存在|无效|不足|不支持|未完成/.test(request.title);

  return (
    <FeedbackDialog onRequestClose={onClose}>
      <View style={[styles.badge, hasError && styles.badgeDanger]}>
        <SymbolView name={{ android: hasError ? 'warning' : 'info', ios: hasError ? 'exclamationmark.triangle' : 'info.circle', web: hasError ? 'warning' : 'info' }} size={20} tintColor={hasError ? colors.danger : colors.life} type="hierarchical" />
      </View>
      <Text style={styles.title}>{request.title}</Text>
      {request.message ? <ScrollView bounces={false} contentContainerStyle={styles.messageContent} nestedScrollEnabled persistentScrollbar showsVerticalScrollIndicator scrollIndicatorInsets={{ right: 1 }} style={[styles.messageScroll, { maxHeight: messageMaxHeight }]}><Text style={styles.message}>{request.message}</Text></ScrollView> : null}
      {request.kind === 'prompt' ? <TextInput autoFocus onChangeText={setValue} onSubmitEditing={() => onPress(undefined, value)} placeholder="请输入" placeholderTextColor={colors.inkFaint} returnKeyType="done" selectTextOnFocus style={styles.input} value={value} /> : null}
      <View style={styles.actions}>
        {request.kind === 'prompt' ? (
          <>
            <FeedbackButtonView button={{ text: '取消', style: 'cancel' }} onPress={() => onClose()} />
            <FeedbackButtonView button={{ text: '保存', style: 'default' }} onPress={() => onPress(undefined, value)} />
          </>
        ) : visibleButtons.map((button, index) => <FeedbackButtonView button={button} key={`${button.text}-${index}`} onPress={() => onPress(button)} />)}
      </View>
    </FeedbackDialog>
  );
}

function QuietNotice({ request, onHide }: { request: FeedbackNoticeRequest | null; onHide(): void }) {
  const insets = useSafeAreaInsets();
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    if (!request) return;
    opacity.setValue(0);
    translateY.setValue(10);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
    const timer = setTimeout(() => {
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 180, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 8, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onHide();
      });
    }, request.durationMs ?? 2400);
    return () => {
      clearTimeout(timer);
      opacity.stopAnimation();
      translateY.stopAnimation();
    };
  }, [onHide, opacity, request, translateY]);

  if (!request) return null;
  return (
    <View pointerEvents="none" style={[styles.noticeLayer, { bottom: insets.bottom + 88 }]}>
      <Animated.View accessibilityLabel={request.message} accessibilityLiveRegion="polite" accessible style={[styles.notice, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.noticeText}>{request.message}</Text>
      </Animated.View>
    </View>
  );
}

function FeedbackButtonView({ button, onPress }: { button: FeedbackButton; onPress(): void }) {
  const destructive = button.style === 'destructive';
  const cancel = button.style === 'cancel';
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.button, destructive ? styles.buttonDanger : cancel ? styles.buttonCancel : styles.buttonPrimary, pressed && styles.buttonPressed]}><Text style={[styles.buttonText, destructive ? styles.buttonDangerText : cancel ? styles.buttonCancelText : styles.buttonPrimaryText]}>{button.text}</Text></Pressable>;
}

const styles = createThemedStyles(() => ({
  badge: { width: 40, height: 40, marginBottom: spacing.md, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.lifeLight },
  badgeDanger: { backgroundColor: colors.dangerLight },
  title: { color: colors.ink, fontFamily: typography.display, fontSize: 21, lineHeight: 27 },
  messageScroll: { minHeight: 0, marginTop: spacing.sm, flexGrow: 0, flexShrink: 1 },
  messageContent: { paddingRight: spacing.xs },
  message: { color: colors.inkSoft, fontSize: typography.size.caption, lineHeight: 21 },
  input: { minHeight: 48, marginTop: spacing.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: 6, color: colors.ink, backgroundColor: colors.paper, fontSize: typography.size.body },
  actions: { marginTop: spacing.lg, gap: spacing.sm, flexShrink: 0 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: 6 },
  buttonPrimary: { backgroundColor: colors.life },
  buttonCancel: { backgroundColor: colors.paper },
  buttonDanger: { backgroundColor: colors.dangerLight, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine },
  buttonText: { fontSize: typography.size.caption, fontWeight: '700' },
  buttonPrimaryText: { color: colors.onLife },
  buttonCancelText: { color: colors.inkSoft },
  buttonDangerText: { color: colors.danger },
  buttonPressed: { opacity: 0.68 },
  noticeLayer: { position: 'absolute', left: 0, right: 0, alignItems: 'center', zIndex: 30 },
  notice: { maxWidth: '86%', minHeight: 40, paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.ink, shadowColor: colors.ink, shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  noticeText: { color: colors.paper, fontSize: 12, lineHeight: 17, fontWeight: '600', textAlign: 'center' },
}));
