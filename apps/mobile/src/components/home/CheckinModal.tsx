import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import Button from '../ui/Button';

interface CheckinModalProps {
  visible: boolean;
  step: 'input' | 'success';
  onClose: () => void;
  onCheckin: (content?: string) => void;
  isLoading?: boolean;
}

export default function CheckinModal({
  visible,
  step,
  onClose,
  onCheckin,
  isLoading,
}: CheckinModalProps) {
  const [content, setContent] = useState('');

  const handleCheckinWithContent = () => {
    onCheckin(content || undefined);
    setContent('');
  };

  const handleCheckinSimple = () => {
    onCheckin();
    setContent('');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.modalContainer}>
        <View style={styles.modal}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>确认今日存活</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {step === 'input' ? (
            /* Step 1: Input */
            <View>
              <Text style={styles.subtitle}>
                记录一下今天有意义的事（可选）
              </Text>

              <TextInput
                style={styles.textArea}
                placeholder="今天发生了什么值得记住的事..."
                placeholderTextColor={colors.textMuted}
                multiline
                value={content}
                onChangeText={setContent}
                editable={!isLoading}
              />

              <View style={styles.mediaButtons}>
                <TouchableOpacity style={styles.mediaButton}>
                  <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.mediaButtonText}>添加照片</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.mediaButton}>
                  <Ionicons name="happy-outline" size={18} color={colors.textSecondary} />
                  <Text style={styles.mediaButtonText}>心情</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.buttonRow}>
                <Button
                  title="确认打卡"
                  onPress={handleCheckinWithContent}
                  loading={isLoading}
                  style={styles.primaryButton}
                />
                <Button
                  title="纯打卡"
                  onPress={handleCheckinSimple}
                  variant="secondary"
                  loading={isLoading}
                  style={styles.secondaryButton}
                />
              </View>
            </View>
          ) : (
            /* Step 2: Success */
            <View style={styles.successContainer}>
              <View style={styles.successIcon}>
                <Ionicons name="checkmark" size={48} color={colors.primary} />
              </View>
              <Text style={styles.successTitle}>恭喜你又活过了一天！</Text>
              <Text style={styles.successSubtitle}>今天也辛苦了</Text>
              <Button
                title="完成"
                onPress={onClose}
                style={styles.doneButton}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  textArea: {
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 12,
    minHeight: 100,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  mediaButtons: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  mediaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.slate100,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 12,
  },
  mediaButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 6,
  },
  buttonRow: {
    flexDirection: 'row',
  },
  primaryButton: {
    flex: 1,
    marginRight: 12,
  },
  secondaryButton: {
    paddingHorizontal: 24,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    backgroundColor: colors.primaryLight,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: 8,
  },
  successSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 24,
  },
  doneButton: {
    minWidth: 120,
  },
});
