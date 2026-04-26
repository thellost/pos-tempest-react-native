#!/usr/bin/env node
/**
 * eas-update-all.js
 *
 * Pushes an OTA update to multiple runtime versions in one command.
 * Useful when using runtimeVersion.policy = "appVersion" and devices
 * are spread across multiple app versions.
 *
 * Usage:
 *   node scripts/eas-update-all.js --message "Fix modal scroll" --channel production
 *   node scripts/eas-update-all.js --message "Fix modal scroll"   # defaults to production
 *
 * Runtime versions to target are listed in RUNTIME_VERSIONS below.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Config ──────────────────────────────────────────────────────────────────

/** All runtime versions (app versions) that have live installs. */
const RUNTIME_VERSIONS = ['1.0.7', '1.0.8'];

// ─── Args ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const messageIdx = args.indexOf('--message');
const channelIdx = args.indexOf('--channel');

if (messageIdx === -1 || !args[messageIdx + 1]) {
  console.error('Usage: node scripts/eas-update-all.js --message "your message" [--channel production]');
  process.exit(1);
}

const message = args[messageIdx + 1];
const channel = channelIdx !== -1 && args[channelIdx + 1] ? args[channelIdx + 1] : 'production';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const appJsonPath = path.join(__dirname, '..', 'app.json');

function readAppJson() {
  return JSON.parse(fs.readFileSync(appJsonPath, 'utf8'));
}

function writeAppJson(data) {
  fs.writeFileSync(appJsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function run(cmd) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
}

// ─── Main ────────────────────────────────────────────────────────────────────

const originalAppJson = readAppJson();
const originalVersion = originalAppJson.expo.version;

console.log(`\n🚀 eas-update-all`);
console.log(`   Channel  : ${channel}`);
console.log(`   Message  : ${message}`);
console.log(`   Runtimes : ${RUNTIME_VERSIONS.join(', ')}`);
console.log(`   Original version in app.json: ${originalVersion}\n`);

let failed = false;

for (const version of RUNTIME_VERSIONS) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`📦 Updating runtime: ${version}`);
  console.log(`${'─'.repeat(60)}`);

  try {
    // Set version in app.json
    const appJson = readAppJson();
    appJson.expo.version = version;
    writeAppJson(appJson);

    // Commit the version bump (requireCommit: true in eas.json)
    run(`git add app.json`);
    run(`git commit -m "chore: eas update runtime ${version} [skip ci]" --allow-empty`);

    // Push OTA update
    run(`eas update --channel ${channel} --environment production --message "${message}" --non-interactive`);

    console.log(`\n✅ Runtime ${version} updated successfully`);
  } catch (err) {
    console.error(`\n❌ Failed to update runtime ${version}:`, err.message);
    failed = true;
    // Continue to next version even on failure
  }
}

// ─── Restore ─────────────────────────────────────────────────────────────────

console.log(`\n${'─'.repeat(60)}`);
console.log(`🔄 Restoring app.json to version ${originalVersion}`);

const appJson = readAppJson();
appJson.expo.version = originalVersion;
writeAppJson(appJson);

run(`git add app.json`);
run(`git commit -m "chore: restore app version to ${originalVersion} after eas-update-all" --allow-empty`);

console.log(`\n${'═'.repeat(60)}`);
if (failed) {
  console.log(`⚠️  Done with errors. Check output above.`);
} else {
  console.log(`✅ All runtimes updated successfully on channel [${channel}].`);
}
console.log(`${'═'.repeat(60)}\n`);
