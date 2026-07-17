# myrecovery Patient App — Observed User Guide

A guide to the myrecovery patient mobile app (Android, **v8.2.0**, package
`fhw.com.myrecovery`), compiled from hands-on exploration of the demo account
(`demouser1@test.mr`, patient "Demo_User1 / Mr Sears", journey *"Dr. Amalia De
Comas: Hip Replacement with PT"*) on a HONOR X6c during Task 2.

> **How to read this.** Sections marked **Observed** describe what the app
> actually did in front of me. Sections marked **Inferred** are my best model of
> *how* it works based on that behaviour — treat them as informed hypotheses, not
> documented fact. The app is a Flutter build with an OpenID/OAuth login, a local
> Room database, and a Health Connect integration; branding is "THE CORE
> INSTITUTE — Outcomes by HOPCo".

---

## 1. Signing in

**Observed.**

1. On launch the app shows a **loading splash** ("myrecovery … NN%") while it
   syncs, then the **entry screen** ("Welcome") with two choices:
   - *"I've received a pin code and want to complete my account creation."*
   - *"I already have a myrecovery account, and want to log in."*
2. Choosing **log in** opens the credentials screen: **Username** (email or phone
   number) and **Password**, a **Login** button, plus *"I've forgotten my
   password"* and **Back**.
3. After a successful login the app may show one or more **interstitials** (see
   §7) before landing on **Home**.

**Inferred.** Login uses OAuth/OpenID (an `AppAuth` redirect activity is present),
so the "session" is a token held by the app; `noReset` automation preserves it,
which is why the app resumes logged-in until an explicit **Log out**.

---

## 2. Getting around — the bottom navigation

Five tabs are always present at the bottom: **Home · Messages · Progress · Info ·
More**. Everything below hangs off these.

---

## 3. Home

**Observed.** Home (top to bottom):

- **Video carousel** — "1 of 9 … Get to the CORE of Dr. Amalia De Comas" with
  play / previous / next controls and a duration (e.g. `02:09`). A set of 9
  educational videos for the journey.
- **Operation | Discharge** — two dark banner tabs that switch the timeline/phase
  context of the plan.
- **Today — `<weekday day month>`** (e.g. "Fri 17 Jul"): the day's task cards.
  The cards that appear here depend on what is scheduled/outstanding for that day:
  - **Your rehab exercises** — opens the day's exercise session (orange play icon).
  - **Checklists** — educational checklists shown as swipeable cards (e.g.
    *"Building good sleep habits"*, *"Getting started with your app"*), each with
    tick-off items and an *"OK, thank you"* action. A progress ring shows
    completion.
  - **`'<Patient>' daily check-in`** — the pain/strength survey, shown **only when
    a check-in is due for that day** (see §4 and §8).

**Inferred.** The "Today" date is the app's *business/virtual* day, not
necessarily the phone clock (Test settings can move it — §8). Task cards are
generated per virtual day from the treatment plan schedule; a completed item's
card disappears for that day.

---

## 4. The daily check-in (pain score) — the core clinical flow

**Observed.** Tapping the daily check-in card opens a paged survey
(`TaskActivity`):

1. **Intro** — title *"Pain rating"*, a summary ("Procedure: Hip Replacement with
   PT · Clinician: Mr Simon Sears · Operation date: Upcoming") and a **"Tap to
   start"** button. (Skipped when resuming a partly-answered check-in.)
2. **Pain rating — 24 hours** — *"How much pain have you had in the last 24
   hours?"* A **0–10 slider** (scale numbers 1–10 shown; the far-left position is
   **0 = "Pain-free"**). A large **value badge** at the top shows the current
   number with a descriptor (0 "Pain-free", 1 "Hardly noticeable", …). You set it
   by moving/tapping the slider.
3. **Strength & energy** — *"On a scale from 1–10, how close are you to your
   baseline strength and energy?"* A **1–10 slider** anchored *"I feel very weak"*
   ↔ *"I am at my full strength & energy"*.
4. **Disclaimer + Submit** — *"We wish you every success with your treatment and
   recovery. These results are not monitored in real-time. Please contact your
   clinical team if you have any concerns."* with **Submit**.

Navigation is **Previous / Next** with an `x/4` counter and a dotted progress bar.
On **Submit**, the **RTM welcome popup** (§7) typically appears. Submitting
increments **"Pain scores recorded"** on Progress by one.

**Inferred / QA-relevant behaviours.**

- The survey **resumes at the first unanswered question**, so reopening a
  partly-done check-in does not restart it at pain.
- **Next won't advance** until the current question has a value — a deliberate
  "all questions mandatory" gate.
- The two sliders behave slightly differently under automation: the pain slider
  responds to a **tap on the track**, while tapping the exact centre (where the
  thumb sits) is a **dead zone** — you must tap/drag off-centre. This is a normal
  consequence of a custom slider widget, not a bug.
- Results are stored locally (Room) and synced; the "not monitored in real-time"
  wording confirms this is asynchronous submission to the care team.

---

## 5. Progress

**Observed.** Four sub-tabs: **Stats · Exercises · Pain · Surveys**.

- **Stats** — two summary cards:
  - **Surveys & assessments**: *Surveys completed*, *Days until next survey*, and
    **Pain scores recorded** (a running **count**, e.g. "3", **not** the latest
    value).
  - **Educational content**: *Info pages completed %*, *Info pages rated*, *Videos
    watched (x of 9)*.
- **Pain** — trend charts: *"Pain rating – 24 hours"* with a **Daily average**,
  and *"Strength & energy"* with its own average; a **7 days / 30 days / All
  time** filter.
- **Surveys** — the scheduled **clinical assessments** and their history:
  *"Rate your hip (HOOS, Jr)"* (**HOOS-Jr**), *"VAS Joint satisfaction"*
  (**SANE**), *"Your health & wellbeing"* (**PROMIS Global-10**).

**Inferred.** There are two distinct "survey" concepts: the **daily check-in**
(pain + strength, feeds *Pain scores recorded* and the Pain charts) and the
**periodic clinical PROMs** (HOOS-Jr / SANE / PROMIS, on the Surveys sub-tab).
"Days until next survey" refers to the PROMs cadence. Because the Stats card shows
a **count**, verifying "pain score recorded as 1" means confirming *one new record
was created* (count +1) and reading the value itself from the check-in/Pain view —
the interpretation used in the automation (see `TASK1.md` Q4).

---

## 6. More

**Observed.** Header shows the journey (*"Dr. Amalia De Comas: Hip Replacement with
PT"*), then:

- **Treatment details**, **Exercise planner**, **Clinical contacts & locations**
- **General:** **Profile**, **App support**, **Permissions**, **Log out**,
  **Test settings**

**Log out** → confirmation dialog *"Are you sure you want to log out?"* with
**NO / YES**. Confirming may show the **RTM popup** once more, then returns to the
"Welcome" entry screen.

---

## 7. Interstitials (pop-ups that appear out of band)

These can appear at various points (after login, on opening Progress, after
submitting a check-in, during logout) independently of the daily flow:

- **Remote Therapeutic Monitoring (RTM) welcome** — *"Welcome to Remote
  Therapeutic Monitoring … This service may appear on your bill as RTM …"* with a
  single **OK**. It recurs; dismissing it is required to reach the underlying
  screen.
- **Health Connect onboarding chain** — up to three in sequence: *"Connect to
  Health Connect"* (Not now / Connect) → *"Permission required"* (NOT NOW /
  CONNECT) → *"Step data access"* (FAQ / OK). Used to pull step/activity data.
  Declining ("Not now") is the privacy-preserving path and does not block the app.

**Inferred.** RTM and Health Connect are the two "engagement" integrations layered
on top of the clinical journey; both are optional to the core flow, which is why
they surface as dismissible modals rather than blocking gates.

---

## 8. Test settings — a QA/debug menu (and how I think it works)

**Observed.** Reached via **More → Test settings**. The header shows the build
(`Test settings - 8.2.0 - 10097662`). Controls seen:

- **Virtual date:** `Forward 1 day`, `Back 1 day`, `Forward 1 week`,
  `Back 1 week` — each row shows the current *"Today: DD/MM/YYYY"*, and tapping
  moves that virtual "today".
- **Sync toggles:** `Sync journeys?`, `Sync content (JSON)?`,
  `Sync content (blobs)?`, `Sync results?`, `Sync user?`,
  `Sync activity modifiers?` (on/off; journeys/user/activity-modifiers were ON,
  content/results OFF by default).
- **Content/utility:** `Journey branding`, `Health metrics`, `Generate or clear
  Health Connect samples`, `Test scheduled popups` (27), `Test dynamic popups`
  (0), `Generate all static Messages` (3), `Generate all dynamic Messages` (0),
  `ROM`, `Without onboarding`, `Test crash` / `Log crash with message 'Test
  crash'`, `Clear Local Database` (*"Clears all Room tables"*).

**Directly confirmed behaviour.** Tapping **Forward 1 day** advanced *"Today"*
from 16/07 → 17/07 (and 17→18), and the **Home "Today" section then generated that
day's daily check-in card** — i.e. moving the virtual day forward is what makes a
fresh, completable pain check-in appear. Advancing again steps to the next day.

### How I think it's wired (inferred)

- **A virtual "today" offset drives content scheduling.** The treatment journey is
  a timeline of date-scheduled items (daily check-ins, exercises, checklists,
  PROMs). The app resolves "what is due" against a **business date** rather than
  the raw device clock. `Forward/Back day/week` nudge an **offset** applied to
  that business date, so the app re-evaluates the schedule and generates the
  target day's tasks. This is the standard way to test date-gated content without
  waiting real days.
- **The offset appears to reset on a cold start.** After force-stopping and
  relaunching, *"Today"* returned to the real calendar date, and a single *Forward
  1 day* landed on *real-today + 1* every run. That suggests the offset lives in
  app/session memory (or is recomputed from a fresh server "now" on launch) rather
  than being persisted across process death. Practically: each fresh run needs to
  re-apply the forward.
- **Why the demo account's check-ins "stopped generating."** Most likely the
  seeded plan's scheduled window fell behind the advancing real calendar, so no
  check-in was due "today". Nudging the virtual day forward re-enters a day the
  plan has a check-in scheduled for — which is exactly what unblocked it. (The
  automation exploits this: it advances the virtual day until a check-in card
  appears — self-healing across runs.)
- **The Sync toggles isolate data domains.** `journeys` (the plan/timeline),
  `content` JSON vs. blobs (text vs. media/assets), `results` (submitted
  answers/scores), `user` (profile), `activity modifiers` (exercise
  adjustments). Turning these off lets QA freeze one domain while exercising
  another, or reproduce stale-data states. `Sync results?` being **off** by default
  is notable — it may mean submitted results aren't force-pushed on every sync,
  which fits the "not monitored in real-time" disclaimer.
- **"Set all surveys to partial"** (noted in `TASK1.md` §8; a survey-state reset)
  and **`Clear Local Database`** are the state-reset levers — the former to put
  surveys back to pending, the latter a hard wipe of local Room tables (forcing a
  full re-sync/onboarding). **`Without onboarding`** likely launches a journey
  skipping first-run onboarding. The **popup / Messages generators** (with live
  counts) fabricate scheduled/dynamic popups and in-app messages for testing those
  surfaces. **`Generate or clear Health Connect samples`** injects fake step data
  so Progress/Health-Connect flows can be tested without a real wearable.
- **`Test crash`** deliberately raises an exception — a crash-reporting smoke test.

**QA caveat.** This is clearly a **debug-build-only** menu. Relying on it for test
setup is pragmatic (and used here), but it manipulates a **shared demo account's**
state and virtual clock, so parallel testers can interfere with each other, and a
production build would not expose it. A pre-seeded account or a backend fixture is
the more robust long-term approach — an open question flagged to the team.

---

## 9. Quick reference — key screens & identifiers

| Area | Android activity / signal |
|---|---|
| Entry (register / log in) | `…launch.registerorlogin…RegisterOrLoginActivity` |
| Credentials | `…auth.presentation.AuthActivity` |
| Home / shell | `…main.MainActivity` (tabs: Home, Messages, Progress, Info, More) |
| Daily check-in survey | `…tasks.TaskActivity` (ids: `survey.vas.seekbar`, `survey.vas.value_label`, `survey.question.title`) |
| RTM / interstitials | `…popup.PopupActivity` |
| Test settings branding | `…more.testSettings.branding.JourneyPalletActivity` |

*Compiled from observation on 2026-07-16/17; behaviours may differ on other
accounts, journeys, or app versions.*
