import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';

interface PasswordStrengthProps {
  password: string;
}

type StrengthLevel = 'weak' | 'medium' | 'strong';

interface StrengthInfo {
  level: StrengthLevel;
  label: string;
  color: string;
  progress: number; // 0-3
}

export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strengthInfo = useMemo((): StrengthInfo => {
    if (!password) {
      return { level: 'weak', label: '', color: colors.border, progress: 0 };
    }

    let score = 0;

    // Length check
    if (password.length >= 6) score++;
    if (password.length >= 10) score++;

    // Has number
    if (/\d/.test(password)) score++;

    // Has lowercase
    if (/[a-z]/.test(password)) score++;

    // Has uppercase
    if (/[A-Z]/.test(password)) score++;

    // Has special character
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) score++;

    if (score <= 2) {
      return { level: 'weak', label: '弱', color: '#ef4444', progress: 1 };
    } else if (score <= 4) {
      return { level: 'medium', label: '中', color: '#f59e0b', progress: 2 };
    } else {
      return { level: 'strong', label: '强', color: '#10b981', progress: 3 };
    }
  }, [password]);

  if (!password) return null;

  return (
    <View style={styles.container}>
      <View style={styles.barsContainer}>
        {[1, 2, 3].map((index) => (
          <View
            key={index}
            style={[
              styles.bar,
              index <= strengthInfo.progress
                ? { backgroundColor: strengthInfo.color }
                : { backgroundColor: colors.border },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.label, { color: strengthInfo.color }]}>
        {strengthInfo.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: -8,
    marginBottom: 16,
  },
  barsContainer: {
    flex: 1,
    flexDirection: 'row',
    gap: 4,
  },
  bar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 8,
    minWidth: 20,
  },
});

export default PasswordStrength;
