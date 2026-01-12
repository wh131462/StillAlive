import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Person, CreatePersonRequest } from '@still-alive/types';
import { colors } from '../../theme/colors';
import { Button, Input, Avatar } from '../ui';

const MBTI_OPTIONS = [
  'INTJ', 'INTP', 'ENTJ', 'ENTP',
  'INFJ', 'INFP', 'ENFJ', 'ENFP',
  'ISTJ', 'ISFJ', 'ESTJ', 'ESFJ',
  'ISTP', 'ISFP', 'ESTP', 'ESFP',
];

interface PersonFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  person?: Person | null;
  onClose: () => void;
  onSubmit: (data: CreatePersonRequest) => void;
  isLoading?: boolean;
}

export default function PersonFormModal({
  visible,
  mode,
  person,
  onClose,
  onSubmit,
  isLoading,
}: PersonFormModalProps) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other' | ''>('');
  const [birthday, setBirthday] = useState('');
  const [mbti, setMbti] = useState('');
  const [impression, setImpression] = useState('');
  const [experience, setExperience] = useState('');
  const [nameError, setNameError] = useState('');

  useEffect(() => {
    if (person && mode === 'edit') {
      setName(person.name);
      setGender(person.gender || '');
      setBirthday(person.birthday || '');
      setMbti(person.mbti || '');
      setImpression(person.impression || '');
      setExperience(person.experience || '');
    } else {
      // Reset form
      setName('');
      setGender('');
      setBirthday('');
      setMbti('');
      setImpression('');
      setExperience('');
    }
    setNameError('');
  }, [person, mode, visible]);

  const handleSubmit = () => {
    if (!name.trim()) {
      setNameError('请输入姓名');
      return;
    }

    onSubmit({
      name: name.trim(),
      gender: gender || undefined,
      birthday: birthday || undefined,
      mbti: mbti || undefined,
      impression: impression || undefined,
      experience: experience || undefined,
    });
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
            <Text style={styles.title}>
              {mode === 'create' ? '添加人物' : '编辑人物'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Avatar Upload */}
            <View style={styles.avatarSection}>
              <TouchableOpacity style={styles.avatarUpload}>
                <Ionicons name="camera" size={24} color={colors.textMuted} />
              </TouchableOpacity>
              <Text style={styles.avatarHint}>点击上传照片</Text>
            </View>

            {/* Form */}
            <Input
              label="姓名/称呼"
              placeholder="输入姓名或称呼"
              value={name}
              onChangeText={setName}
              error={nameError}
            />

            <View style={styles.row}>
              <View style={styles.halfInput}>
                <Text style={styles.label}>性别</Text>
                <View style={styles.genderOptions}>
                  {(['male', 'female', 'other'] as const).map((g) => (
                    <TouchableOpacity
                      key={g}
                      style={[styles.genderOption, gender === g && styles.genderOptionActive]}
                      onPress={() => setGender(g)}
                    >
                      <Text style={[styles.genderOptionText, gender === g && styles.genderOptionTextActive]}>
                        {g === 'male' ? '男' : g === 'female' ? '女' : '其他'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
              <View style={styles.halfInput}>
                <Input
                  label="生日"
                  placeholder="MM-DD"
                  value={birthday}
                  onChangeText={setBirthday}
                  containerStyle={{ marginBottom: 0 }}
                />
              </View>
            </View>

            <Text style={styles.label}>MBTI</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mbtiScroll}>
              <View style={styles.mbtiOptions}>
                {MBTI_OPTIONS.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.mbtiOption, mbti === m && styles.mbtiOptionActive]}
                    onPress={() => setMbti(mbti === m ? '' : m)}
                  >
                    <Text style={[styles.mbtiOptionText, mbti === m && styles.mbtiOptionTextActive]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Input
              label="个人印象"
              placeholder="描述一下这个人给你的印象..."
              value={impression}
              onChangeText={setImpression}
              multiline
              numberOfLines={3}
            />

            <Input
              label="共同经历"
              placeholder="记录你们的重要共同经历..."
              value={experience}
              onChangeText={setExperience}
              multiline
              numberOfLines={3}
            />

            <Button
              title="保存"
              onPress={handleSubmit}
              loading={isLoading}
              fullWidth
              size="lg"
              style={styles.submitButton}
            />
          </ScrollView>
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
    maxHeight: '90%',
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
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatarUpload: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.slate100,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.slate300,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarHint: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textPrimary,
    marginBottom: 6,
  },
  genderOptions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 8,
    backgroundColor: colors.slate100,
    borderRadius: 8,
    alignItems: 'center',
  },
  genderOptionActive: {
    backgroundColor: colors.primary,
  },
  genderOptionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  genderOptionTextActive: {
    color: colors.white,
    fontWeight: '500',
  },
  mbtiScroll: {
    marginBottom: 16,
  },
  mbtiOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mbtiOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.slate100,
    borderRadius: 6,
  },
  mbtiOptionActive: {
    backgroundColor: colors.primary,
  },
  mbtiOptionText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  mbtiOptionTextActive: {
    color: colors.white,
  },
  submitButton: {
    marginTop: 8,
  },
});
