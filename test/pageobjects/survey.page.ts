import { driver } from '@wdio/globals';
import { BasePage } from './base.page.js';

export interface SurveyDismissResult {
  /** How many survey dismiss actions were performed (0 is valid). */
  dismissedCount: number;
  /** How many loop iterations ran. */
  iterations: number;
  /** Whether the Home surface was reached. */
  reachedHome: boolean;
}

/**
 * Handles the post-login "pending surveys" state.
 *
 * This implements the resilient behaviour reasoned out in TASK1.md
 * (SUR-01 / SUR-02 / SUR-04): the number of surveys is NOT assumed. The handler
 *   - waits for either a dismissible survey OR the Home surface,
 *   - dismisses surveys one at a time while a known dismiss control is present,
 *   - confirms each dismissal made progress (the control detaches),
 *   - is bounded by a maximum iteration count so a repeatedly-reappearing survey
 *     produces a CLEAR failure with the current screen contents, never a hang.
 *
 * [PROVISIONAL] The dismiss-control candidates below are the plausible "close
 * without completing" affordances for this build (close icon / skip / later).
 * They are the second thing to confirm on the first instrumented run, alongside
 * the survey-state investigation documented in the README.
 */
export class SurveyPage extends BasePage {
  /** Ordered candidates for a "dismiss this survey without completing it" control. */
  private get dismissControlCandidates(): string[] {
    return [
      this.byDesc('Close'),
      this.byDesc('Dismiss'),
      this.byText('Skip'),
      this.byText('Not now'),
      this.byText('Maybe later'),
      this.byText('Later'),
      this.byText('No thanks'),
      this.byText('Remind me later'),
      this.byTextContains('Skip'),
    ];
  }

  /**
   * Dismiss every pending survey until Home is reached.
   *
   * @param isHomeReady predicate that resolves true once the Home surface is up.
   *   Injected (rather than importing HomePage) to keep this class decoupled and
   *   to make the convergence condition explicit.
   * @param maxIterations hard upper bound on dismissals; guards against a survey
   *   that reappears indefinitely.
   */
  async dismissAllSurveys(
    isHomeReady: () => Promise<boolean>,
    maxIterations = 8,
  ): Promise<SurveyDismissResult> {
    let dismissedCount = 0;

    for (let iteration = 1; iteration <= maxIterations; iteration++) {
      // Clear any non-survey interstitials (RTM welcome / Health Connect) that
      // can sit in front of Home alongside, or instead of, pending surveys.
      await this.dismissInterstitials();

      // Success condition: zero-survey accounts return as soon as Home is up.
      if (await isHomeReady()) {
        return { dismissedCount, iterations: iteration - 1, reachedHome: true };
      }

      const control = await this.firstVisible(this.dismissControlCandidates, 3000);
      if (control) {
        await this.tap(control, `survey dismiss control [${control}]`);
        dismissedCount++;
        // Confirm progress: the tapped control should detach. Tolerate re-render.
        await this.waitForGone(control, 'dismissed survey control', 8000).catch(() => undefined);
        continue;
      }

      // Neither Home nor a recognised survey control yet. This is often a
      // transient (post-login loading, or an interstitial mid-render), so settle
      // briefly and retry rather than failing immediately. The iteration bound is
      // the real guard against a truly stuck screen.
      await driver.pause(1500);
    }

    // Exhausted the iteration budget without reaching Home.
    if (await isHomeReady()) {
      return { dismissedCount, iterations: maxIterations, reachedHome: true };
    }
    throw new Error(
      `Survey dismissal did not converge after ${maxIterations} iterations ` +
        `(Home not reached; possible repeatedly-reappearing survey or unexpected screen). ` +
        `Dismissed ${dismissedCount} so far. On screen: ${await this.describeScreen()}`,
    );
  }
}
