import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useState } from 'react';

export default function HomeScreen() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const handleCheckIn = () => {
    setIsCheckedIn(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.statusCard}>
        <View style={styles.heartContainer}>
          <Text style={styles.heartIcon}>💓</Text>
        </View>
        <Text style={styles.statusText}>
          {isCheckedIn ? '生存状态：已确认' : '生存状态：确认中...'}
        </Text>
        <TouchableOpacity
          style={[styles.checkInButton, isCheckedIn && styles.checkedButton]}
          onPress={handleCheckIn}
          disabled={isCheckedIn}
        >
          <Text style={styles.buttonText}>
            {isCheckedIn ? '已确认存活 ✓' : '确认存活打卡'}
          </Text>
        </TouchableOpacity>
        <Text style={styles.quote}>"原来你还活着啊"</Text>
      </View>

      {isCheckedIn && (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>🎉 恭喜你又活过了一天！</Text>
          <Text style={styles.feedbackSubtitle}>今天也辛苦了</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
    padding: 16,
    paddingTop: 60,
  },
  statusCard: {
    backgroundColor: 'white',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  heartContainer: {
    width: 80,
    height: 80,
    backgroundColor: '#fef2f2',
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  heartIcon: {
    fontSize: 36,
  },
  statusText: {
    color: '#64748b',
    fontSize: 14,
    marginBottom: 16,
  },
  checkInButton: {
    width: '100%',
    backgroundColor: '#0f172a',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  checkedButton: {
    backgroundColor: '#10b981',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  quote: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 12,
    fontStyle: 'italic',
  },
  feedbackCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginTop: 16,
  },
  feedbackTitle: {
    color: '#047857',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  feedbackSubtitle: {
    color: '#059669',
    fontSize: 14,
  },
});
