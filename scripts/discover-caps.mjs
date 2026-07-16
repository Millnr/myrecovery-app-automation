#!/usr/bin/env node
/**
 * Convenience: re-discover the app package + launch activity from the connected
 * device, so the values in config/capabilities.ts can be re-verified on any
 * machine without remembering the raw adb incantations.
 *
 * Usage: npm run caps:discover
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk');
const adbPath = existsSync(join(root, 'platform-tools', 'adb')) ? join(root, 'platform-tools', 'adb') : 'adb';
const adb = (args) => execFileSync(adbPath, args, { encoding: 'utf-8' }).trim();

const MATCH = /recovery|hopco|myrec/i;

const packages = adb(['shell', 'pm', 'list', 'packages'])
  .split('\n')
  .map((l) => l.replace('package:', '').trim())
  .filter((p) => MATCH.test(p));

if (packages.length === 0) {
  console.error('No myrecovery-like package found on the device.');
  process.exit(1);
}

for (const pkg of packages) {
  let activity = '(could not resolve)';
  try {
    activity = adb(['shell', 'cmd', 'package', 'resolve-activity', '--brief', pkg]).split('\n').pop().trim();
  } catch {
    /* ignore */
  }
  let version = '';
  try {
    const dump = adb(['shell', 'dumpsys', 'package', pkg]);
    version = (dump.match(/versionName=([^\s]+)/) || [])[1] || '';
  } catch {
    /* ignore */
  }
  console.log(`appPackage : ${pkg}`);
  console.log(`appActivity: ${activity.includes('/') ? activity.split('/')[1] : activity}`);
  console.log(`version    : ${version}`);
  console.log('');
}
