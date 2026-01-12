import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useUIStore } from '../../src/stores/uiStore';
import { Button, Input } from '../../src/components/ui';
import { colors } from '../../src/theme/colors';

export default function LoginScreen() {
  const router = useRouter();
  const { login, isLoading, error, clearError } = useAuthStore();
  const { showToast } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const validateForm = () => {
    let isValid = true;
    setEmailError('');
    setPasswordError('');

    if (!email) {
      setEmailError('请输入邮箱');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      setEmailError('请输入有效的邮箱地址');
      isValid = false;
    }

    if (!password) {
      setPasswordError('请输入密码');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    clearError();
    if (!validateForm()) return;

    try {
      await login(email, password);
      showToast({ type: 'success', message: '登录成功' });
      router.replace('/(tabs)');
    } catch {
      showToast({ type: 'error', message: error || '登录失败' });
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo Section */}
        <View style={styles.logoSection}>
          <View style={styles.logoContainer}>
            <Ionicons name="heart" size={48} color={colors.primary} />
          </View>
          <Text style={styles.title}>今天又活了一天</Text>
          <Text style={styles.subtitle}>记录生存，沉淀记忆</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Input
            placeholder="邮箱"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={emailError}
          />

          <Input
            placeholder="密码"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={passwordError}
          />

          <Button
            title="登录"
            onPress={handleLogin}
            loading={isLoading}
            fullWidth
            size="lg"
            style={styles.loginButton}
          />

          <View style={styles.registerLink}>
            <Text style={styles.registerText}>还没有账号？</Text>
            <Link href="/(auth)/register" asChild>
              <TouchableOpacity>
                <Text style={styles.registerLinkText}>立即注册</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>"原来你还活着啊"</Text>
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
    justifyContent: 'center',
    padding: 24,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 96,
    height: 96,
    backgroundColor: colors.primaryLight,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  formSection: {
    marginBottom: 24,
  },
  loginButton: {
    marginTop: 8,
  },
  registerLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
  },
  registerText: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  registerLinkText: {
    color: colors.primary,
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 4,
  },
  footer: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingTop: 24,
  },
  footerText: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
});
