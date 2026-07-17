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
    // Prefer text: live dumps show bottom-nav labels as text, not content-desc.
    // Putting byDesc first burned the probe budget on misses every poll.
    return [
      this.byText('Home'),
      this.byText('Progress'),
      this.byText('More'),
      this.byDesc('Home'),
      this.byDesc('Progress'),
      this.byDesc('More'),
    ];
  }

  // [VERIFIED] The daily check-in appears under "Today" as a "<patient> daily
  // check-in" card once a check-in is due for the app's current day.
  private get dailyCheckInCard(): string {
    return this.byTextContains('daily check-in');
  }

  /**
   * The app's virtual "Today" date label under the timeline (e.g. "Fri 17 Jul").
   * This is the intended check-in attribution date when Test settings has
   * forwarded the day — prefer reading it from the UI over host-clock math.
   */
  async readTodayDateLabel(): Promise<string> {
    const nodes = await this.pageNodes();
    // Prefer a node immediately under a "Today" marker when present.
    const todayIdx = nodes.findIndex((n) => n.text === 'Today');
    const dateRe = /^[A-Za-z]{3}\s+\d{1,2}\s+[A-Za-z]{3}$/;
    if (todayIdx >= 0) {
      const nearby = nodes.slice(todayIdx, todayIdx + 6).find((n) => dateRe.test(n.text.trim()));
      if (nearby) return nearby.text.trim();
    }
    const any = nodes.find((n) => dateRe.test(n.text.trim()));
    if (any) return any.text.trim();
    throw new Error(
      `Could not read Home's Today date label (expected e.g. "Fri 17 Jul"). ` +
        `On screen: ${await this.describeScreen()}`,
    );
  }

  /** True once the logged-in Home shell (bottom nav) is present. */
  async isReady(): Promise<boolean> {
    // Short overall budget: used inside waitUntil / survey-loop polls.
    return this.isAnyVisible(this.bottomNavCandidates, 1200);
  }

  /** Wait for Home, failing clearly if it never loads. */
  async waitUntilReady(timeout = 30000): Promise<void> {
    // Clear any post-login interstitials (RTM / Health Connect) first.
    await this.dismissInterstitials();
    const found = await this.firstVisible(this.bottomNavCandidates, timeout);
    if (!found) {
      throw new Error(
        `Home surface did not load (no bottom-nav tab visible). On screen: ${await this.describeScreen()}`,
      );
    }
  }

  /** Return to the Home tab and wait until it is ready. */
  async goHome(): Promise<void> {
    await this.tapBottomNav('Home');
    await this.waitUntilReady();
  }

  /** Whether a daily check-in is currently available on Home. */
  async hasDailyCheckIn(timeout = 6000): Promise<boolean> {
    return this.isVisible(this.dailyCheckInCard, timeout);
  }

  /** Open the daily check-in / pain score card from Home. */
  async openDailyCheckIn(): Promise<void> {
    if (!(await this.hasDailyCheckIn(8000))) {
      throw new Error(
        `No daily check-in card on Home (a check-in may not be due for the app's current day). ` +
          `On screen: ${await this.describeScreen()}`,
      );
    }
    await this.tap(this.dailyCheckInCard, 'daily check-in card');
  }
}
