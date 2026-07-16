import { BasePage } from './base.page.js';

/**
 * Login / "Register or log in" screen.
 *
 * Locator provenance:
 *  - [VERIFIED 2026-07-16] Both the entry screen ("I already have a myrecovery
 *    account…") and the credentials screen (AuthActivity) were confirmed against
 *    live `uiautomator dump`s of app v8.2.0 on the HONOR X6c. The credentials
 *    screen exposes exactly two EditTexts — instance 0 = username (email/phone),
 *    instance 1 = password — and a "Login" button distinct from the "Login"
 *    heading, so the button is matched by its clickable container.
 */
export class LoginPage extends BasePage {
  private get welcomeHeading(): string {
    return this.byText('Welcome');
  }
  private get haveAccountOption(): string {
    return this.byTextContains('I already have a myrecovery account');
  }

  // [VERIFIED] Credentials screen (AuthActivity).
  private get usernameField(): string {
    return this.byClassInstance('android.widget.EditText', 0);
  }
  private get passwordField(): string {
    return this.byClassInstance('android.widget.EditText', 1);
  }
  private get submitButton(): string {
    // Two elements read "Login": the screen heading (instance 0) and the submit
    // button's label (instance 1). Target the button's label directly — tapping
    // it dispatches to its small clickable parent. (Matching the clickable
    // ancestor instead would resolve to the full-form outer container.)
    return this.byTextInstance('Login', 1);
  }

  /** Wait until the login entry screen is interactive. */
  async waitUntilLoaded(): Promise<void> {
    await this.waitForVisible(this.welcomeHeading, 'login entry screen ("Welcome")', 40000);
  }

  /** Non-throwing probe: are we on the logged-out entry screen? */
  async isAtEntry(timeout = 2000): Promise<boolean> {
    return this.isVisible(this.welcomeHeading, timeout);
  }

  /**
   * Complete the full patient login.
   * @throws if any expected control never appears — the suite fails clearly.
   */
  async loginAs(email: string, password: string): Promise<void> {
    // Resilient to starting state: from the entry screen, tap through to the
    // credentials form; if we are already on the credentials form, proceed.
    if (await this.isVisible(this.welcomeHeading, 8000)) {
      await this.tap(this.haveAccountOption, 'the "I already have a myrecovery account" option');
    }

    await this.waitForVisible(this.usernameField, 'username field on the credentials screen', 12000);
    await this.type(this.usernameField, email, 'username field');

    // The keyboard opened by the username field covers the password field below
    // it, so hide it before locating/typing the password.
    await this.hideKeyboardIfShown();
    await this.type(this.passwordField, password, 'password field');

    // Likewise, hide it so it can't cover the Login button at the bottom.
    await this.hideKeyboardIfShown();
    await this.tap(this.submitButton, 'Login button');
  }
}
