import { $, driver } from '@wdio/globals';
import type { ChainablePromiseElement } from 'webdriverio';

/**
 * Base class for every Page Object.
 *
 * Locator strategy (important):
 * The myrecovery Android build renders its UI through a cross-platform toolkit
 * that exposes NO stable `resource-id`s in the accessibility tree — verified by
 * dumping the live hierarchy with `adb shell uiautomator dump` during setup
 * (see doc/AI-USAGE.md and README "Known limitations"). Every node is a generic
 * View/TextView carrying a visible `text` or `content-desc`. We therefore locate
 * elements primarily by their user-visible text / accessibility description via
 * UiSelector, which is the correct and most stable strategy for this app. These
 * helpers centralise that so a locator change is a one-line edit.
 *
 * Wait strategy:
 * Every interaction goes through an explicit wait for a real UI condition
 * (displayed / enabled / gone). There are no fixed sleeps as a primary wait.
 * Timeouts are bounded so a broken step fails with a clear message instead of
 * hanging the suite.
 */
export abstract class BasePage {
  /** Default explicit-wait ceiling (mirrors wdio.conf `waitforTimeout`). */
  protected readonly timeout = 20000;
  /** Short probe used when merely checking presence without failing. */
  protected readonly probeTimeout = 3000;

  // --- UiSelector builders ---------------------------------------------------

  /** Escape characters that would break a UiSelector string literal. */
  private esc(value: string): string {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  }

  /** Exact visible text. */
  protected byText(text: string): string {
    return `android=new UiSelector().text("${this.esc(text)}")`;
  }

  /** Substring of visible text — resilient to surrounding whitespace/markup. */
  protected byTextContains(text: string): string {
    return `android=new UiSelector().textContains("${this.esc(text)}")`;
  }

  /** Case-insensitive text match via regex. */
  protected byTextMatches(pattern: string): string {
    return `android=new UiSelector().textMatches("${this.esc(pattern)}")`;
  }

  /** Accessibility description (content-desc), exact. */
  protected byDesc(desc: string): string {
    return `android=new UiSelector().description("${this.esc(desc)}")`;
  }

  /** Accessibility description substring. */
  protected byDescContains(desc: string): string {
    return `android=new UiSelector().descriptionContains("${this.esc(desc)}")`;
  }

  /** Nth element of a widget class (0-based). Last resort for unlabelled inputs. */
  protected byClassInstance(className: string, instance: number): string {
    return `android=new UiSelector().className("${className}").instance(${instance})`;
  }

  // --- Interactions (all explicitly waited) ----------------------------------

  private el(selector: string): ChainablePromiseElement {
    return $(selector);
  }

  /** Wait until an element is displayed, or fail with a clear message. */
  async waitForVisible(selector: string, reason: string, timeout = this.timeout): Promise<void> {
    await this.el(selector).waitForDisplayed({
      timeout,
      timeoutMsg: `Timed out after ${timeout}ms waiting for: ${reason} [${selector}]`,
    });
  }

  /** Wait until an element is gone from the tree (used to confirm progress). */
  async waitForGone(selector: string, reason: string, timeout = this.timeout): Promise<void> {
    await this.el(selector).waitForExist({
      reverse: true,
      timeout,
      timeoutMsg: `Timed out after ${timeout}ms waiting for '${reason}' to disappear [${selector}]`,
    });
  }

  /** Wait for visible + enabled, then tap. */
  async tap(selector: string, reason: string, timeout = this.timeout): Promise<void> {
    const element = this.el(selector);
    await element.waitForDisplayed({
      timeout,
      timeoutMsg: `Timed out after ${timeout}ms waiting to tap: ${reason} [${selector}]`,
    });
    // Best-effort enabled check; some toolkit views never report enabled=false.
    await element.waitForEnabled({ timeout: 5000 }).catch(() => undefined);
    await element.click();
  }

  /** Type into a field after waiting for it. Clears first for determinism. */
  async type(selector: string, value: string, reason: string, timeout = this.timeout): Promise<void> {
    const element = this.el(selector);
    await element.waitForDisplayed({
      timeout,
      timeoutMsg: `Timed out after ${timeout}ms waiting for input: ${reason} [${selector}]`,
    });
    await element.click();
    await element.clearValue().catch(() => undefined);
    await element.setValue(value);
  }

  /**
   * Non-throwing presence probe. Returns true if displayed within `timeout`,
   * false otherwise. Used by decision logic (e.g. the survey loop) that must
   * branch on UI state rather than fail.
   */
  async isVisible(selector: string, timeout = this.probeTimeout): Promise<boolean> {
    try {
      await this.el(selector).waitForDisplayed({ timeout });
      return true;
    } catch {
      return false;
    }
  }

  /** True if ANY of the candidate selectors is currently displayed. */
  async isAnyVisible(selectors: string[], timeout = this.probeTimeout): Promise<boolean> {
    for (const selector of selectors) {
      if (await this.isVisible(selector, timeout)) return true;
    }
    return false;
  }

  /**
   * Return the first candidate selector that is currently displayed, or null.
   * Lets a Page Object try several known affordances (e.g. "Skip" / "Not now" /
   * a close icon) without committing to one that may not exist in this build.
   */
  async firstVisible(selectors: string[], timeout = this.probeTimeout): Promise<string | null> {
    for (const selector of selectors) {
      if (await this.isVisible(selector, timeout)) return selector;
    }
    return null;
  }

  /** Scroll a scrollable container until an element with the given text is shown. */
  async scrollToText(text: string): Promise<void> {
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    await $(
      `android=new UiScrollable(new UiSelector().scrollable(true))` +
        `.scrollIntoView(new UiSelector().textContains("${escaped}"))`,
    );
  }

  /** Compact snapshot of on-screen text, for failure diagnostics. */
  async describeScreen(maxLen = 600): Promise<string> {
    try {
      const source = await driver.getPageSource();
      const texts = Array.from(source.matchAll(/text="([^"]+)"/g))
        .map((m) => m[1].trim())
        .filter((t) => t.length > 0);
      const unique = [...new Set(texts)].join(' | ');
      return unique.length > maxLen ? `${unique.slice(0, maxLen)}…` : unique;
    } catch {
      return '(could not read page source)';
    }
  }
}
