const { withNativeWind } = require('nativewind/metro');
const {
  getSentryExpoConfig
} = require("@sentry/react-native/metro");
 
const config = getSentryExpoConfig(__dirname)

// Prevent Metro from resolving the Node.js build of @op-engineering/op-sqlite,
// which requires 'better-sqlite3' (a Node-only native module not available in RN).
config.resolver = config.resolver ?? {};
config.resolver.blockList = [
  ...(Array.isArray(config.resolver.blockList) ? config.resolver.blockList : []),
  /node_modules\/@op-engineering\/op-sqlite\/node\/.*/,
];
 
module.exports = withNativeWind(config, { input: './global.css' })