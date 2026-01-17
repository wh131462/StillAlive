import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  TextInput,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { MoodType } from '@still-alive/types';
import { colors } from '../../theme/colors';
import Button from '../ui/Button';
import MoodSelector from './MoodSelector';

interface CheckinData {
  content?: string;
  mood?: MoodType;
}

interface CheckinModalProps {
  visible: boolean;
  onClose: () => void;
  onCheckin: (data: CheckinData) => void;
  isLoading?: boolean;
}

export default function CheckinModal({
  visible,
  onClose,
  onCheckin,
  isLoading,
}: CheckinModalProps) {
  const [content, setContent] = useState('');
  const [mood, setMood] = useState<MoodType | undefined>(undefined);

  const handleCheckinWithContent = () => {
    onCheckin({ content: content || undefined, mood });
    resetForm();
  };

  const handleCheckinSimple = () => {
    onCheckin({ mood });
    resetForm();
  };

  const resetForm = () => {
    setContent('');
    setMood(undefined);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay} />
      </TouchableWithoutFeedback>

      <View style={styles.modalContainer}>
        <View style={styles.modal}>
          {/* Handle bar */}
          <View style={styles.handleBar} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>确认今日存活</Text>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Mood Selector */}
            <MoodSelector value={mood} onChange={setMood} disabled={isLoading} />

            {/* Content Input */}
            <Text style={styles.subtitle}>记录一下今天有意义的事（可选）</Text>
            <TextInput
              style={styles.textArea}
              placeholder="今天发生了什么值得记住的事..."
              placeholderTextColor={colors.textMuted}
              multiline
              value={content}
              onChangeText={setContent}
              editable={!isLoading}
            />

            {/* Media Buttons */}
            <View style={styles.mediaButtons}>
              <TouchableOpacity style={styles.mediaButton}>
                <Ionicons name="image-outline" size={18} color={colors.textSecondary} />
                <Text style={styles.mediaButtonText}>添加照片</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          {/* Action Buttons */}
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
    maxHeight: '80%',
  },
  modal: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: colors.slate300,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
    minHeight: 80,
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
});
