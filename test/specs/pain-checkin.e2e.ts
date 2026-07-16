import { LoginPage } from '../pageobjects/login.page.js';
import { SurveyPage } from '../pageobjects/survey.page.js';
import { HomePage } from '../pageobjects/home.page.js';
import { CheckInPage } from '../pageobjects/checkin.page.js';
import { ProgressPage } from '../pageobjects/progress.page.js';
import { MorePage } from '../pageobjects/more.page.js';
import { patient, EXPECTED_PAIN_SCORE } from '../data/testData.js';

/**
 * myrecovery — "more advanced" core regression flow (Task 2).
 *
 * Login → dismiss all surveys → Home → daily pain check-in (score 1) →
 * Progress tab → verify Surveys & assessments shows the pain score → log out.
 *
 * The whole journey is a single test: a failure at any step aborts with a clear,
 * step-scoped message (and Mocha's timeout guards against a hang), rather than
 * cascading confusing failures across separate tests.
 */
describe('myrecovery patient — daily pain check-in (advanced flow)', () => {
  const login = new LoginPage();
  const surveys = new SurveyPage();
  const home = new HomePage();
  const checkIn = new CheckInPage();
  const progress = new ProgressPage();
  const more = new MorePage();

  const step = (name: string) => console.log(`\n▶ STEP: ${name}`);

  it('records a pain score of 1 and reflects it on Progress, then logs out', async () => {
    step('1. Login as patient');
    await login.loginAs(patient.email, patient.password);

    step('2. Close all surveys (bounded loop — handles zero, one, or several)');
    const result = await surveys.dismissAllSurveys(() => home.isReady());
    console.log(
      `   surveys dismissed: ${result.dismissedCount} (iterations: ${result.iterations}, reachedHome: ${result.reachedHome})`,
    );

    step('3. Confirm Home is displayed');
    await home.waitUntilReady();

    step('4. Open pain score / daily check-in');
    await home.openDailyCheckIn();

    step(`5. Complete the check-in with pain score ${EXPECTED_PAIN_SCORE}`);
    await checkIn.completeCheckIn(EXPECTED_PAIN_SCORE);

    step('6. Go to Progress tab');
    await progress.open();

    step(`7. Verify Surveys & assessments card shows pain score recorded as ${EXPECTED_PAIN_SCORE}`);
    const verified = await progress.verifyPainScoreRecorded(EXPECTED_PAIN_SCORE);
    await expect(verified).toBe(true);

    step('8. More → Log out → confirm');
    await more.open();
    await more.logOut();

    step('9. Confirm return to the login/entry screen');
    await login.waitUntilLoaded();
  });
});
