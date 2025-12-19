#!/usr/bin/env node
const { spawnSync } = require('child_process');
const path = require('path');

const args = process.argv.slice(2);
const hasArg = (needle) => {
  const variations = [needle, needle.replace(/^--/, '-'), needle.replace(/^--/, '')];
  return args.some((arg) => variations.includes(arg));
};

const buildingMac =
  process.platform === 'darwin' ||
  hasArg('--mac') ||
  hasArg('--macos') ||
  args.includes('-m') ||
  args.includes('mac');
const buildingWindows =
  process.platform === 'win32' ||
  hasArg('--win') ||
  hasArg('--windows') ||
  args.includes('-w') ||
  args.includes('win');

const missing = [];

if (buildingMac) {
  if (!process.env.APPLEID) missing.push('APPLEID');
  if (!process.env.APPLE_TEAM_ID) missing.push('APPLE_TEAM_ID');
  if (!process.env.APPLEIDPASS && !process.env.AC_PASSWORD) missing.push('APPLEIDPASS or AC_PASSWORD');
  if (!process.env.APPLEIDPASS && process.env.AC_PASSWORD) {
    process.env.APPLEIDPASS = process.env.AC_PASSWORD;
  }
}

if (buildingWindows) {
  if (!process.env.CSC_LINK) missing.push('CSC_LINK');
  if (!process.env.CSC_KEY_PASSWORD) missing.push('CSC_KEY_PASSWORD');
}

if (missing.length) {
  console.error(`\nMissing required signing environment variables: ${missing.join(', ')}`);
  console.error('Set them before running the build to avoid unsigned artifacts.');
  process.exit(1);
}

const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const builderBin = path.resolve(__dirname, '..', 'node_modules', '.bin', binName);

const result = spawnSync(builderBin, args, { stdio: 'inherit' });
if (result.error) {
  console.error(result.error.message);
  process.exit(result.status ?? 1);
}
process.exit(result.status ?? 0);
