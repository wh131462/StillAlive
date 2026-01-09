import { View, Text } from '@tarojs/components';
import './index.scss';

export default function Profile() {
  return (
    <View className="profile">
      <Text className="title">我的</Text>
      <View className="placeholder">
        <Text>⚙️ 设置页面开发中...</Text>
      </View>
    </View>
  );
}
