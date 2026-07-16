import { BasePage } from './base.page.js';

/**
 * QA-only "Test settings" debug menu (More > Test settings).
 *
 * Used ONLY for deterministic test setup, and kept in its own page object so the
 * dependency on debug tooling is explicit and easy to remove if the account is
 * seeded externally instead. See README "Known limitations" and TASK1.md §8:
 * the demo account's daily check-in stopped generating, and advancing the app's
 * virtual "Today" by one day surfaces a fresh, completable check-in.
 */
export class TestSettingsPage extends BasePage {
  private get menuItem(): string {
    return this.byText('Test settings');
  }
  private get forwardOneDay(): string {
    return this.byText('Forward 1 day');
  }

  /**
   * Advance the app's virtual date by one day so today's daily check-in is
   * available. Starts and ends on Home. Idempotent across runs: each run steps
   * to a new day whose check-in is not yet completed.
   * @returns how many virtual days were advanced (always 1 here) so callers can
   *   reason about attribution without guessing the host clock.
   */
  async advanceOneDayToSurfaceCheckIn(): Promise<{ daysForwarded: number }> {
    await this.tapBottomNav('More');
    await this.scrollToText('Test settings').catch(() => undefined);
    await this.tap(this.menuItem, 'the "Test settings" menu item');

    await this.tap(this.forwardOneDay, 'the "Forward 1 day" control', 15000);

    // Return to Home so the newly-generated check-in card is in view.
    await this.tapBottomNav('Home');
    return { daysForwarded: 1 };
  }
}
