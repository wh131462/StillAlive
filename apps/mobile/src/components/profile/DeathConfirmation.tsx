import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Switch, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { EmergencyConfig } from '@still-alive/types';
import { colors } from '../../theme/colors';

const TRIGGER_OPTIONS = [
  { value: 3, label: '连续 3 天未打卡' },
  { value: 7, label: '连续 7 天未打卡' },
  { value: 14, label: '连续 14 天未打卡' },
  { value: 30, label: '连续 30 天未打卡' },
];

interface DeathConfirmationProps {
  config: EmergencyConfig | null;
  isLoading?: boolean;
  onUpdate: (data: Partial<EmergencyConfig>) => void;
}

export default function DeathConfirmation({
  config,
  isLoading,
  onUpdate,
}: DeathConfirmationProps) {
  const [isEnabled, setIsEnabled] = useState(config?.isEnabled ?? false);
  const [triggerDays, setTriggerDays] = useState(config?.triggerDays ?? 7);
  const [email, setEmail] = useState(config?.email ?? '');
  const [showTriggerPicker, setShowTriggerPicker] = useState(false);

  useEffect(() => {
    if (config) {
      setIsEnabled(config.isEnabled);
      setTriggerDays(config.triggerDays);
      setEmail(config.email);
    }
  }, [config]);

  const handleToggle = (value: boolean) => {
    setIsEnabled(value);
    onUpdate({ isEnabled: value });
  };

  const handleTriggerChange = (value: number) => {
    setTriggerDays(value);
    setShowTriggerPicker(false);
    onUpdate({ triggerDays: value });
  };

  const handleEmailBlur = () => {
    if (email !== config?.email) {
      onUpdate({ email });
    }
  };

  const selectedTrigger = TRIGGER_OPTIONS.find((o) => o.value === triggerDays);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Ionicons name="skull" size={16} color={colors.accentDark} />
          <Text style={styles.title}>死亡确认设置</Text>
        </View>
        <Switch
          value={isEnabled}
          onValueChange={handleToggle}
          trackColor={{ false: colors.slate200, true: colors.accent }}
          thumbColor={colors.white}
          disabled={isLoading}
        />
      </View>

      <Text style={styles.description}>
        若连续多日未打卡，将发送确认邮件至紧急联系人
      </Text>

      <View style={styles.form}>
        <View style={styles.field}>
          <Text style={styles.label}>触发天数</Text>
          <TouchableOpacity
            style={styles.select}
            onPress={() => setShowTriggerPicker(!showTriggerPicker)}
            disabled={!isEnabled || isLoading}
          >
            <Text style={[styles.selectText, !isEnabled && styles.disabledText]}>
              {selectedTrigger?.label}
            </Text>
            <Ionicons
              name={showTriggerPicker ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
          {showTriggerPicker && (
            <View style={styles.pickerDropdown}>
              {TRIGGER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.pickerOption,
                    option.value === triggerDays && styles.pickerOptionActive,
                  ]}
                  onPress={() => handleTriggerChange(option.value)}
                >
                  <Text
                    style={[
                      styles.pickerOptionText,
                      option.value === triggerDays && styles.pickerOptionTextActive,
                    ]}
                  >
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>紧急联系人邮箱</Text>
          <TextInput
            style={[styles.input, !isEnabled && styles.inputDisabled]}
            value={email}
            onChangeText={setEmail}
            onBlur={handleEmailBlur}
            placeholder="emergency@example.com"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            editable={isEnabled && !isLoading}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.accentLight,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 12,
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.accentDark,
    marginLeft: 6,
  },
  description: {
    fontSize: 12,
    color: '#be123c',
    marginBottom: 16,
  },
  form: {
    gap: 12,
  },
  field: {},
  label: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.accentDark,
    marginBottom: 4,
  },
  select: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    padding: 10,
  },
  selectText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  disabledText: {
    color: colors.textMuted,
  },
  pickerDropdown: {
    marginTop: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    overflow: 'hidden',
  },
  pickerOption: {
    padding: 10,
  },
  pickerOptionActive: {
    backgroundColor: colors.primaryLight,
  },
  pickerOptionText: {
    fontSize: 14,
    color: colors.textPrimary,
  },
  pickerOptionTextActive: {
    color: colors.primaryDark,
    fontWeight: '500',
  },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    color: colors.textPrimary,
  },
  inputDisabled: {
    backgroundColor: colors.slate100,
    color: colors.textMuted,
  },
});
