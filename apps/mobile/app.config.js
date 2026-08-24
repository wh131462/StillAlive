const { expo } = require('./app.json');

module.exports = () => {
  const development = process.env.STILL_ALIVE_APP_VARIANT === 'development';

  return {
    ...expo,
    name: development ? `${expo.name} Dev` : expo.name,
    scheme: development ? 'stillalive-dev' : expo.scheme,
    ios: {
      ...expo.ios,
      bundleIdentifier: development ? 'com.eternalheart.stillalive.dev' : expo.ios.bundleIdentifier,
    },
    android: {
      ...expo.android,
      package: expo.android.package,
    },
  };
};
