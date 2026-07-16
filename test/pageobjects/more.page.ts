import { BasePage } from './base.page.js';

/**
 * "More" tab → Log out → confirm (final flow step).
 *
 * [VERIFIED 2026-07-17] The "Log out" item sits below the fold of the More list;
 * confirmation is a dialog with NO / YES buttons; an RTM welcome popup can follow
 * logout before the login entry screen appears.
 */
export class MorePage extends BasePage {
  private get logoutItem(): string {
    return this.byText('Log out');
  }
  private get confirmYes(): string {
    return this.byText('YES');
  }

  /** Open the More tab. */
  async open(): Promise<void> {
    await this.tapBottomNav('More');
    await this.dismissInterstitials();
  }

  /**
   * Tap Log out and confirm. Two-step: the "Log out" list item, then "YES" in the
   * confirmation dialog (the dialog also shows a "Log out" heading, so we wait
   * specifically for the YES button).
   */
  async logOut(): Promise<void> {
    await this.scrollToText('Log out').catch(() => undefined);
    await this.tap(this.logoutItem, 'the "Log out" menu item', 10000);

    await this.tap(this.confirmYes, 'the "YES" logout confirmation', 8000);

    // An RTM welcome popup can appear on the way back to the login screen.
    await this.dismissInterstitials();
  }
}
