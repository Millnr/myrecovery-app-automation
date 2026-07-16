import { BasePage } from './base.page.js';

/**
 * Progress tab — verifies the "Surveys & assessments" card reflects the recorded
 * pain score (the "more advanced" flow's assertion, step 7).
 *
 * [VERIFIED 2026-07-17] The Progress "Stats" sub-tab shows a "Surveys &
 * assessments" card whose "Pain scores recorded" figure is a COUNT, not the
 * value (TASK1.md Q4). The Pain sub-tab only shows a daily average chart — no
 * discrete score or per-record date in the accessibility tree. Therefore:
 *   - this class asserts the count increases by exactly one (and stays after reopen);
 *   - the submitted value of 1 is verified at submit time via survey.vas.value_label;
 *   - the intended date is captured from Home's "Today" label (app virtual day).
 */
export class ProgressPage extends BasePage {
  private get statsSubTab(): string {
    return this.byText('Stats');
  }
  private get painSubTab(): string {
    return this.byText('Pain');
  }
  private get surveysCard(): string {
    return this.byTextContains('Surveys & assessments');
  }
  private get painScoresLabel(): string {
    return this.byText('Pain scores recorded');
  }
  private get painChartTitle(): string {
    return this.byTextContains('Pain rating');
  }

  /** Open Progress > Stats and wait for the Surveys & assessments card. */
  async openStats(): Promise<void> {
    await this.tapBottomNav('Progress');
    // Progress can show the Health Connect onboarding chain on first open.
    await this.dismissInterstitials();
    await this.tap(this.statsSubTab, 'the Progress "Stats" sub-tab', 12000);
    await this.waitForVisible(this.surveysCard, 'the "Surveys & assessments" card', 12000);
  }

  /**
   * Read the "Pain scores recorded" figure. The value sits directly above its
   * label in the card; column tolerance is a fraction of window width.
   */
  async readPainScoresRecorded(): Promise<number> {
    await this.waitForVisible(this.painScoresLabel, 'the "Pain scores recorded" figure', 10000);
    const { width } = await this.windowSize();
    const colTolerance = width * 0.2;
    const nodes = await this.pageNodes();
    const label = nodes.find((n) => n.text === 'Pain scores recorded');
    if (!label) {
      throw new Error(`"Pain scores recorded" not found. On screen: ${await this.describeScreen()}`);
    }
    const value = nodes
      .filter((n) => /^\d+$/.test(n.text) && n.cy < label.y1 && Math.abs(n.cx - label.cx) < colTolerance)
      .sort((a, b) => b.cy - a.cy)[0]; // closest numeric node above the label
    if (!value) {
      throw new Error(
        `Could not read the pain-scores count above its label. On screen: ${await this.describeScreen()}`,
      );
    }
    return Number(value.text);
  }

  /**
   * Assert that the pain-scores count increased by exactly one relative to the
   * baseline captured before the check-in.
   * @returns the new count when satisfied; throws clearly otherwise.
   */
  async verifyPainScoreRecorded(baselineCount: number): Promise<number> {
    const current = await this.readPainScoresRecorded();
    if (current !== baselineCount + 1) {
      throw new Error(
        `Expected "Pain scores recorded" to increase from ${baselineCount} to ${baselineCount + 1}, ` +
          `but it is ${current}. On screen: ${await this.describeScreen()}`,
      );
    }
    return current;
  }

  /**
   * B2 persistence: leave Progress and return; the count must still match.
   * Also opens the Pain chart sub-tab briefly so the Surveys area is not the
   * only Progress surface exercised (chart has no discrete value to assert).
   */
  async confirmCountPersistsAfterReopen(expectedCount: number): Promise<void> {
    await this.tapBottomNav('Home');
    await this.openStats();
    const again = await this.readPainScoresRecorded();
    if (again !== expectedCount) {
      throw new Error(
        `After reopening Progress, expected "Pain scores recorded" to remain ${expectedCount}, ` +
          `but it is ${again}. On screen: ${await this.describeScreen()}`,
      );
    }

    // Pain tab is chart-only (daily average) — assert it loads; value=1 is not shown here.
    await this.tap(this.painSubTab, 'the Progress "Pain" sub-tab', 10000);
    await this.waitForVisible(this.painChartTitle, 'the Pain rating chart', 10000);
  }
}
