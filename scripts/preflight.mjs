#!/usr/bin/env node
/**
 * Preflight checks — run automatically before `npm test` (see package.json
 * "pretest"). The goal is fail-fast clarity: if the device, Java, or the
 * uiautomator2 driver is missing, we stop here with an actionable message
 * instead of letting Appium hang or emit an opaque session-creation error.
 *
 * Exit code 0 = good to run; non-zero = stop with guidance.
 */
import { execFileSync, execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;

function resolveAdb() {
  const root = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || join(homedir(), 'Library/Android/sdk');
  const candidate = join(root, 'platform-tools', 'adb');
  if (existsSync(candidate)) return candidate;
  return 'adb'; // fall back to PATH
}

let failed = false;

// 1. Device connected & authorized ------------------------------------------
const adb = resolveAdb();
try {
  const out = execFileSync(adb, ['devices', '-l'], { encoding: 'utf-8' });
  const deviceLines = out
    .split('\n')
    .slice(1)
    .filter((l) => l.trim() && !l.startsWith('*'));
  const authorized = deviceLines.filter((l) => /\sdevice(\s|$)/.test(l));
  const unauthorized = deviceLines.filter((l) => /unauthorized|offline/.test(l));

  if (authorized.length === 0) {
    failed = true;
    console.error(RED('✗ No authorized Android device found via adb.'));
    if (unauthorized.length) {
      console.error(YELLOW('  A device is attached but unauthorized/offline:'));
      unauthorized.forEach((l) => console.error(`    ${l.trim()}`));
      console.error(YELLOW('  → Set the phone USB mode to "Transfer files" and accept the "Allow USB debugging" prompt.'));
    } else {
      console.error(YELLOW('  → Plug in the device (USB mode "Transfer files"), enable USB debugging, and re-run.'));
    }
  } else {
    console.log(GREEN(`✓ Device connected: ${authorized[0].trim()}`));
  }
} catch (err) {
  failed = true;
  console.error(RED(`✗ Could not run adb (${adb}): ${err.message}`));
  console.error(YELLOW('  → Ensure Android platform-tools are installed and ANDROID_HOME is set.'));
}

// 2. Java runtime (required by the Appium UiAutomator2 driver) ---------------
try {
  execSync('java -version', { stdio: 'ignore' });
  console.log(GREEN('✓ Java runtime found on PATH.'));
} catch {
  failed = true;
  console.error(RED('✗ No Java runtime on PATH (the UiAutomator2 driver needs a JDK).'));
  console.error(YELLOW('  → Install JDK 17 and expose it (e.g. jenv + a JDK 17). See README "Exact environment".'));
}

// 3. uiautomator2 driver installed into Appium ------------------------------
try {
  const drivers = execSync('npx appium driver list --installed 2>&1', { encoding: 'utf-8' });
  if (/uiautomator2/i.test(drivers)) {
    console.log(GREEN('✓ Appium uiautomator2 driver installed.'));
  } else {
    console.error(YELLOW('! uiautomator2 driver not detected — attempting install...'));
    execSync('npx appium driver install uiautomator2', { stdio: 'inherit' });
  }
} catch (err) {
  console.error(YELLOW(`! Could not verify the uiautomator2 driver: ${err.message}`));
  console.error(YELLOW('  → Run: npx appium driver install uiautomator2'));
}

if (failed) {
  console.error(RED('\nPreflight failed — see messages above. Not starting the suite.'));
  process.exit(1);
}
console.log(GREEN('\nPreflight OK — starting the suite.\n'));
