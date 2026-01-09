import { View, Text } from '@tarojs/components';
import './index.scss';

export default function People() {
  return (
    <View className="people">
      <Text className="title">人物记</Text>
      <View className="placeholder">
        <Text>👥 人物列表开发中...</Text>
      </View>
    </View>
  );
}
