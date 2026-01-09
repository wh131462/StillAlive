import { View, Text, StyleSheet } from 'react-native';

export default function PeopleScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>人物记</Text>
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>👥 人物列表开发中...</Text>
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
