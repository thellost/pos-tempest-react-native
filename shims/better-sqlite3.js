// Shim for better-sqlite3 — this package is a Node-only native module used by
// @op-engineering/op-sqlite's node build. It must never be bundled in React
// Native or Expo SSR contexts. Exporting an empty object prevents Metro from
// failing when it walks through the node/ build of op-sqlite during static
// rendering (expo-router/node/render.js).
module.exports = {};
