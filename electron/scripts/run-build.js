#!/usr/bin/env node
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const args = process.argv.slice(2);
const hasArg = (needle) => {
  const variations = [needle, needle.replace(/^--/, '-'), needle.replace(/^--/, '')];
  return args.some((arg) => variations.includes(arg));
};

const hasShorthandFlag = (flag) =>
  args.some((arg) => arg.startsWith('-') && !arg.startsWith('--') && arg.includes(flag));

const buildingMac =
  process.platform === 'darwin' ||
  hasArg('--mac') ||
  hasArg('--macos') ||
  args.includes('-m') ||
  hasShorthandFlag('m') ||
  args.includes('mac');
const buildingWindows =
  process.platform === 'win32' ||
  hasArg('--win') ||
  hasArg('--windows') ||
  args.includes('-w') ||
  hasShorthandFlag('w') ||
  args.includes('win');

const pkg = require('../package.json');
const baseConfig = pkg.build || {};
const config = JSON.parse(JSON.stringify(baseConfig));

const missingMac = [];
const missingWin = [];

if (buildingMac) {
  if (!process.env.APPLEID) missingMac.push('APPLEID');
  if (!process.env.APPLE_TEAM_ID) missingMac.push('APPLE_TEAM_ID');
  if (!process.env.APPLEIDPASS && !process.env.AC_PASSWORD) missingMac.push('APPLEIDPASS or AC_PASSWORD');
  if (!process.env.APPLEIDPASS && process.env.AC_PASSWORD) {
    process.env.APPLEIDPASS = process.env.AC_PASSWORD;
  }

  if (missingMac.length) {
    console.warn(`\nMac signing variables missing (${missingMac.join(', ')}). Building unsigned macOS artifacts.`);
    if (!config.mac) config.mac = {};
    config.mac.identity = null;
    delete config.mac.notarize;
  }
}

if (buildingWindows) {
  if (!process.env.CSC_LINK) missingWin.push('CSC_LINK');
  if (!process.env.CSC_KEY_PASSWORD) missingWin.push('CSC_KEY_PASSWORD');

  if (missingWin.length) {
    console.warn(`\nWindows signing variables missing (${missingWin.join(', ')}). Building unsigned Windows artifacts.`);
    if (config.win) {
      delete config.win.certificateFile;
      delete config.win.certificatePassword;
      delete config.win.certificateSubjectName;
    }
  }
}

let configPath;
let buildArgs = args;
const runOrExit = (command, commandArgs, options) => {
  const result = spawnSync(command, commandArgs, { stdio: 'inherit', ...options });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
};

const binName = process.platform === 'win32' ? 'electron-builder.cmd' : 'electron-builder';
const builderBin = path.resolve(__dirname, '..', 'node_modules', '.bin', binName);
const hasConfigArg = args.some((arg) => arg === '--config' || arg.startsWith('--config='));

if (!fs.existsSync(builderBin)) {
  console.log('\nElectron build dependencies missing. Installing...');
  runOrExit('npm', ['install'], { cwd: path.resolve(__dirname, '..') });
}

const repoRoot = path.resolve(__dirname, '..', '..');
const nextStandaloneDir = path.join(repoRoot, '.next', 'standalone');
const nextStaticDir = path.join(repoRoot, '.next', 'static');

console.log('\nRunning Next.js production build for Electron packaging...');
runOrExit('npm', ['run', 'build'], { cwd: repoRoot, env: { ...process.env, NODE_ENV: 'production' } });

if (!fs.existsSync(nextStandaloneDir) || !fs.existsSync(nextStaticDir)) {
  console.error('Next.js build output missing (.next/standalone or .next/static) after build.');
  process.exit(1);
}

if (!hasConfigArg) {
  configPath = path.join(os.tmpdir(), `electron-builder-config-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  buildArgs = [...args, '--config', configPath];
}

const result = spawnSync(builderBin, buildArgs, { stdio: 'inherit' });
if (configPath && fs.existsSync(configPath)) {
  fs.rmSync(configPath, { force: true });
}
if (result.error) {
  console.error(result.error.message);
  process.exit(result.status ?? 1);
}
process.exit(result.status ?? 0);
