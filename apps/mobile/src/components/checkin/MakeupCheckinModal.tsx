import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import dayjs from 'dayjs';
import type { MoodType } from '@still-alive/local-storage';
import { colors } from '../../theme/colors';
import MoodSelector from '../home/MoodSelector';

interface MakeupCheckinModalProps {
  visible: boolean;
  date: string | null; // YYYY-MM-DD
  remainingCount: number;
  maxCount: number;
  onClose: () => void;
  onSubmit: (data: { date: string; content?: string; mood?: MoodType }) => void;
  isLoading?: boolean;
}

export default function MakeupCheckinModal({
  visible,
  date,
  remainingCount,
  maxCount,
  onClose,
  onSubmit,
  isLoading,
}: MakeupCheckinModalProps) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType | undefined>();

  useEffect(() => {
    if (visible) {
      setContent('');
      setMood(undefined);
    }
  }, [visible]);

  const formattedDate = date ? dayjs(date).format('M月D日') : '';
  const dayOfWeek = date ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][dayjs(date).day()] : '';

  // 检查是否在7天内
  const isWithin7Days = date ? dayjs().diff(dayjs(date), 'day') <= 7 : false;
  const canMakeup = isWithin7Days && remainingCount > 0;

  const handleSubmit = () => {
    if (!date || !canMakeup) return;
    onSubmit({ date, content: content.trim() || undefined, mood });
  };

  if (!date) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
              <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                  <Text style={styles.title}>补签打卡</Text>
                  <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                    <Ionicons name="close" size={24} color={colors.textMuted} />
                  </TouchableOpacity>
                </View>

                <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                  {/* Date Info */}
                  <View style={styles.dateCard}>
                    <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                    <View style={styles.dateInfo}>
                      <Text style={styles.dateText}>{formattedDate}</Text>
                      <Text style={styles.dayText}>{dayOfWeek}</Text>
                    </View>
                  </View>

                  {/* Status Warning */}
                  {!canMakeup && (
                    <View style={styles.warningCard}>
                      <Ionicons name="warning-outline" size={20} color={colors.warning} />
                      <Text style={styles.warningText}>
                        {!isWithin7Days
                          ? '只能补签7天内的打卡记录'
                          : `本月补签次数已用完 (${maxCount}次)`}
                      </Text>
                    </View>
                  )}

                  {/* Remaining Count */}
                  <View style={styles.countCard}>
                    <Text style={styles.countLabel}>本月剩余补签次数</Text>
                    <Text style={styles.countValue}>
                      <Text style={styles.countHighlight}>{remainingCount}</Text>
                      <Text style={styles.countTotal}>/{maxCount}</Text>
                    </Text>
                  </View>

                  {/* Mood Selector */}
                  <MoodSelector value={mood} onChange={setMood} disabled={!canMakeup} />

                  {/* Content Input */}
                  <View style={styles.inputSection}>
                    <Text style={styles.inputLabel}>记录一些有意义的事（选填）</Text>
                    <TextInput
                      style={styles.textInput}
                      placeholder="那天发生了什么值得记住的事..."
                      placeholderTextColor={colors.textMuted}
                      value={content}
                      onChangeText={setContent}
                      multiline
                      numberOfLines={4}
                      textAlignVertical="top"
                      editable={canMakeup}
                    />
                  </View>
                </ScrollView>

                {/* Submit Button */}
                <TouchableOpacity
                  style={[styles.submitButton, !canMakeup && styles.submitButtonDisabled]}
                  onPress={handleSubmit}
                  disabled={!canMakeup || isLoading}
                >
                  {isLoading ? (
                    <ActivityIndicator color={colors.white} />
                  ) : (
                    <Text style={styles.submitText}>确认补签</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.white,
    borderRadius: 20,
    width: '100%',
    maxWidth: 400,
    maxHeight: '90%',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 16,
  },
  dateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  dateInfo: {
    marginLeft: 12,
  },
  dateText: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  dayText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 2,
  },
  warningCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#D97706',
    marginLeft: 8,
  },
  countCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.slate50,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  countLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  countValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  countHighlight: {
    color: colors.primary,
    fontSize: 20,
  },
  countTotal: {
    color: colors.textMuted,
  },
  inputSection: {
    marginTop: 8,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: colors.slate50,
    borderRadius: 12,
    padding: 12,
    height: 100,
    fontSize: 15,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.border,
  },
  submitButton: {
    backgroundColor: colors.primary,
    padding: 16,
    alignItems: 'center',
    margin: 16,
    marginTop: 8,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    backgroundColor: colors.slate300,
  },
  submitText: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
});
