import { useCallback, useEffect, useRef, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { colors, radius, spacing, typography } from '@still-alive/tokens';
import { registerFeedbackPresenter } from '../shared/feedback';
import type { FeedbackButton, FeedbackRequest } from '../shared/feedback';
import { createThemedStyles } from '../shared/theme/app-theme';
import { FeedbackDialog } from '../shared/components/feedback-dialog';

export function FeedbackProvider({ children }: PropsWithChildren) {
  const [request, setRequest] = useState<FeedbackRequest | null>(null);
  const activeRequest = useRef<FeedbackRequest | null>(null);
  const queuedRequests = useRef<FeedbackRequest[]>([]);

  const show = useCallback((nextRequest: FeedbackRequest) => {
    if (activeRequest.current) {
      queuedRequests.current.push(nextRequest);
      return;
    }
    activeRequest.current = nextRequest;
    setRequest(nextRequest);
  }, []);

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
    </>
  );
}

function FeedbackModal({ request, onClose, onPress }: { request: FeedbackRequest | null; onClose(): void; onPress(button?: FeedbackButton, value?: string): void }) {
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
  input: { minHeight: 48, marginTop: spacing.md, paddingHorizontal: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, borderRadius: radius.md, color: colors.ink, backgroundColor: colors.paper, fontSize: typography.size.body },
  actions: { marginTop: spacing.lg, gap: spacing.sm, flexShrink: 0 },
  button: { minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md },
  buttonPrimary: { backgroundColor: colors.life },
  buttonCancel: { backgroundColor: colors.paper },
  buttonDanger: { backgroundColor: colors.dangerLight, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.dangerLine },
  buttonText: { fontSize: typography.size.caption, fontWeight: '700' },
  buttonPrimaryText: { color: colors.onLife },
  buttonCancelText: { color: colors.inkSoft },
  buttonDangerText: { color: colors.danger },
  buttonPressed: { opacity: 0.68 },
}));
