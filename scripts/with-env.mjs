#!/usr/bin/env node
/**
 * Run a command with project-local toolchain env vars set for the child only.
 *
 * - JAVA_HOME / PATH: from .jdk/jdk-17... when present (macOS Contents/Home or Linux root)
 * - ANDROID_HOME / ANDROID_SDK_ROOT: from env if already set, else ~/Library/Android/sdk
 *   (macOS default) or ~/Android/Sdk (Linux default)
 *
 * So `npm test` / `npm run report` work in this folder without shell profile exports.
 *
 * Usage: node ./scripts/with-env.mjs <command> [args...]
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const jdkRoot = join(root, '.jdk');
const pathSep = process.platform === 'win32' ? ';' : ':';

function resolveLocalJdkHome() {
  if (!existsSync(jdkRoot)) return null;
  const candidates = readdirSync(jdkRoot)
    .filter((name) => /^jdk-17/i.test(name))
    .map((name) => join(jdkRoot, name))
    .flatMap((dir) => [join(dir, 'Contents', 'Home'), dir])
    .filter((home) => existsSync(join(home, 'bin', 'java')));

  return candidates[0] ?? null;
}

function resolveAndroidSdk() {
  if (process.env.ANDROID_HOME && existsSync(process.env.ANDROID_HOME)) {
    return process.env.ANDROID_HOME;
  }
  if (process.env.ANDROID_SDK_ROOT && existsSync(process.env.ANDROID_SDK_ROOT)) {
    return process.env.ANDROID_SDK_ROOT;
  }
  const defaults = [
    join(homedir(), 'Library', 'Android', 'sdk'),
    join(homedir(), 'Android', 'Sdk'),
  ];
  return defaults.find((dir) => existsSync(dir)) ?? null;
}

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node ./scripts/with-env.mjs <command> [args...]');
  process.exit(1);
}

const env = { ...process.env };

const localJdk = resolveLocalJdkHome();
if (localJdk) {
  env.JAVA_HOME = localJdk;
  env.PATH = `${join(localJdk, 'bin')}${pathSep}${env.PATH ?? ''}`;
}

const androidSdk = resolveAndroidSdk();
if (androidSdk) {
  env.ANDROID_HOME = androidSdk;
  env.ANDROID_SDK_ROOT = androidSdk;
  const platformTools = join(androidSdk, 'platform-tools');
  if (existsSync(platformTools)) {
    env.PATH = `${platformTools}${pathSep}${env.PATH ?? ''}`;
  }
}

const [command, ...commandArgs] = args;
const result = spawnSync(command, commandArgs, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

if (result.error) {
  console.error(result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
