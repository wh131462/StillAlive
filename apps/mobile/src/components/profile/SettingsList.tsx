import React from 'react';
import { View, StyleSheet } from 'react-native';
import { colors } from '../../theme/colors';
import SettingsItem from './SettingsItem';

interface SettingsListProps {
  reminderTime?: string;
  onReminderPress?: () => void;
  onNotificationPress?: () => void;
  onPrivacyPress?: () => void;
  onBackupPress?: () => void;
  onAboutPress?: () => void;
  onHelpPress?: () => void;
  onLogoutPress?: () => void;
}

export default function SettingsList({
  reminderTime = '21:00',
  onReminderPress,
  onNotificationPress,
  onPrivacyPress,
  onBackupPress,
  onAboutPress,
  onHelpPress,
  onLogoutPress,
}: SettingsListProps) {
  return (
    <View>
      {/* Settings Section */}
      <View style={styles.section}>
        <SettingsItem
          icon="notifications"
          iconColor={colors.primary}
          iconBgColor={colors.primaryLight}
          label="打卡提醒"
          value={`每天 ${reminderTime}`}
          onPress={onReminderPress}
        />
        <View style={styles.divider} />
        <SettingsItem
          icon="mail"
          iconColor="#3b82f6"
          iconBgColor="#dbeafe"
          label="消息通知"
          onPress={onNotificationPress}
        />
        <View style={styles.divider} />
        <SettingsItem
          icon="shield-half"
          iconColor="#8b5cf6"
          iconBgColor="#ede9fe"
          label="隐私设置"
          onPress={onPrivacyPress}
        />
        <View style={styles.divider} />
        <SettingsItem
          icon="cloud-upload"
          iconColor={colors.amber500}
          iconBgColor={colors.amber50}
          label="数据备份"
          onPress={onBackupPress}
        />
      </View>

      {/* About Section */}
      <View style={[styles.section, styles.sectionMargin]}>
        <SettingsItem
          icon="information-circle"
          iconColor={colors.textSecondary}
          iconBgColor={colors.slate100}
          label="关于我们"
          onPress={onAboutPress}
        />
        <View style={styles.divider} />
        <SettingsItem
          icon="help-circle"
          iconColor={colors.textSecondary}
          iconBgColor={colors.slate100}
          label="帮助与反馈"
          onPress={onHelpPress}
        />
        <View style={styles.divider} />
        <SettingsItem
          icon="log-out"
          iconColor={colors.error}
          iconBgColor={colors.errorLight}
          label="退出登录"
          textColor={colors.error}
          showArrow={false}
          onPress={onLogoutPress}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionMargin: {
    marginTop: 16,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
    marginLeft: 60,
  },
});
