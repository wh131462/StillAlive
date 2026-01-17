import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useUIStore } from '../../src/stores/uiStore';
import { Button, Input } from '../../src/components/ui';
import { PasswordStrength } from '../../src/components/ui/PasswordStrength';
import { colors } from '../../src/theme/colors';

type Step = 'email' | 'verify' | 'reset' | 'success';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendResetCode, verifyResetCode, resetPassword, isLoading, error, clearError, clearResetState } = useAuthStore();
  const { showToast } = useUIStore();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [countdown, setCountdown] = useState(0);

  const codeInputRefs = useRef<(TextInput | null)[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearResetState();
    };
  }, [clearResetState]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const validateEmail = () => {
    setEmailError('');
    if (!email) {
      setEmailError('请输入邮箱');
      return false;
    }
    if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('请输入有效的邮箱地址');
      return false;
    }
    return true;
  };

  const validatePassword = () => {
    setPasswordError('');
    if (!newPassword) {
      setPasswordError('请输入新密码');
      return false;
    }
    if (newPassword.length < 6) {
      setPasswordError('密码至少需要6位');
      return false;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('两次输入的密码不一致');
      return false;
    }
    return true;
  };

  const handleSendCode = async () => {
    clearError();
    if (!validateEmail()) return;

    try {
      const devCode = await sendResetCode(email);
      if (devCode) {
        // In dev mode, show the code
        showToast({ type: 'info', message: `开发模式验证码: ${devCode}` });
      } else {
        showToast({ type: 'success', message: '验证码已发送到您的邮箱' });
      }
      setStep('verify');
      setCountdown(60);
    } catch {
      showToast({ type: 'error', message: error || '发送验证码失败' });
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const pastedCode = value.slice(0, 6).split('');
      const newCode = [...code];
      pastedCode.forEach((char, i) => {
        if (index + i < 6) {
          newCode[index + i] = char;
        }
      });
      setCode(newCode);
      // Focus last filled or next empty
      const lastIndex = Math.min(index + pastedCode.length, 5);
      codeInputRefs.current[lastIndex]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const handleCodeKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    clearError();
    const fullCode = code.join('');
    if (fullCode.length !== 6) {
      showToast({ type: 'error', message: '请输入完整的6位验证码' });
      return;
    }

    try {
      const valid = await verifyResetCode(email, fullCode);
      if (valid) {
        setStep('reset');
      } else {
        showToast({ type: 'error', message: '验证码无效或已过期' });
      }
    } catch {
      showToast({ type: 'error', message: error || '验证失败' });
    }
  };

  const handleResetPassword = async () => {
    clearError();
    if (!validatePassword()) return;

    try {
      await resetPassword(email, code.join(''), newPassword);
      setStep('success');
      showToast({ type: 'success', message: '密码重置成功' });
    } catch {
      showToast({ type: 'error', message: error || '重置密码失败' });
    }
  };

  const handleGoBack = () => {
    if (step === 'email') {
      router.back();
    } else if (step === 'verify') {
      setStep('email');
      setCode(['', '', '', '', '', '']);
    } else if (step === 'reset') {
      setStep('verify');
    }
  };

  const renderEmailStep = () => (
    <>
      <View style={styles.iconContainer}>
        <Ionicons name="mail-outline" size={48} color={colors.primary} />
      </View>
      <Text style={styles.title}>忘记密码</Text>
      <Text style={styles.description}>
        请输入您注册时使用的邮箱，我们将发送验证码帮助您重置密码
      </Text>

      <View style={styles.formSection}>
        <Input
          placeholder="邮箱"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          error={emailError}
        />
        <Button
          title="发送验证码"
          onPress={handleSendCode}
          loading={isLoading}
          fullWidth
          size="lg"
        />
      </View>
    </>
  );

  const renderVerifyStep = () => (
    <>
      <View style={styles.iconContainer}>
        <Ionicons name="shield-checkmark-outline" size={48} color={colors.primary} />
      </View>
      <Text style={styles.title}>验证邮箱</Text>
      <Text style={styles.description}>
        验证码已发送到 {email}
      </Text>

      <View style={styles.codeContainer}>
        {code.map((digit, index) => (
          <TextInput
            key={index}
            ref={(ref) => (codeInputRefs.current[index] = ref)}
            style={[styles.codeInput, digit ? styles.codeInputFilled : null]}
            value={digit}
            onChangeText={(value) => handleCodeChange(index, value)}
            onKeyPress={({ nativeEvent }) => handleCodeKeyPress(index, nativeEvent.key)}
            keyboardType="number-pad"
            maxLength={6}
            selectTextOnFocus
          />
        ))}
      </View>

      <View style={styles.resendContainer}>
        {countdown > 0 ? (
          <Text style={styles.countdownText}>{countdown}秒后可重新发送</Text>
        ) : (
          <TouchableOpacity onPress={handleSendCode} disabled={isLoading}>
            <Text style={styles.resendText}>重新发送验证码</Text>
          </TouchableOpacity>
        )}
      </View>

      <Button
        title="验证"
        onPress={handleVerifyCode}
        loading={isLoading}
        fullWidth
        size="lg"
        disabled={code.join('').length !== 6}
      />
    </>
  );

  const renderResetStep = () => (
    <>
      <View style={styles.iconContainer}>
        <Ionicons name="lock-closed-outline" size={48} color={colors.primary} />
      </View>
      <Text style={styles.title}>设置新密码</Text>
      <Text style={styles.description}>
        请设置一个安全的新密码
      </Text>

      <View style={styles.formSection}>
        <Input
          placeholder="新密码"
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
        />
        <PasswordStrength password={newPassword} />
        <Input
          placeholder="确认新密码"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          error={passwordError}
        />
        <Button
          title="重置密码"
          onPress={handleResetPassword}
          loading={isLoading}
          fullWidth
          size="lg"
        />
      </View>
    </>
  );

  const renderSuccessStep = () => (
    <>
      <View style={[styles.iconContainer, styles.successIcon]}>
        <Ionicons name="checkmark" size={48} color="#fff" />
      </View>
      <Text style={styles.title}>密码重置成功</Text>
      <Text style={styles.description}>
        您的密码已成功重置，请使用新密码登录
      </Text>

      <Button
        title="返回登录"
        onPress={() => router.replace('/(auth)/login')}
        fullWidth
        size="lg"
        style={{ marginTop: 24 }}
      />
    </>
  );

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        {step !== 'success' && (
          <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
            <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        )}

        {/* Step Indicator */}
        {step !== 'success' && (
          <View style={styles.stepIndicator}>
            <View style={[styles.stepDot, step === 'email' && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step === 'verify' && styles.stepDotActive]} />
            <View style={styles.stepLine} />
            <View style={[styles.stepDot, step === 'reset' && styles.stepDotActive]} />
          </View>
        )}

        {/* Content */}
        <View style={styles.content}>
          {step === 'email' && renderEmailStep()}
          {step === 'verify' && renderVerifyStep()}
          {step === 'reset' && renderResetStep()}
          {step === 'success' && renderSuccessStep()}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 32,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.border,
  },
  stepDotActive: {
    backgroundColor: colors.primary,
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  stepLine: {
    width: 40,
    height: 2,
    backgroundColor: colors.border,
    marginHorizontal: 8,
  },
  content: {
    flex: 1,
    alignItems: 'center',
  },
  iconContainer: {
    width: 96,
    height: 96,
    backgroundColor: colors.primaryLight,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successIcon: {
    backgroundColor: colors.primary,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
    paddingHorizontal: 16,
  },
  formSection: {
    width: '100%',
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  codeInputFilled: {
    borderColor: colors.primary,
  },
  resendContainer: {
    marginBottom: 24,
    alignItems: 'center',
  },
  countdownText: {
    color: colors.textMuted,
    fontSize: 14,
  },
  resendText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
  },
});
