import { BasePage } from './base.page.js';

/**
 * "More" tab → Log out → confirm (final flow step).
 *
 * [PROVISIONAL] Tab, menu item, and confirm-dialog button are located by visible
 * text. Logout is a two-step action (menu item, then a confirmation), so the
 * method waits for the confirm affordance before tapping it.
 */
export class MorePage extends BasePage {
  private get moreTabCandidates(): string[] {
    return [this.byDesc('More'), this.byText('More')];
  }

  private get logoutItemCandidates(): string[] {
    return [
      this.byText('Log out'),
      this.byText('Logout'),
      this.byText('Sign out'),
      this.byTextContains('Log out'),
    ];
  }

  private get confirmLogoutCandidates(): string[] {
    return [
      this.byText('Log out'),
      this.byText('Yes'),
      this.byText('Confirm'),
      this.byText('OK'),
      this.byTextContains('Log out'),
    ];
  }

  /** Open the More tab. */
  async open(): Promise<void> {
    const tab = await this.firstVisible(this.moreTabCandidates, 10000);
    if (!tab) {
      throw new Error(`More tab not found. On screen: ${await this.describeScreen()}`);
    }
    await this.tap(tab, 'More tab');
  }

  /**
   * Tap Log out and confirm.
   * The confirmation reuses "Log out" wording, so we first tap the menu item,
   * then wait for a *second* actionable "Log out"/"Yes"/"Confirm" and tap that.
   */
  async logOut(): Promise<void> {
    const logoutItem = await this.firstVisible(this.logoutItemCandidates, 8000);
    if (!logoutItem) {
      // The item may be below the fold on the More list.
      await this.scrollToText('Log out').catch(() => undefined);
    }
    const item = logoutItem ?? (await this.firstVisible(this.logoutItemCandidates, 4000));
    if (!item) {
      throw new Error(`Log out menu item not found. On screen: ${await this.describeScreen()}`);
    }
    await this.tap(item, 'Log out menu item');

    const confirm = await this.firstVisible(this.confirmLogoutCandidates, 8000);
    if (!confirm) {
      throw new Error(
        `Log out confirmation dialog did not appear. On screen: ${await this.describeScreen()}`,
      );
    }
    await this.tap(confirm, 'Log out confirmation');
  }
}
