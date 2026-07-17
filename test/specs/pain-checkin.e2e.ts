import { LoginPage } from '../pageobjects/login.page.js';
import { SurveyPage } from '../pageobjects/survey.page.js';
import { HomePage } from '../pageobjects/home.page.js';
import { CheckInPage } from '../pageobjects/checkin.page.js';
import { ProgressPage } from '../pageobjects/progress.page.js';
import { MorePage } from '../pageobjects/more.page.js';
import { TestSettingsPage } from '../pageobjects/testsettings.page.js';
import { patient, EXPECTED_PAIN_SCORE, expectedDateFromHomeLabel } from '../data/testData.js';
import { testConfig } from '../../config/capabilities.js';
import { driver } from '@wdio/globals';

/**
 * myrecovery patient — "more advanced" core regression flow (Task 2).
 *
 * Login → dismiss all surveys → Home → seed a daily check-in → record pain
 * score 1 → verify it on the Progress "Surveys & assessments" card → log out.
 *
 * The whole journey is a single test: a failure at any step aborts with a clear,
 * step-scoped message (and Mocha's timeout guards against a hang), rather than
 * cascading confusing failures across separate tests.
 *
 * Note on the "seed" step: the demo account's daily check-in stopped generating
 * (documented in README + TASK1.md §8). Per the chosen approach, the suite uses
 * the in-app Test settings debug menu to advance the app's virtual day by one,
 * which surfaces a fresh, completable check-in. This is isolated in
 * TestSettingsPage so the dependency is explicit and removable.
 *
 * Assertions (TASK1 B1/B2 + Q4):
 *  - Pain value 1 is confirmed on the check-in seekbar badge (Stats card is count-only).
 *  - Progress Stats count increases by exactly one and persists after reopen.
 *  - Intended date is the Home "Today" label after virtual-day advance.
 */
describe('myrecovery patient — daily pain check-in (advanced flow)', () => {
  const login = new LoginPage();
  const surveys = new SurveyPage();
  const home = new HomePage();
  const checkIn = new CheckInPage();
  const progress = new ProgressPage();
  const more = new MorePage();
  const testSettings = new TestSettingsPage();

  const step = (name: string) => console.log(`\n▶ STEP: ${name}`);

  before(async () => {
    // Deterministic starting state: cold-start the app, then guarantee we are
    // logged out so the login step always begins from the entry screen — even if
    // a previous run failed before its own logout.
    await driver.terminateApp(testConfig.app.appPackage);
    await driver.activateApp(testConfig.app.appPackage);

    await driver.waitUntil(async () => (await login.isAtEntry(800)) || (await home.isReady()), {
      timeout: 45000,
      interval: 1000,
      timeoutMsg: 'App did not reach the login entry screen or Home after launch',
    });

    if (!(await login.isAtEntry(800)) && (await home.isReady())) {
      await more.open();
      await more.logOut();
      await login.waitUntilLoaded();
    }
  });

  it('records a pain score of 1 and reflects it on Progress, then logs out', async () => {
    step('1. Login as patient');
    await login.loginAs(patient.email, patient.password);

    step('2. Close all surveys (bounded loop — handles zero, one, or several)');
    const dismissal = await surveys.dismissAllSurveys(() => home.isReady());
    console.log(
      `   surveys dismissed: ${dismissal.dismissedCount} (iterations: ${dismissal.iterations}, reachedHome: ${dismissal.reachedHome})`,
    );

    step('3. Confirm Home is displayed');
    await home.waitUntilReady();

    step('4. Seed a completable daily check-in (Test settings → Forward day(s))');
    const { daysForwarded } = await testSettings.advanceUntilCheckInAvailable(async () => {
      await home.waitUntilReady();
      return home.hasDailyCheckIn();
    });
    await home.waitUntilReady();
    console.log(`   virtual days forwarded: ${daysForwarded}`);

    step('5. Capture the baseline "Pain scores recorded" count');
    await progress.openStats();
    const baseline = await progress.readPainScoresRecorded();
    console.log(`   baseline pain scores recorded: ${baseline}`);

    step('6. Open the pain score / daily check-in from Home');
    await home.goHome();
    // Capture the attribution date at the point of use: Home has now settled to
    // the seeded virtual day. Reading it immediately after the day-forward can
    // race the Home re-render, so this is the authoritative point.
    const intendedDate = expectedDateFromHomeLabel(await home.readTodayDateLabel());
    console.log(`   intended date (Home Today): ${intendedDate.weekdayDayMonth}`);
    await home.openDailyCheckIn();

    step(`7. Complete the check-in with pain score ${EXPECTED_PAIN_SCORE} (value verified on seekbar badge)`);
    await checkIn.completeCheckIn(EXPECTED_PAIN_SCORE);

    step('8. Verify Progress — count +1, persists after reopen; date attribution from Home');
    await progress.openStats();
    const updated = await progress.verifyPainScoreRecorded(baseline);
    console.log(`   pain scores recorded now: ${updated} (was ${baseline})`);
    await progress.confirmCountPersistsAfterReopen(updated);

    // Stats/Pain do not expose a discrete score or per-record date in v8.2.0;
    // primary date proof is Home's Today label (captured after virtual-day seed).
    await home.goHome();
    await expect(await home.readTodayDateLabel()).toBe(intendedDate.weekdayDayMonth);

    step('9. More → Log out → confirm');
    await more.open();
    await more.logOut();

    step('10. Confirm return to the login/entry screen');
    await login.waitUntilLoaded();
  });
});
