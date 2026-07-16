import { $ } from '@wdio/globals';
import { BasePage } from './base.page.js';

/**
 * Pain score / daily check-in survey.
 *
 * [VERIFIED 2026-07-17] Flow mapped on app v8.2.0 / HONOR X6c:
 *   intro ("Tap to start") -> pain rating (step 2/4) -> strength & energy
 *   (step 3/4) -> disclaimer + Submit (4/4) -> RTM welcome popup.
 *
 * Unlike the Flutter shell, the check-in activity exposes stable resource-ids
 * (e.g. survey.vas.seekbar, survey.vas.value_label). Pain is set by tapping the
 * seekbar at the scale-number's x and the seekbar's own centre y — no hardcoded
 * pixel offsets. Strength is dragged by a fraction of window width.
 */
export class CheckInPage extends BasePage {
  private get startButton(): string {
    return this.byText('Tap to start');
  }
  private get painQuestion(): string {
    return this.byTextContains('How much pain');
  }
  private get painSeekbar(): string {
    return this.byId('survey.vas.seekbar');
  }
  private get painValueLabel(): string {
    return this.byId('survey.vas.value_label');
  }
  private painNumber(value: number): string {
    // Prefer the dedicated min_label id for "1"; other values use scale text.
    if (value === 1) return this.byId('survey.vas.min_label');
    if (value === 10) return this.byId('survey.vas.max_label');
    return this.byTextInstance(String(value), 0);
  }
  private get strengthBadgeUnset(): string {
    return this.byText('-'); // value_label before a value is chosen
  }
  private get strengthHandle(): string {
    return this.byId('survey.vas.handle');
  }
  private get nextButton(): string {
    return this.byText('Next');
  }
  private get submitButton(): string {
    return this.byText('Submit');
  }

  /** Read the pain slider's current value from survey.vas.value_label. */
  private async readPainBadge(): Promise<string | null> {
    if (await this.isVisible(this.painValueLabel, 2500)) {
      const text = (await $(this.painValueLabel).getText()).trim();
      return text.length > 0 ? text : null;
    }
    // Fallback for builds without the id: first digit in the upper ~40% of the screen.
    const { height } = await this.windowSize();
    const badge = (await this.pageNodes()).find(
      (n) => /^\d+$/.test(n.text) && n.cy > height * 0.08 && n.cy < height * 0.4,
    );
    return badge ? badge.text : null;
  }

  /** Open the survey's first rating step. */
  async start(): Promise<void> {
    await this.tap(this.startButton, 'the check-in "Tap to start" button', 30000);
    await this.waitForVisible(this.painQuestion, 'the pain rating question', 20000);
  }

  /**
   * Set the pain score by tapping the seekbar track at the scale number's x
   * (y = seekbar centre — derived from the live element, not a pixel constant).
   * Confirms via value_label; retries once on mismatch, then fails clearly.
   */
  async setPainScore(value: number): Promise<void> {
    const numberSelector = this.painNumber(value);
    await this.waitForVisible(numberSelector, `pain scale number "${value}"`);
    await this.waitForVisible(this.painSeekbar, 'the pain seekbar', 10000);

    for (let attempt = 1; attempt <= 2; attempt++) {
      const numberCentre = await this.centerOf(numberSelector);
      const seekbarCentre = await this.centerOf(this.painSeekbar);
      await this.tapAt(numberCentre.x, seekbarCentre.y);

      const shown = await this.readPainBadge();
      if (shown === String(value)) return;
      if (attempt === 2) {
        throw new Error(
          `Pain slider did not settle on "${value}" (badge showed "${shown ?? 'none'}"). ` +
            `On screen: ${await this.describeScreen()}`,
        );
      }
    }
  }

  /**
   * Set the strength & energy slider to any value (task fixes only pain).
   * Drags the handle by ~25% of window width — scales across densities.
   */
  private async setStrengthAnyValue(): Promise<void> {
    if (!(await this.isVisible(this.strengthBadgeUnset, 4000))) return; // already set / not present

    const { width } = await this.windowSize();
    const handleSelector = (await this.isVisible(this.strengthHandle, 2000))
      ? this.strengthHandle
      : this.strengthBadgeUnset;
    const knob = await this.centerOf(handleSelector);
    await this.dragTo(knob.x, knob.y, knob.x + width * 0.25, knob.y, 1000);
    await this.waitForGone(this.strengthBadgeUnset, 'unset strength value', 6000).catch(() => undefined);
  }

  /**
   * Complete the whole check-in with the given pain value and submit it.
   * Each step is explicitly waited; a missing control fails the suite clearly.
   */
  async completeCheckIn(value: number): Promise<void> {
    await this.start();

    await this.setPainScore(value);
    await this.tap(this.nextButton, 'Next (after pain rating)');

    await this.setStrengthAnyValue();
    await this.tap(this.nextButton, 'Next (after strength & energy)');

    await this.tap(this.submitButton, 'Submit (check-in)', 15000);

    // The RTM welcome popup typically follows submission.
    await this.dismissInterstitials();
  }
}
