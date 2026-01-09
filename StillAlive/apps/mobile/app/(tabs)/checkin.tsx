import { View, Text, StyleSheet } from 'react-native';

export default function CheckinScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>打卡记录</Text>
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>365</Text>
          <Text style={styles.statLabel}>总打卡天数</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#6366f1' }]}>28</Text>
          <Text style={styles.statLabel}>连续打卡</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={[styles.statNumber, { color: '#f59e0b' }]}>42</Text>
          <Text style={styles.statLabel}>记录条数</Text>
        </View>
      </View>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>📅 日历视图开发中...</Text>
      </View>
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
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#10b981',
  },
  statLabel: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  placeholder: {
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: '#94a3b8',
    fontSize: 16,
  },
});
