import { BasePage } from './base.page.js';

/**
 * Login / "Register or log in" screen.
 *
 * Locator provenance:
 *  - [VERIFIED 2026-07-16] The entry screen and the "I already have a
 *    myrecovery account…" choice were confirmed against a live
 *    `uiautomator dump` of app v8.2.0 on the HONOR X6c.
 *  - [PROVISIONAL] The email/password/submit controls on the subsequent
 *    credentials screen are located by their most stable available signals
 *    (field hint text, then EditText ordinal). They are centralised here and
 *    are the first thing to confirm on the initial instrumented run — see
 *    README "Known limitations".
 */
export class LoginPage extends BasePage {
  // [VERIFIED] Landing heading + the "log in" branch of the entry screen.
  private get welcomeHeading(): string {
    return this.byText('Welcome');
  }
  private get haveAccountOption(): string {
    return this.byTextContains('I already have a myrecovery account');
  }

  // [PROVISIONAL] Credentials screen. Candidate lists let the flow adapt to the
  // exact wording without a code change; the first match wins.
  private get emailFieldCandidates(): string[] {
    return [
      this.byTextContains('Email'),
      this.byDescContains('Email'),
      this.byClassInstance('android.widget.EditText', 0),
    ];
  }
  private get passwordFieldCandidates(): string[] {
    return [
      this.byTextContains('Password'),
      this.byDescContains('Password'),
      this.byClassInstance('android.widget.EditText', 1),
    ];
  }
  private get submitButtonCandidates(): string[] {
    return [
      this.byText('Log in'),
      this.byText('Login'),
      this.byText('Sign in'),
      this.byTextContains('Log in'),
    ];
  }

  /** Wait until the login entry screen is interactive. */
  async waitUntilLoaded(): Promise<void> {
    await this.waitForVisible(this.welcomeHeading, 'login entry screen ("Welcome")', 40000);
  }

  /**
   * Complete the full patient login.
   * @throws if any expected control never appears — the suite fails clearly.
   */
  async loginAs(email: string, password: string): Promise<void> {
    await this.waitUntilLoaded();
    await this.tap(this.haveAccountOption, 'the "I already have a myrecovery account" option');

    const emailField = await this.firstVisible(this.emailFieldCandidates, 8000);
    if (!emailField) {
      throw new Error(
        `Could not find the email field on the credentials screen. On screen: ${await this.describeScreen()}`,
      );
    }
    await this.type(emailField, email, 'email field');

    const passwordField = await this.firstVisible(this.passwordFieldCandidates, 8000);
    if (!passwordField) {
      throw new Error(
        `Could not find the password field. On screen: ${await this.describeScreen()}`,
      );
    }
    await this.type(passwordField, password, 'password field');

    const submit = await this.firstVisible(this.submitButtonCandidates, 8000);
    if (!submit) {
      throw new Error(
        `Could not find the login/submit button. On screen: ${await this.describeScreen()}`,
      );
    }
    await this.tap(submit, 'login submit button');
  }
}
