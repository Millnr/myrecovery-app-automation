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
 * On the HOPCo-provided account (demouser1a) the daily check-in is available
 * naturally, so no seeding is normally needed. Step 4 only falls back to the Test
 * settings debug menu (advance the virtual day) if today's check-in has already
 * been completed — kept isolated in TestSettingsPage so the dependency is
 * explicit and used only when unavoidable.
 *
 * Assertions (TASK1 B1/B2 + Q4):
 *  - Pain value 1 is confirmed on the check-in seekbar badge (Stats card is count-only).
 *  - Progress Stats count increases by exactly one and persists after reopen.
 *  - Intended date is the Home "Today" label at the point the check-in is opened.
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
    // a previous run left a session logged in, or the account differs.
    await driver.terminateApp(testConfig.app.appPackage);
    await driver.activateApp(testConfig.app.appPackage);

    // Wait for the app to present a recognisable surface: the login entry, Home,
    // or a post-login overlay (a survey TaskActivity or a welcome PopupActivity).
    await driver.waitUntil(
      async () => {
        if (await login.isAtEntry(800)) return true;
        if (await home.isReady()) return true;
        return /TaskActivity|PopupActivity/.test(await home.currentActivity());
      },
      { timeout: 60000, interval: 1500, timeoutMsg: 'App did not reach a known surface after launch' },
    );

    if (await login.isAtEntry(1000)) return; // already logged out

    // Logged in (Home or post-login overlays): clear overlays to reach Home,
    // then log out so the test starts from the entry screen.
    await surveys.dismissAllSurveys(() => home.isReady());
    await home.waitUntilReady();
    await more.open();
    await more.logOut();
    await login.waitUntilLoaded();
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

    step('4. Ensure a completable daily check-in is available');
    if (await home.hasDailyCheckIn()) {
      console.log('   daily check-in already available (no seeding needed)');
    } else {
      // Fallback: today's check-in was already completed — advance the virtual
      // day via Test settings until a fresh, completable one appears.
      const { daysForwarded } = await testSettings.advanceUntilCheckInAvailable(async () => {
        await home.waitUntilReady();
        return home.hasDailyCheckIn();
      });
      await home.waitUntilReady();
      console.log(`   seeded via Test settings; virtual days forwarded: ${daysForwarded}`);
    }

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
