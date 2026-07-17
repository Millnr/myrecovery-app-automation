import { androidCapabilities, testConfig } from './config/capabilities.js';
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

/**
 * WebdriverIO runner configuration for the myrecovery Android E2E suite.
 *
 * Design goals baked in here:
 *  - The Appium server is started/stopped by @wdio/appium-service, so the whole
 *    suite runs from a single command (`npm test`) with no separate terminal.
 *  - Global timeouts are bounded everywhere so a broken step FAILS rather than
 *    hangs (see waitforTimeout, connectionRetryTimeout, mocha timeout).
 *  - A self-contained Allure HTML report is generated in onComplete on every
 *    run (pass or fail), so proof-of-run is always committable.
 */
export const config: WebdriverIO.Config = {
  runner: 'local',
  tsConfigPath: './tsconfig.json',

  specs: ['./test/specs/**/*.e2e.ts'],
  maxInstances: 1, // one physical device => strictly serial.

  capabilities: [androidCapabilities],

  logLevel: 'info',
  bail: 0,
  baseUrl: '',

  // --- Explicit-wait strategy -------------------------------------------------
  // This is the DEFAULT timeout for every explicit wait (waitForDisplayed etc.).
  // The suite never uses fixed sleeps as its primary wait strategy; it waits for
  // real UI conditions and gives up here if they never arrive.
  waitforTimeout: 20000,
  waitforInterval: 500,

  // Bound connection/session setup so an unreachable device fails fast.
  connectionRetryTimeout: 120000,
  connectionRetryCount: 2,

  // --- Appium server, managed by WDIO ----------------------------------------
  services: [
    [
      'appium',
      {
        command: 'appium',
        args: {
          address: testConfig.appium.host,
          port: testConfig.appium.port,
          // uiautomator2 is installed as a project dependency via `postinstall`.
          relaxedSecurity: true,
        },
      },
    ],
  ],
  hostname: testConfig.appium.host,
  port: testConfig.appium.port,
  path: '/',

  framework: 'mocha',
  mochaOpts: {
    ui: 'bdd',
    // Hard ceiling for a single test. If a step wedges, Mocha aborts the test
    // with a clear timeout error instead of hanging the whole run.
    timeout: 240000,
  },

  reporters: [
    'spec',
    [
      'allure',
      {
        outputDir: './reports/allure-results',
        disableWebdriverStepsReporting: false,
        disableWebdriverScreenshotsReporting: false,
      },
    ],
  ],

  // --- Hooks ------------------------------------------------------------------
  onPrepare: function () {
    mkdirSync('./reports/allure-results', { recursive: true });
  },

  /**
   * Belt-and-suspenders for Flutter/non-idling UI: capabilities may or may not
   * apply settings depending on driver/W3C parsing — force them on the live
   * session so findElement does not block for minutes waiting on idle.
   */
  before: async function () {
    const { driver } = await import('@wdio/globals');
    await driver.updateSettings({
      waitForIdleTimeout: 100,
      waitForSelectorTimeout: 10000,
      actionAcknowledgmentTimeout: 100,
    });
  },

  /**
   * Generate ONE self-contained Allure HTML file from the run results.
   * Runs regardless of pass/fail so a failing run still produces committable
   * proof. `--single-file` yields a single index.html that opens straight from
   * the repo with no web server. Never throws — report generation must not mask
   * the actual test result.
   */
  onComplete: function () {
    try {
      const allure = './node_modules/.bin/allure';
      const result = spawnSync(
        allure,
        [
          'generate',
          './reports/allure-results',
          '--single-file',
          '--clean',
          '-o',
          './reports/allure-report',
        ],
        { stdio: 'inherit', shell: process.platform === 'win32' },
      );
      if (result.status === 0) {
        console.log('\nHTML report written to ./reports/allure-report/index.html');
      } else {
        console.warn('\nAllure report generation returned a non-zero status; see output above.');
      }
    } catch (err) {
      console.warn('Allure report generation skipped:', (err as Error).message);
    }
  },
};
