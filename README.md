# myrecovery — Patient App E2E Automation (Task 2)

End-to-end automation of the myrecovery patient mobile app "more advanced" core
regression flow, on a **real Android device**, using **WebdriverIO + TypeScript +
Appium 3 (UiAutomator2)**.

**Automated flow**

1. Log in as a patient
2. Close **all** surveys (zero, one, or several — not assumed)
3. Land on Home
4. Open the pain score / daily check-in
5. Complete the check-in with a pain score of **1**
6. Go to the **Progress** tab
7. Verify the **Surveys & assessments** card shows the pain score recorded as **1**
8. **More → Log out → confirm**

Task 1 (acceptance criteria) lives alongside this in [`doc/TASK1.md`](doc/TASK1.md).
AI-tool usage for this build is documented in [`doc/AI-USAGE.md`](doc/AI-USAGE.md).

---

## Exact environment used

This suite was built and the device was verified on the following setup
(2026-07-16).

| Component | Version / value |
|---|---|
| OS (host) | macOS 13.7.8 (Ventura), x86_64 |
| Node.js | v24.16.0 (`.nvmrc` pins this) |
| npm | 11.13.0 |
| WebdriverIO (`@wdio/*`) | 9.29.1 |
| Appium server | 3.5.2 |
| Appium driver | `appium-uiautomator2-driver` 8.1.0 (UiAutomator2) |
| Report tooling | `@wdio/allure-reporter` 9.x + `allure-commandline` 2.43.0 |
| TypeScript / runner | TypeScript 5.9.3, tsx 4.23.1 |
| **Java (required at run time)** | **JDK 17** — see [Prerequisites](#prerequisites) |
| Android SDK | platform-tools (adb 1.0.41), build-tools 36.0.0/36.1.0/37.0.0, platform android-36.1 |
| **Device under test** | **HONOR X6c** (`NIC-LX1`), Android **15** / API **35**, UDID `A2FCCP5912200515` |
| App under test | `fhw.com.myrecovery`, versionName **8.2.0** (versionCode 10097662) |
| Launch activity | `.launch.LaunchActivity` |

The device + app values were discovered on-device (not guessed):

```bash
adb devices -l
adb shell pm list packages | grep -i recovery         # -> fhw.com.myrecovery
adb shell cmd package resolve-activity --brief fhw.com.myrecovery   # -> .launch.LaunchActivity
```

You can re-run this discovery any time with `npm run caps:discover`.

---

## Prerequisites

1. **Node 20+** (built on 24.16.0). `nvm use` will pick up `.nvmrc`.
2. **Android SDK platform-tools** on the machine, with `ANDROID_HOME` set
   (default assumed: `~/Library/Android/sdk`). `adb` must be reachable.
3. **JDK 17** available on `PATH` / via `JAVA_HOME`. The UiAutomator2 driver **and**
   the Allure report generator are Java processes, so a JDK is mandatory.
   This project ships a committed **`.java-version`** file pinned to `17`, so if
   you use **jenv** the correct JDK is selected automatically inside this folder
   only (it does not change your machine-wide Java). Example one-time setup:
   ```bash
   brew install --cask temurin@17      # or any JDK 17 distribution
   brew install jenv
   # add `eval "$(jenv init -)"` to your shell rc, then:
   jenv add "$(/usr/libexec/java_home -v 17)"
   # .java-version (=17) is already committed, so `java -version` in this dir -> 17
   ```
4. **A real Android device** connected over USB with **USB mode = "Transfer files"**
   and **USB debugging** authorized. On HONOR / MagicOS the phone defaults to a
   "HonorSuite" CD-ROM USB mode that exposes **no ADB interface** — switch it to
   *Transfer files* and accept the *Allow USB debugging* prompt. Verify with:
   ```bash
   npm run device:check       # expects a line ending in `device` (not `unauthorized`)
   ```

The `postinstall` step installs the UiAutomator2 driver into Appium automatically.

---

## How to run

```bash
npm install      # installs deps + the UiAutomator2 Appium driver
npm test         # single command: preflight -> Appium -> the E2E suite -> HTML report
```

`npm test`:

- runs **preflight** ([`scripts/preflight.mjs`](scripts/preflight.mjs)) which fails
  fast with a clear message if the device, Java, or the driver is missing (so you
  never wait on an opaque hang);
- starts and stops the **Appium server itself** via `@wdio/appium-service` (no
  second terminal needed);
- runs the E2E spec against the connected device;
- writes a **single self-contained HTML report** to
  `reports/allure-report/index.html` on every run — pass *or* fail.

Point the suite at a different device/account without editing code by copying
`.env.example` to `.env` (or exporting the same variables). All values in
[`config/capabilities.ts`](config/capabilities.ts) are env-overridable.

---

## Project structure (Page Object Model)

```
config/
  capabilities.ts     Device + app + Appium capabilities (env-overridable, single source of truth)
  env.ts              Zero-dependency optional .env loader
test/
  data/testData.ts    Credentials + expected pain score + runtime-computed date
  pageobjects/
    base.page.ts      Explicit-wait helpers + UiSelector builders (locator strategy lives here)
    login.page.ts     Login / "register or log in"
    survey.page.ts    Bounded survey-dismissal loop (the resilient handler)
    home.page.ts      Home shell + bottom nav; isReady() drives survey-loop convergence
    checkin.page.ts   Pain score / daily check-in
    progress.page.ts  Progress tab + "Surveys & assessments" verification
    more.page.ts      More -> Log out -> confirm
  specs/
    pain-checkin.e2e.ts   The advanced flow, one ordered journey
scripts/
  preflight.mjs       Fail-fast environment checks (pretest)
  discover-caps.mjs   Re-discover appPackage/appActivity from the device
wdio.conf.ts          Runner config, Appium service, bounded timeouts, Allure report
```

---

## Key design decisions

- **Locator strategy — text / accessibility-description, not resource-id.**
  The live UI hierarchy (captured with `adb shell uiautomator dump`) showed the
  app renders through a cross-platform toolkit that exposes **no stable
  `resource-id`s** — every node is a generic `View`/`TextView` carrying visible
  `text` or `content-desc`. Locating by user-visible text via `UiSelector` is
  therefore the correct and most stable strategy here, and it is centralised in
  `base.page.ts` so any change is a one-line edit. Candidate-list helpers
  (`firstVisible`) let a step try several plausible labels without committing to
  one that may not exist in this build.

- **Explicit waits only.** Every interaction waits for a real UI condition
  (`waitForDisplayed` / `waitForExist` / enabled). There are **no fixed sleeps as
  a primary wait strategy**. The global `waitforTimeout` and Mocha `timeout` are
  bounded, so a stuck step **fails clearly** instead of hanging.

- **Bounded survey loop (handles 0 / 1 / several).** `survey.page.ts` waits for
  *either* a dismissible survey *or* Home, dismisses one survey at a time,
  confirms each dismissal made progress, and is capped by a **maximum iteration
  count**. A repeatedly-reappearing survey produces a clear failure naming the
  current screen — implementing the SUR-01/02/04 reasoning from `TASK1.md`.

- **Clear failure behaviour.** Every Page Object method throws a descriptive,
  step-scoped error that includes a compact snapshot of on-screen text
  (`describeScreen()`), so a failure tells you *where* and *what was on screen*.
  The whole journey is a single test, so one failure aborts cleanly rather than
  cascading confusing errors across separate tests.

- **Runtime-computed date.** The expected check-in date is derived at run time in
  the device's local timezone (`testData.ts`), never hardcoded — per the
  date-attribution reasoning in `TASK1.md`.

- **Single-command, self-contained reporting.** Appium is managed by WDIO and the
  Allure report is generated as one `index.html` in `onComplete` (even on
  failure), so proof-of-run is always committable and viewable without a server.

---

## Assumptions

- The supplied demo account (`demouser1@test.mr`) is a patient account and is the
  intended account under test. Its throwaway credentials are committed as
  defaults so the suite runs with a single command; a real project would inject
  them from a secrets store.
- `noReset: true` is correct: we automate the **already-installed** build (no
  `.apk` was supplied), so app data/session must be preserved.
- "Pain score recorded as 1" means a pain-score **value of 1** is recorded and
  surfaced on the Progress *Surveys & assessments* area (see `TASK1.md`, open
  question 4). If this build shows only a record count on the card, that is the
  point where the count-vs-value distinction is asserted.

---

## Known limitations & investigation notes

- **Survey generation on the demo account (documented environment issue, not a
  code bug).** The demo account's pending surveys **stopped generating** during
  preparation. This was investigated — reproduced across logout/login and a
  reinstall — and an in-app **"Test settings"** debug menu (More → Test settings)
  was found exposing QA controls ("Set all surveys to partial", "Forward 1 day",
  "Clear local results"). A question is out to Henna on whether relying on that
  menu for test setup is in scope. **Because of this, the survey-dismissal step
  is written to be resilient to _any_ survey count including zero** — it does not
  depend on the account being in a particular survey state. See `TASK1.md` §8.

- **Post-login locators are provisional and marked `[PROVISIONAL]` in code.** The
  login *entry* screen was verified against a live hierarchy dump; the
  credentials, survey-dismiss, check-in, Progress, and logout controls are
  located by their most plausible visible-text signals and are the first thing to
  confirm on the initial instrumented run (Appium Inspector or the run's own
  failure output, which prints the on-screen text). They are centralised as
  candidate lists so confirming them is a one-line edit per control. This is a
  deliberate consequence of the app exposing no resource-ids plus limited
  hands-on time on deeper screens.

- **Shared demo account / today's check-in.** If a check-in already exists for
  today on the shared account, the app's duplicate rule may change step 5's
  behaviour (see `TASK1.md` CHK-03/B4). The debug menu's "Clear local results" /
  "Forward 1 day" is the intended way to reach a clean state.

- **Single platform.** Android only, per the brief ("either platform is fine").

---

## Proof of a passing run

The suite generates a self-contained Allure HTML report at
`reports/allure-report/index.html` and the console (spec-reporter) output on every
run. A device screen recording can also be captured with
`adb shell screenrecord /sdcard/run.mp4` (pull with `adb pull`). The committed
proof artefact(s) live under [`reports/`](reports/) and, where recorded, `doc/`.
