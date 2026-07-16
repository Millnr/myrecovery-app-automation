import { env } from './env.js';

/**
 * Single source of truth for the device + app under test.
 *
 * Every value has a committed default (discovered on the real device on
 * 2026-07-16 — see README "Exact environment") and can be overridden via
 * environment variables or an optional `.env` file, so the same suite runs
 * unchanged on another tester's phone by exporting a few variables.
 */
export const testConfig = {
  device: {
    udid: env('DEVICE_UDID', 'A2FCCP5912200515'),
    name: env('DEVICE_NAME', 'HONOR X6c'),
    platformVersion: env('PLATFORM_VERSION', '15'),
  },
  app: {
    // Discovered via: adb shell pm list packages | grep -i recovery
    appPackage: env('APP_PACKAGE', 'fhw.com.myrecovery'),
    // Discovered via: adb shell cmd package resolve-activity --brief fhw.com.myrecovery
    appActivity: env('APP_ACTIVITY', '.launch.LaunchActivity'),
  },
  account: {
    email: env('PATIENT_EMAIL', 'demouser1@test.mr'),
    // Demo account credentials supplied with the exercise. Committing throwaway
    // demo creds keeps the suite runnable with a single command; a real project
    // would inject these from a secrets store / CI variable instead.
    password: env('PATIENT_PASSWORD', 'foofooF@0'),
  },
  appium: {
    host: env('APPIUM_HOST', '127.0.0.1'),
    port: Number(env('APPIUM_PORT', '4723')),
  },
} as const;

/**
 * The Appium/UiAutomator2 capability object for the app under test.
 *
 * `noReset: true` is deliberate: we automate the already-installed build
 * (no .apk was supplied), so the app data/session must be preserved.
 * `appWaitActivity: '*'` makes the session resilient to the multi-stage launch
 * flow (LaunchActivity -> RegisterOrLogin / main shell) instead of pinning one
 * activity name that the app may bounce through.
 */
export const androidCapabilities: WebdriverIO.Capabilities = {
  platformName: 'Android',
  'appium:automationName': 'UiAutomator2',
  'appium:deviceName': testConfig.device.name,
  'appium:udid': testConfig.device.udid,
  'appium:platformVersion': testConfig.device.platformVersion,
  'appium:appPackage': testConfig.app.appPackage,
  'appium:appActivity': testConfig.app.appActivity,
  'appium:appWaitActivity': '*',
  'appium:noReset': true,
  'appium:fullReset': false,
  // Fail fast instead of hanging: cap how long we wait for the device/driver to
  // come up and for the app to reach a ready activity.
  'appium:newCommandTimeout': 120,
  'appium:appWaitDuration': 40000,
  'appium:uiautomator2ServerLaunchTimeout': 60000,
  'appium:uiautomator2ServerInstallTimeout': 60000,
  'appium:adbExecTimeout': 40000,
  // Steadier animations => steadier explicit waits on a real device.
  'appium:disableWindowAnimation': true,
  'appium:autoGrantPermissions': false,
};
