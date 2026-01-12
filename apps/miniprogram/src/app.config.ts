export default defineAppConfig({
  pages: [
    'pages/home/index',
    'pages/checkin/index',
    'pages/people/index',
    'pages/profile/index',
  ],
  tabBar: {
    color: '#94a3b8',
    selectedColor: '#0f172a',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/home/index',
        text: '主页',
        iconPath: 'assets/icons/home.png',
        selectedIconPath: 'assets/icons/home-active.png',
      },
      {
        pagePath: 'pages/checkin/index',
        text: '打卡',
        iconPath: 'assets/icons/calendar.png',
        selectedIconPath: 'assets/icons/calendar-active.png',
      },
      {
        pagePath: 'pages/people/index',
        text: '人物',
        iconPath: 'assets/icons/people.png',
        selectedIconPath: 'assets/icons/people-active.png',
      },
      {
        pagePath: 'pages/profile/index',
        text: '我的',
        iconPath: 'assets/icons/user.png',
        selectedIconPath: 'assets/icons/user-active.png',
      },
    ],
  },
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#ffffff',
    navigationBarTitleText: '今天又活了一天',
    navigationBarTextStyle: 'black',
  },
});
