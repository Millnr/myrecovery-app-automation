import { $, driver } from '@wdio/globals';
import { BasePage } from './base.page.js';

/**
 * Pain score / daily check-in survey.
 *
 * [VERIFIED 2026-07-17] Flow on app v8.2.0 / HONOR X6c: an optional intro
 * ("Tap to start") then a paged survey — Pain rating (VAS 0–10), Strength &
 * energy (VAS), a disclaimer page with Submit — followed by the RTM popup.
 *
 * Unlike the Flutter shell, the survey activity exposes stable resource-ids
 * (survey.vas.seekbar, survey.vas.value_label, survey.question.title, …), which
 * this Page Object prefers. Pain is set by tapping the seekbar at the scale
 * number's x and the seekbar's own centre y (no hardcoded pixel offsets).
 *
 * Robustness: the survey RESUMES at the first unanswered question, so across
 * runs it may not open on the pain page. The flow therefore rewinds to the first
 * page and walks forward, setting the pain page to the required value and any
 * other VAS page to an arbitrary value, until Submit — never assuming page order.
 */
export class CheckInPage extends BasePage {
  private get startButton(): string {
    return this.byText('Tap to start');
  }
  private get questionTitle(): string {
    return this.byId('survey.question.title');
  }
  private get seekbar(): string {
    return this.byId('survey.vas.seekbar');
  }
  private get valueLabel(): string {
    return this.byId('survey.vas.value_label');
  }
  private get minLabel(): string {
    return this.byId('survey.vas.min_label'); // the "1" end of the scale
  }
  private get maxLabel(): string {
    return this.byId('survey.vas.max_label'); // the "10" end of the scale
  }
  private get previousButton(): string {
    return this.byText('Previous');
  }
  private get nextButton(): string {
    return this.byText('Next');
  }
  private get submitButton(): string {
    return this.byText('Submit');
  }

  private async titleText(): Promise<string> {
    if (await this.isVisible(this.questionTitle, 1500)) {
      return (await $(this.questionTitle).getText()).trim();
    }
    return '';
  }

  private async valueLabelText(): Promise<string | null> {
    if (await this.isVisible(this.valueLabel, 1500)) {
      return (await $(this.valueLabel).getText()).trim();
    }
    return null;
  }

  private async isPainPage(): Promise<boolean> {
    return (await this.titleText()).toLowerCase().includes('pain');
  }

  private async submitVisible(): Promise<boolean> {
    return this.isVisible(this.submitButton, 1500);
  }

  /** Open the survey and clear the optional intro. Fails clearly if not in it. */
  async start(): Promise<void> {
    await this.dismissInterstitials();
    if (await this.isVisible(this.startButton, 10000)) {
      await this.tap(this.startButton, 'the check-in "Tap to start" button', 15000);
      await this.dismissInterstitials();
    }
    await driver.waitUntil(
      async () => (await this.isVisible(this.seekbar, 1500)) || (await this.submitVisible()),
      {
        timeout: 20000,
        interval: 1000,
        timeoutMsg: `Check-in did not present a survey question after opening`,
      },
    );
  }

  /**
   * Move back to the pain page. The survey resumes at the first unanswered
   * question, so it may open ahead of pain; pain is the first question, so we
   * only ever tap Previous while NOT on it (never rewinding past it into the
   * intro). Fails clearly if the pain page can't be reached.
   */
  private async ensureOnPainPage(maxBack = 8): Promise<void> {
    for (let i = 0; i < maxBack; i++) {
      if (await this.isPainPage()) return;
      if (!(await this.isVisible(this.previousButton, 1200))) break;
      const before = await this.titleText();
      await this.tap(this.previousButton, 'the survey "Previous" button', 5000);
      await driver.pause(500);
      if ((await this.titleText()) === before) break; // no further back
    }
    if (!(await this.isPainPage())) {
      throw new Error(
        `Could not reach the pain rating page in the check-in. On screen: ${await this.describeScreen()}`,
      );
    }
  }

  /**
   * Set the pain score by tapping the seekbar at the "1" scale-number's x and the
   * seekbar's centre y, confirming via the value label. Retries once, then fails.
   */
  private async setPainScore(value: number): Promise<void> {
    await this.waitForVisible(this.seekbar, 'the pain seekbar', 10000);
    const numberSelector = value === 1 ? this.minLabel : this.byTextInstance(String(value), 0);
    await this.waitForVisible(numberSelector, `pain scale number "${value}"`);

    for (let attempt = 1; attempt <= 2; attempt++) {
      const numberCentre = await this.centerOf(numberSelector);
      const seekbarCentre = await this.centerOf(this.seekbar);
      await this.tapAt(numberCentre.x, seekbarCentre.y);

      if ((await this.valueLabelText()) === String(value)) return;
      if (attempt === 2) {
        throw new Error(
          `Pain slider did not settle on "${value}" (label showed "${await this.valueLabelText()}"). ` +
            `On screen: ${await this.describeScreen()}`,
        );
      }
    }
  }

  /**
   * Set any current (non-pain) VAS question to an arbitrary value by tapping the
   * track toward the "10" end. Tapping the dead-centre (where the handle sits)
   * does not register, so we deliberately tap an end position.
   */
  private async setVasAnyValue(): Promise<void> {
    await this.waitForVisible(this.seekbar, 'the VAS seekbar', 8000);
    const end = await this.centerOf(this.maxLabel);
    const seekbarCentre = await this.centerOf(this.seekbar);
    await this.tapAt(end.x, seekbarCentre.y);
    await driver.waitUntil(async () => (await this.valueLabelText()) !== '-', {
      timeout: 6000,
      interval: 500,
      timeoutMsg: 'VAS value did not register after tapping the track',
    });
  }

  /**
   * Complete the whole check-in: rewind to the first page, then walk forward
   * setting the pain page to `value` and any other VAS page to an arbitrary
   * value, until Submit. Order-independent and resume-safe.
   */
  async completeCheckIn(value: number, maxPages = 8): Promise<void> {
    await this.start();

    // Set the required pain value on the pain page.
    await this.ensureOnPainPage();
    await this.setPainScore(value);

    // Walk forward, answering each remaining VAS page, until Submit.
    for (let page = 0; page < maxPages; page++) {
      const before = await this.titleText();
      await this.tap(this.nextButton, 'the survey "Next" button');
      await driver.waitUntil(
        async () => (await this.titleText()) !== before || (await this.submitVisible()),
        { timeout: 12000, interval: 750, timeoutMsg: `Survey did not advance past "${before}"` },
      );

      if (await this.submitVisible()) {
        await this.tap(this.submitButton, 'Submit (check-in)', 15000);
        await this.dismissInterstitials(); // RTM welcome popup follows submission
        return;
      }

      // On a new question page: answer it if it is an unset VAS.
      if ((await this.valueLabelText()) === '-') {
        await this.setVasAnyValue();
      }
    }

    throw new Error(
      `Check-in did not reach Submit within ${maxPages} pages. On screen: ${await this.describeScreen()}`,
    );
  }
}
