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
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../src/stores/authStore';
import { useUIStore } from '../../src/stores/uiStore';
import { Button, Input } from '../../src/components/ui';
import { colors } from '../../src/theme/colors';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const { showToast } = useUIStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [errors, setErrors] = useState({
    email: '',
    password: '',
    confirmPassword: '',
  });

  const validateForm = () => {
    let isValid = true;
    const newErrors = { email: '', password: '', confirmPassword: '' };

    if (!email) {
      newErrors.email = '请输入邮箱';
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = '请输入有效的邮箱地址';
      isValid = false;
    }

    if (!password) {
      newErrors.password = '请输入密码';
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = '密码至少6位';
      isValid = false;
    }

    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
      isValid = false;
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次密码不一致';
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleRegister = async () => {
    clearError();
    if (!validateForm()) return;

    try {
      await register(email, password, nickname || undefined);
      showToast({ type: 'success', message: '注册成功' });
      router.replace('/(tabs)');
    } catch {
      showToast({ type: 'error', message: error || '注册失败' });
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
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={colors.textSecondary} />
            <Text style={styles.backText}>返回</Text>
          </TouchableOpacity>
          <Text style={styles.title}>创建账号</Text>
          <Text style={styles.subtitle}>开始记录你的生存轨迹</Text>
        </View>

        {/* Form Section */}
        <View style={styles.formSection}>
          <Input
            placeholder="邮箱"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email}
          />

          <Input
            placeholder="密码（至少6位）"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            error={errors.password}
          />

          <Input
            placeholder="确认密码"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            error={errors.confirmPassword}
          />

          <Input
            placeholder="昵称（选填）"
            value={nickname}
            onChangeText={setNickname}
          />

          <Button
            title="注册"
            onPress={handleRegister}
            loading={isLoading}
            fullWidth
            size="lg"
            style={styles.registerButton}
          />
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
    paddingTop: 60,
  },
  header: {
    marginBottom: 32,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backText: {
    color: colors.textSecondary,
    fontSize: 16,
    marginLeft: 4,
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
    flex: 1,
  },
  registerButton: {
    marginTop: 8,
  },
});
