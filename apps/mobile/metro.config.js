const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const avifShim = path.resolve(__dirname, 'src/shims/jsquash-avif.ts');

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === '@jsquash/avif') return { filePath: avifShim, type: 'sourceFile' };
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
