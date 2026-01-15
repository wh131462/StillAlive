const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Watch all files in the monorepo
config.watchFolders = [monorepoRoot];

// Let Metro know where to resolve packages
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

// Force single version of React to prevent duplicate React errors
const reactPath = path.resolve(monorepoRoot, 'node_modules/.pnpm/react@18.3.1/node_modules/react');
config.resolver.extraNodeModules = {
  react: reactPath,
  'react/jsx-runtime': path.join(reactPath, 'jsx-runtime'),
  'react/jsx-dev-runtime': path.join(reactPath, 'jsx-dev-runtime'),
};

// Ensure pnpm symlinks are followed
config.resolver.unstable_enableSymlinks = true;

module.exports = config;
