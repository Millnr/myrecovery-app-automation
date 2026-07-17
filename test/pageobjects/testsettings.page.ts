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
   * Advance the app's virtual date one day at a time until a completable daily
   * check-in is available on Home, then stop. Starts and ends on Home.
   *
   * Self-healing across runs: a day whose check-in was already completed by an
   * earlier run shows no card, so the loop steps forward again until it finds a
   * fresh day. This keeps the suite re-runnable without manual state resets.
   *
   * @param isCheckInAvailable predicate (injected to stay decoupled from HomePage)
   *   that resolves true once Home shows a daily check-in card.
   * @returns how many virtual days were advanced, so the caller can reason about
   *   the attribution date from the live Home label rather than the host clock.
   */
  async advanceUntilCheckInAvailable(
    isCheckInAvailable: () => Promise<boolean>,
    maxDays = 10,
  ): Promise<{ daysForwarded: number }> {
    for (let day = 1; day <= maxDays; day++) {
      await this.tapBottomNav('More');
      await this.scrollToText('Test settings').catch(() => undefined);
      await this.tap(this.menuItem, 'the "Test settings" menu item');
      await this.tap(this.forwardOneDay, 'the "Forward 1 day" control', 15000);

      await this.tapBottomNav('Home');
      if (await isCheckInAvailable()) return { daysForwarded: day };
    }
    throw new Error(
      `No daily check-in became available after advancing the virtual day ${maxDays} times.`,
    );
  }
}
