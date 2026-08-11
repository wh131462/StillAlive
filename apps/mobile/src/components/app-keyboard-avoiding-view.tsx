import { useEffect, useState } from 'react';
import type { ComponentProps } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform } from 'react-native';

type AppKeyboardAvoidingViewProps = ComponentProps<typeof KeyboardAvoidingView> & {
  mode?: 'active' | 'system';
};

export function AppKeyboardAvoidingView({ behavior = Platform.OS === 'ios' ? 'padding' : 'height', enabled = true, mode = 'active', ...props }: AppKeyboardAvoidingViewProps) {
  const [keyboardVisible, setKeyboardVisible] = useState(() => Keyboard.isVisible());

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => { showSubscription.remove(); hideSubscription.remove(); };
  }, []);

  const active = mode === 'active' && enabled && keyboardVisible;
  return <KeyboardAvoidingView {...props} behavior={active ? behavior : undefined} enabled={active} />;
}
