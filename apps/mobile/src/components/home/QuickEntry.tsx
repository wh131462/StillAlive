import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';

interface QuickEntryProps {
  onSave: (content: string) => void;
  isLoading?: boolean;
}

export default function QuickEntry({ onSave, isLoading }: QuickEntryProps) {
  const [content, setContent] = useState('');

  const handleSave = () => {
    if (!content.trim()) return;
    onSave(content);
    setContent('');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="create" size={20} color={colors.primary} />
        <Text style={styles.headerText}>今日有意义的事</Text>
      </View>

      <View style={styles.card}>
        <TextInput
          style={styles.input}
          placeholder="记录下今天的一些有意义的事件..."
          placeholderTextColor={colors.textMuted}
          multiline
          value={content}
          onChangeText={setContent}
          editable={!isLoading}
        />
        <View style={styles.footer}>
          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="image-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton}>
              <Ionicons name="happy-outline" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity
            style={[styles.saveButton, !content.trim() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!content.trim() || isLoading}
          >
            <Text style={styles.saveButtonText}>保存记忆</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerText: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.textPrimary,
    marginLeft: 8,
  },
  card: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
  },
  input: {
    minHeight: 80,
    fontSize: 14,
    color: colors.textPrimary,
    textAlignVertical: 'top',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 12,
    marginTop: 8,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    marginRight: 16,
  },
  saveButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '500',
  },
});
