import { useState } from 'react';
import { View, Text, Button } from '@tarojs/components';
import './index.scss';

export default function Home() {
  const [isCheckedIn, setIsCheckedIn] = useState(false);

  const handleCheckIn = () => {
    setIsCheckedIn(true);
  };

  return (
    <View className="home">
      <View className="status-card">
        <View className="heart-container">
          <Text className="heart-icon">💓</Text>
        </View>
        <Text className="status-text">
          {isCheckedIn ? '生存状态：已确认' : '生存状态：确认中...'}
        </Text>
        <Button
          className={`checkin-btn ${isCheckedIn ? 'checked' : ''}`}
          onClick={handleCheckIn}
          disabled={isCheckedIn}
        >
          {isCheckedIn ? '已确认存活 ✓' : '确认存活打卡'}
        </Button>
        <Text className="quote">"原来你还活着啊"</Text>
      </View>

      {isCheckedIn && (
        <View className="feedback-card">
          <Text className="feedback-title">🎉 恭喜你又活过了一天！</Text>
          <Text className="feedback-subtitle">今天也辛苦了</Text>
        </View>
      )}
    </View>
  );
}
