
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude the backend directory from Metro.
config.resolver.blockList = [
  /backend\/.*/,
  /backend\/node_modules\/.*/
];

module.exports = config;
