const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add polyfills to resolver (This ensures Expo finds the right modules)
config.resolver = {
  ...config.resolver,
  extraNodeModules: {
    "web-streams-polyfill": require.resolve("web-streams-polyfill"),
  },
};

module.exports = config;
