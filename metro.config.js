const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Exclude the backend directory and its node_modules from Metro's watch list and resolver
config.resolver.blacklistRE = [
  /backend\/.*/,
  /backend\/node_modules\/.*/
];

config.resolver.blockList = [
  /backend\/.*/,
  /backend\/node_modules\/.*/
];

module.exports = config;
