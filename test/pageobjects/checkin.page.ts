import { BasePage } from './base.page.js';

/**
 * Pain score / daily check-in flow.
 *
 * [PROVISIONAL] The exact pain-input control (numeric 0–10 buttons vs. a slider)
 * and the number of mandatory follow-up questions are not yet confirmed on this
 * build. The method therefore:
 *   - selects the pain value by its visible number, then
 *   - advances through any follow-up steps by clicking a bounded sequence of
 *     "next/continue/submit" affordances until submission is confirmed.
 * Both the value selector and the advance controls are centralised for a
 * one-line correction after the first instrumented run.
 */
export class CheckInPage extends BasePage {
  private painValue(value: number): string[] {
    return [this.byText(String(value)), this.byDescContains(`pain ${value}`)];
  }

  private get advanceCandidates(): string[] {
    return [
      this.byText('Submit'),
      this.byText('Save'),
      this.byText('Done'),
      this.byText('Finish'),
      this.byText('Continue'),
      this.byText('Next'),
      this.byText('Confirm'),
    ];
  }

  private get confirmationCandidates(): string[] {
    return [
      this.byTextContains('Thank you'),
      this.byTextContains('recorded'),
      this.byTextContains('submitted'),
      this.byTextContains('completed'),
    ];
  }

  /** Wait until the check-in screen is up (the target pain value is selectable). */
  async waitUntilLoaded(value: number, timeout = 20000): Promise<void> {
    const found = await this.firstVisible(this.painValue(value), timeout);
    if (!found) {
      throw new Error(
        `Check-in screen did not present a selectable pain value "${value}". ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }
  }

  /**
   * Select the given pain score and submit the check-in.
   * @param value pain score to record (the exercise requires 1).
   * @param maxSteps bound on follow-up "next/submit" taps so a mandatory-question
   *   flow cannot loop forever.
   */
  async completeCheckIn(value: number, maxSteps = 6): Promise<void> {
    await this.waitUntilLoaded(value);

    const valueSelector = await this.firstVisible(this.painValue(value), 5000);
    if (!valueSelector) {
      throw new Error(`Pain value "${value}" not selectable. On screen: ${await this.describeScreen()}`);
    }
    await this.tap(valueSelector, `pain score value "${value}"`);

    // Advance through the flow until a confirmation appears or we run out of steps.
    for (let step = 0; step < maxSteps; step++) {
      if (await this.isAnyVisible(this.confirmationCandidates, 1500)) return;
      const advance = await this.firstVisible(this.advanceCandidates, 4000);
      if (!advance) {
        // No further control and no confirmation — treat as submitted only if a
        // confirmation is (eventually) visible; otherwise fail clearly.
        if (await this.isAnyVisible(this.confirmationCandidates, 3000)) return;
        throw new Error(
          `Check-in did not reach a submit/confirmation after selecting "${value}" ` +
            `(${step} step(s)). On screen: ${await this.describeScreen()}`,
        );
      }
      await this.tap(advance, `check-in advance control [${advance}]`);
    }

    if (!(await this.isAnyVisible(this.confirmationCandidates, 3000))) {
      throw new Error(
        `Check-in submission not confirmed after ${maxSteps} steps. ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }
  }
}
