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

  /** Nth element with exactly this text (0-based) — disambiguates repeats. */
  protected byTextInstance(text: string, instance: number): string {
    return `android=new UiSelector().text("${this.esc(text)}").instance(${instance})`;
  }

  /** Accessibility description (content-desc), exact. */
  protected byDesc(desc: string): string {
    return `android=new UiSelector().description("${this.esc(desc)}")`;
  }

  /** Accessibility description substring. */
  protected byDescContains(desc: string): string {
    return `android=new UiSelector().descriptionContains("${this.esc(desc)}")`;
  }

  /** Nth element of a widget class (0-based). Used for unlabelled Flutter inputs. */
  protected byClassInstance(className: string, instance: number): string {
    return `android=new UiSelector().className("${className}").instance(${instance})`;
  }

  /** Android resource-id (exact). Prefer this when the hierarchy exposes one. */
  protected byId(resourceId: string): string {
    return `android=new UiSelector().resourceId("${this.esc(resourceId)}")`;
  }

  /**
   * A clickable container that has a descendant with the given text. The app
   * wraps tappable controls in a clickable View around a non-clickable label
   * (e.g. the "Login" button vs. the "Login" heading), so matching the clickable
   * ancestor by its child text is more precise than matching the text alone.
   */
  protected byClickableWithText(text: string): string {
    return (
      `android=new UiSelector().clickable(true)` +
      `.childSelector(new UiSelector().text("${this.esc(text)}"))`
    );
  }

  /** Current window size — used to derive relative geometry instead of magic pixels. */
  protected async windowSize(): Promise<{ width: number; height: number }> {
    return driver.getWindowSize();
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

  /**
   * Type into a field after waiting for it.
   *
   * The app's text fields are cross-toolkit proxies: UiAutomator2's `setValue`
   * sets the text then reads it back to verify, and the proxy doesn't report the
   * value, which throws "invalid element state" even though the text was
   * accepted. We therefore focus the field with a click and type through the
   * keyboard (`driver.keys`), which does not do that readback. The field is
   * cleared first for determinism.
   */
  async type(selector: string, value: string, reason: string, timeout = this.timeout): Promise<void> {
    const element = this.el(selector);
    await element.waitForDisplayed({
      timeout,
      timeoutMsg: `Timed out after ${timeout}ms waiting for input: ${reason} [${selector}]`,
    });
    await element.click();
    await element.clearValue().catch(() => undefined);
    await driver.keys(value);
  }

  /** Dismiss the soft keyboard if it is showing (so it can't cover a control). */
  async hideKeyboardIfShown(): Promise<void> {
    try {
      if (await driver.isKeyboardShown()) await driver.hideKeyboard();
    } catch {
      /* not all states support this; safe to ignore */
    }
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

  // --- Coordinate / gesture helpers ------------------------------------------
  // The app's pain/energy inputs are custom slider widgets that expose no
  // accessible sub-elements, so they can only be driven positionally. These
  // helpers keep that coordinate work in one place; callers derive coordinates
  // from real element positions (centerOf) rather than hardcoding pixels.

  /** Centre point of an element, in driver pixel coordinates. */
  async centerOf(selector: string): Promise<{ x: number; y: number }> {
    const element = this.el(selector);
    await element.waitForExist({ timeout: this.timeout });
    const loc = await element.getLocation();
    const size = await element.getSize();
    return { x: Math.round(loc.x + size.width / 2), y: Math.round(loc.y + size.height / 2) };
  }

  /** Single tap at an absolute coordinate (W3C touch pointer). */
  async tapAt(x: number, y: number): Promise<void> {
    await driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(x), y: Math.round(y) })
      .down()
      .pause(60)
      .up()
      .perform();
  }

  /** Press-and-drag between two coordinates (W3C touch pointer). */
  async dragTo(x1: number, y1: number, x2: number, y2: number, durationMs = 900): Promise<void> {
    await driver
      .action('pointer', { parameters: { pointerType: 'touch' } })
      .move({ x: Math.round(x1), y: Math.round(y1) })
      .down()
      .pause(150)
      .move({ duration: durationMs, x: Math.round(x2), y: Math.round(y2) })
      .pause(150)
      .up()
      .perform();
  }

  /** Tap a selector only if it is currently present; returns whether it acted. */
  async tapIfPresent(selector: string, timeout = 1500): Promise<boolean> {
    if (await this.isVisible(selector, timeout)) {
      await this.el(selector).click();
      return true;
    }
    return false;
  }

  // --- Page-source inspection ------------------------------------------------
  // Used for positional reads the accessibility tree can't give us by selector:
  // the slider's current value badge, a stat value sitting above its label, and
  // disambiguating bottom-nav labels from same-named headers.

  /** Parse the current page source into flat nodes with text/desc/bounds. */
  protected async pageNodes(): Promise<
    Array<{ text: string; desc: string; y1: number; cx: number; cy: number }>
  > {
    const src = await driver.getPageSource();
    const nodes: Array<{ text: string; desc: string; y1: number; cx: number; cy: number }> = [];
    const tagRe = /<[\w.$]+\s([^>]*?)\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(src)) !== null) {
      const attrs = m[1];
      const b = /bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(attrs);
      if (!b) continue;
      const text = (/\btext="([^"]*)"/.exec(attrs) ?? ['', ''])[1];
      const desc = (/content-desc="([^"]*)"/.exec(attrs) ?? ['', ''])[1];
      const [x1, y1, x2, y2] = [b[1], b[2], b[3], b[4]].map(Number);
      nodes.push({ text, desc, y1, cx: (x1 + x2) / 2, cy: (y1 + y2) / 2 });
    }
    return nodes;
  }

  /**
   * Tap a bottom-navigation item by label.
   * Disambiguated from same-named headers by requiring the node in the bottom
   * ~15% of the window (not a hardcoded y like 1380 — that only fits 720x1604).
   */
  async tapBottomNav(label: string): Promise<void> {
    const { height } = await this.windowSize();
    const navBandTop = height * 0.85;
    const nav = (await this.pageNodes()).find((n) => n.text === label && n.cy > navBandTop);
    if (!nav) {
      throw new Error(`Bottom-nav item "${label}" not found. On screen: ${await this.describeScreen()}`);
    }
    await this.tapAt(nav.cx, nav.cy);
  }

  /**
   * Dismiss known non-blocking interstitials that can appear at various points
   * (independently of the pending-survey flow): the Remote Therapeutic
   * Monitoring welcome popup and the Health Connect onboarding chain. Chooses
   * the privacy-preserving option ("Not now") and is bounded so it can never
   * loop forever. Returns how many popups it cleared.
   */
  async dismissInterstitials(maxRounds = 6): Promise<number> {
    let dismissed = 0;
    for (let round = 0; round < maxRounds; round++) {
      const src = await driver.getPageSource();
      let acted = false;

      if (src.includes('Remote Therapeutic Monitoring')) {
        acted = await this.tapIfPresent(this.byText('OK'), 1500);
      } else if (
        src.includes('Health Connect') ||
        src.includes('Permission required') ||
        src.includes('Step data access')
      ) {
        for (const label of ['Not now', 'NOT NOW', 'OK']) {
          if (await this.tapIfPresent(this.byText(label), 1200)) {
            acted = true;
            break;
          }
        }
      }

      if (!acted) break;
      dismissed++;
      await driver.pause(700); // brief settle for the next popup/screen to render
    }
    return dismissed;
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
