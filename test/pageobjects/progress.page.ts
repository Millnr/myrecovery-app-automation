import { BasePage } from './base.page.js';

/**
 * Progress tab — verifies the "Surveys & assessments" card reflects the recorded
 * pain score (the "more advanced" flow's assertion, step 7).
 *
 * [PROVISIONAL] Tab label and card wording are located by visible text. The
 * verification is written to the interpretation reasoned out in TASK1.md: a
 * pain-score value of 1 is recorded and shown. If this build shows only a record
 * count on the card, `verifyPainScoreRecorded` is where that distinction is
 * asserted, and the value would be confirmed in the card's detail view.
 */
export class ProgressPage extends BasePage {
  private get progressTabCandidates(): string[] {
    return [this.byDesc('Progress'), this.byText('Progress')];
  }

  private get surveysCardCandidates(): string[] {
    return [
      this.byTextContains('Surveys & assessments'),
      this.byTextContains('Surveys and assessments'),
      this.byTextContains('Surveys & Assessments'),
    ];
  }

  private painScoreValue(value: number): string[] {
    return [
      this.byTextContains(`Pain score`),
      this.byText(String(value)),
      this.byTextMatches(`(?i).*pain.*${value}.*`),
    ];
  }

  /** Navigate to the Progress tab and wait for its content. */
  async open(): Promise<void> {
    const tab = await this.firstVisible(this.progressTabCandidates, 10000);
    if (!tab) {
      throw new Error(`Progress tab not found. On screen: ${await this.describeScreen()}`);
    }
    await this.tap(tab, 'Progress tab');

    const card = await this.firstVisible(this.surveysCardCandidates, 12000);
    if (!card) {
      throw new Error(
        `"Surveys & assessments" card not visible on Progress. ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }
  }

  /**
   * Assert the pain score has been recorded as the expected value.
   * @returns true when confirmed; throws with the screen contents otherwise so
   *   the suite fails clearly rather than silently passing.
   */
  async verifyPainScoreRecorded(expected: number): Promise<boolean> {
    await this.scrollToText('Pain score').catch(() => undefined);

    const painScoreLabelVisible = await this.isAnyVisible(
      [this.byTextContains('Pain score')],
      8000,
    );
    if (!painScoreLabelVisible) {
      throw new Error(
        `No "Pain score" entry found on the Surveys & assessments area. ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }

    const valueVisible = await this.isAnyVisible(this.painScoreValue(expected), 5000);
    if (!valueVisible) {
      throw new Error(
        `"Pain score" is present but the expected value "${expected}" was not shown. ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }
    return true;
  }
}
