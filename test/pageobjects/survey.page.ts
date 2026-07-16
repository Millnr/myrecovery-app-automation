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
      // Success condition first: zero-survey accounts return immediately.
      if (await isHomeReady()) {
        return { dismissedCount, iterations: iteration - 1, reachedHome: true };
      }

      const control = await this.firstVisible(this.dismissControlCandidates, 4000);

      if (!control) {
        // Neither Home nor a recognised survey control. Give the UI one more
        // settle-and-recheck before declaring the flow stuck.
        if (await isHomeReady()) {
          return { dismissedCount, iterations: iteration, reachedHome: true };
        }
        throw new Error(
          `Survey handler stuck after ${dismissedCount} dismissal(s): no known dismiss ` +
            `control is visible and Home was not reached. On screen: ${await this.describeScreen()}`,
        );
      }

      await this.tap(control, `survey dismiss control [${control}]`);
      dismissedCount++;

      // Confirm the dismissal made progress: the tapped control should detach.
      // Tolerate re-render (a new survey may reuse the same control) — the loop's
      // top-of-iteration Home check and the iteration bound are the real guards.
      await this.waitForGone(control, 'dismissed survey control', 8000).catch(() => undefined);
    }

    throw new Error(
      `Survey dismissal did not converge after ${maxIterations} iterations ` +
        `(possible repeatedly-reappearing/blocking survey). Dismissed ${dismissedCount} so far. ` +
        `On screen: ${await this.describeScreen()}`,
    );
  }
}
