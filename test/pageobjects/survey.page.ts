import { driver } from '@wdio/globals';
import { BasePage } from './base.page.js';

export interface SurveyDismissResult {
  /** How many survey close actions were performed (0 is valid). */
  dismissedCount: number;
  /** How many loop iterations ran. */
  iterations: number;
  /** Whether the Home surface was reached. */
  reachedHome: boolean;
}

/**
 * Handles the post-login "pending surveys" state.
 *
 * [VERIFIED 2026-07-17, demouser1a] After login a pending survey (e.g. "Your
 * health & wellbeing" / Global Health Questionnaire) auto-presents as a
 * `TaskActivity`. Per HOPCo, step 2 **closes** these surveys rather than
 * completing them — completing one removes it permanently, so it would not
 * reappear on the next run. A survey is closed via its intro acknowledgement
 * ("OK, thank you") then the close **X** (`survey.question.close_btn`); this does
 * NOT submit any answers. First-login welcome popups may follow and are cleared
 * as interstitials.
 *
 * This implements the resilient behaviour reasoned out in TASK1.md
 * (SUR-01/02/04): the number of surveys is not assumed (zero, one, or several),
 * each closure is confirmed by progress, and the loop is bounded so a survey that
 * refuses to close produces a clear failure rather than a hang.
 */
export class SurveyPage extends BasePage {
  private get surveyCloseButton(): string {
    return this.byId('survey.question.close_btn');
  }
  private get surveyIntroAck(): string {
    return this.byText('OK, thank you');
  }

  /** Close the currently-presented survey without completing it. */
  private async closeSurvey(): Promise<void> {
    // A survey opens on an intro screen whose only action is "OK, thank you";
    // that reveals the survey body, which carries the close (X) control.
    if (
      !(await this.isVisible(this.surveyCloseButton, 1500)) &&
      (await this.isVisible(this.surveyIntroAck, 1500))
    ) {
      await this.tap(this.surveyIntroAck, 'the survey intro "OK, thank you"');
    }

    await this.waitForVisible(this.surveyCloseButton, 'the survey close (X) button', 8000);
    await this.tap(this.surveyCloseButton, 'the survey close (X) button');

    // Closing a partly-viewed survey may prompt a discard confirmation.
    for (const label of ['Yes', 'Close', 'Discard', 'Confirm']) {
      if (await this.tapIfPresent(this.byText(label), 800)) break;
    }
  }

  /**
   * Close every pending survey until Home is reached.
   *
   * @param isHomeReady predicate that resolves true once the Home surface is up.
   *   Injected (rather than importing HomePage) to keep this class decoupled and
   *   the convergence condition explicit.
   * @param maxIterations hard upper bound; guards against a survey/popup that
   *   reappears indefinitely.
   */
  async dismissAllSurveys(
    isHomeReady: () => Promise<boolean>,
    maxIterations = 10,
  ): Promise<SurveyDismissResult> {
    let dismissedCount = 0;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      // Clear first-login welcome / RTM / Health Connect popups.
      await this.dismissInterstitials();

      // Success: zero-survey accounts return as soon as Home is up.
      if (await isHomeReady()) {
        return { dismissedCount, iterations: iteration - 1, reachedHome: true };
      }

      const activity = await this.currentActivity();
      if (activity.includes('TaskActivity')) {
        await this.closeSurvey();
        dismissedCount++;
        continue;
      }

      // Neither Home, a popup, nor a survey yet — usually post-login loading.
      // Settle briefly and retry; the iteration bound is the real guard.
      await driver.pause(1500);
    }

    if (await isHomeReady()) {
      return { dismissedCount, iterations: maxIterations, reachedHome: true };
    }
    throw new Error(
      `Survey dismissal did not converge after ${maxIterations} iterations (Home not reached). ` +
        `Closed ${dismissedCount} so far. On screen: ${await this.describeScreen()}`,
    );
  }
}
