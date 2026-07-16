import { BasePage } from './base.page.js';

/**
 * Home surface + bottom navigation.
 *
 * [PROVISIONAL] Locators are by visible tab/label text (the app exposes no
 * resource-ids). `isReady()` doubles as the convergence signal for the survey
 * loop, so it must match a durable element of the logged-in shell — the bottom
 * navigation tabs are the safest choice.
 */
export class HomePage extends BasePage {
  private get bottomNavCandidates(): string[] {
    return [
      this.byDesc('Home'),
      this.byText('Home'),
      this.byDesc('Progress'),
      this.byText('Progress'),
      this.byDesc('More'),
      this.byText('More'),
    ];
  }

  private get dailyCheckInCandidates(): string[] {
    return [
      this.byTextContains('Daily check'),
      this.byTextContains('Check-in'),
      this.byTextContains('Check in'),
      this.byTextContains('Pain score'),
      this.byTextContains('How is your pain'),
      this.byTextContains('Record your pain'),
    ];
  }

  /** True once the logged-in Home shell (bottom nav) is present. */
  async isReady(): Promise<boolean> {
    return this.isAnyVisible(this.bottomNavCandidates, 2500);
  }

  /** Wait for Home, failing clearly if it never loads. */
  async waitUntilReady(timeout = 30000): Promise<void> {
    const candidates = this.bottomNavCandidates;
    const found = await this.firstVisible(candidates, timeout);
    if (!found) {
      throw new Error(
        `Home surface did not load (no bottom-nav tab visible). On screen: ${await this.describeScreen()}`,
      );
    }
  }

  /** Open the pain score / daily check-in entry point from Home. */
  async openDailyCheckIn(): Promise<void> {
    const entry = await this.firstVisible(this.dailyCheckInCandidates, 8000);
    if (!entry) {
      // Try scrolling the Home feed once before giving up.
      await this.scrollToText('check').catch(() => undefined);
    }
    const retry = entry ?? (await this.firstVisible(this.dailyCheckInCandidates, 4000));
    if (!retry) {
      throw new Error(
        `Could not find the pain score / daily check-in entry on Home. ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }
    await this.tap(retry, 'daily check-in / pain score entry');
  }
}
