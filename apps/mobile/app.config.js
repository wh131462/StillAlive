const { expo } = require('./app.json');
const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

module.exports = () => {
  const development = process.env.STILL_ALIVE_APP_VARIANT === 'development';
  const updateChannel = process.env.STILL_ALIVE_UPDATE_CHANNEL || 'play';

  const config = {
    ...expo,
    name: development ? `${expo.name} Dev` : expo.name,
    scheme: development ? 'stillalive-dev' : expo.scheme,
    ios: {
      ...expo.ios,
      bundleIdentifier: development ? 'com.eternalheart.stillalive.dev' : expo.ios.bundleIdentifier,
    },
    android: {
      ...expo.android,
      package: development ? 'com.eternalheart.stillalive.dev' : expo.android.package,
      permissions: updateChannel === 'github'
        ? expo.android.permissions
        : expo.android.permissions.filter((permission) => ![
          'android.permission.REQUEST_INSTALL_PACKAGES',
          'android.permission.SYSTEM_ALERT_WINDOW',
        ].includes(permission)),
    },
    extra: {
      ...expo.extra,
      updateChannel,
    },
  };

  return withAndroidManifest(config, (mod) => {
    const permissions = mod.modResults.manifest['uses-permission'] || [];
    if (updateChannel === 'github') {
      if (!permissions.some((item) => item.$?.['android:name'] === 'android.permission.REQUEST_INSTALL_PACKAGES')) {
        permissions.push({ $: { 'android:name': 'android.permission.REQUEST_INSTALL_PACKAGES' } });
      }
    } else {
      AndroidConfig.Permissions.removePermissions(mod.modResults, [
        'android.permission.REQUEST_INSTALL_PACKAGES',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]);
    }
    if (updateChannel === 'github') mod.modResults.manifest['uses-permission'] = permissions;
    return mod;
  });
};
