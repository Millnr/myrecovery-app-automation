# Generative AI usage — Task 2 (Automation)

The brief encourages using generative AI and asks for what tools were used, where,
example prompts, and a note on any suggestions rejected. As a senior QA leader I
directed this build and used AI as an implementation and review accelerator, while
keeping the design decisions, the honesty of the environment reporting, and the
final judgement calls mine.

## Tools used

- **Claude Code (Anthropic)** — primary tool for Task 2: environment discovery on
  the device, project scaffolding, Page Object design, the locator strategy, the
  bounded survey-dismissal loop, the README, and this document.
- **ChatGPT** — used earlier in Task 1 to challenge my acceptance criteria (see
  `TASK1.md` "Generative AI usage").

## Where AI was used, and how I directed it

1. **Device + app discovery.** I had the AI confirm the device over `adb` and
   discover the real `appPackage` / launch activity from the phone rather than
   assume them. This caught two real environment issues up front (below).

2. **Locator strategy from ground truth.** I directed it to dump the live UI
   hierarchy (`adb shell uiautomator dump`) *before* writing any locators. That
   dump proved the app exposes no `resource-id`s, which set the whole
   text/accessibility-description strategy — an evidence-led decision, not a guess.

3. **Framework scaffolding.** WDIO + TS + Appium 3 project, POM structure,
   env-overridable capabilities, preflight checks, and single-command run.

4. **Resilience patterns.** The bounded survey loop, the "fail clearly, never
   hang" timeout posture, and the descriptive-error / on-screen-snapshot approach
   were specified by me (from my TASK1 reasoning) and implemented with AI.

### Example prompts

> "Confirm `adb devices -l` sees the HONOR X6c as authorized, then discover the
> myrecovery package name and main launch activity from the device — don't guess
> them."

> "Before writing locators, dump the live UI hierarchy and tell me whether the app
> exposes resource-ids. Base the locator strategy on what's actually in the tree."

> "Build the survey-dismissal step as a bounded loop that handles zero, one, or
> several surveys and fails clearly (naming the current screen) if a survey keeps
> reappearing — never assume a fixed count and never hang."

> "The suite must fail fast and clearly, not hang, if a step or the device is
> unavailable. Add preflight checks and bounded explicit waits, no fixed sleeps as
> the primary wait strategy."

## A suggestion I rejected, and why

**Rejected: the AI's initial reporting stack — `wdio-mochawesome-reporter`.**
Mochawesome is a common, reasonable-sounding default and it was the first choice
proposed. I had it verified against our actual stack before accepting it, and the
install failed with an `ERESOLVE` peer-dependency conflict: that reporter's latest
release (4.0.0) still peer-depends on **WebdriverIO v5**, and we are on **v9**.
Accepting it would have meant forcing `--legacy-peer-deps` and shipping a
knowingly-broken dependency tree. I rejected it and switched to
`@wdio/allure-reporter` (first-class WDIO v9 support, also explicitly allowed by
the brief), configured to emit a single self-contained HTML file. Lesson applied:
treat AI-suggested dependencies as candidates to verify against the real toolchain,
not as settled choices.

**Also rejected: guessing values that can be observed.** Early on it would have
been faster to hardcode a plausible package name / a fixed survey count. I declined
both — the package/activity are discovered from the device, and the survey handler
is count-agnostic — because guessed constants are exactly what makes mobile suites
silently wrong.

## Two real environment issues surfaced during the AI-assisted setup

- The HONOR X6c initially presented over USB as a **"HonorSuite" CD-ROM gadget**
  with no ADB interface (a MagicOS default), so `adb devices` was empty. Diagnosed
  from the USB descriptor and fixed by switching the phone to *Transfer files* mode.
- The demo account's **pending surveys had stopped generating** (see `TASK1.md`
  §8 and the README). Rather than let that block the exercise, the survey step was
  made resilient to any survey count, and the investigation is documented as
  evidence rather than presented as a blocker.
