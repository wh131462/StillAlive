import { PropsWithChildren } from 'react';
import { useLaunch } from '@tarojs/taro';
import './app.scss';

function App({ children }: PropsWithChildren) {
  useLaunch(() => {
    console.log('StillAlive 小程序启动');
  });

  return children;
}

export default App;
