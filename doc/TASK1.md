# Task 1 — Test Design: Check-In Flow

## Working assumptions

- A **pending survey** is a survey or assessment presented after successful login that can be dismissed without completing it.
- Dismissing a survey does not mark it complete or create answers.
- A check-in is recorded only after the app receives a successful submission response.
- The core positive test uses an account with no check-in already recorded for the intended date.
- Until confirmed otherwise, the intended date is the patient's local calendar date at successful submission, based on a trusted server timestamp converted to the patient's configured timezone.
- I have interpreted **“Pain score recorded as 1”** as a pain-score value of `1`. If the Progress card shows only a record count, I would verify that the count increases by one and verify the value in the relevant detail view.

---

## Acceptance criteria

### A. Dismissing pending surveys after login

#### Scenario A1 — No pending surveys

```gherkin
Given an active patient account has no pending surveys
When the patient logs in with valid credentials
Then the Home page is displayed
And no pending-survey overlay is shown
And the Home page can be used without a dismissal action
```

#### Scenario A2 — One pending survey

```gherkin
Given an active patient account has one pending survey
When the patient logs in with valid credentials
And dismisses the displayed survey
Then the survey is removed from the current view
And the Home page becomes accessible
And the survey is not marked as completed
And no answers are recorded for it
```

#### Scenario A3 — Several pending surveys

```gherkin
Given an active patient account has several pending surveys
When the patient logs in with valid credentials
And dismisses each survey as it is displayed
Then each dismissed survey is removed before the next is handled
And processing continues until no pending survey remains
And the Home page becomes accessible
And the flow does not depend on a fixed number of surveys
And none of the dismissed surveys is marked as completed
```

#### Scenario A4 — Dismissal fails

```gherkin
Given a pending survey is displayed after login
When its dismissal request fails or times out
Then the app must not falsely show the survey as successfully dismissed
And the survey must not be marked as completed
And the patient must receive clear failure feedback
And the patient must be able to retry or follow the agreed recovery path
```

---

### B. Recording the pain score and reflecting it on Progress

#### Scenario B1 — Successful daily check-in

```gherkin
Given the patient has no daily check-in recorded for the intended date
And is on the Home page
When the patient opens the pain score or daily check-in
And selects a pain score of 1
And completes all other mandatory questions with valid answers
And submits the check-in
Then the app confirms successful submission
And exactly one new check-in record is created
And its pain-score value is 1
```

#### Scenario B2 — Correct value and date on Progress

```gherkin
Given a daily check-in with pain score 1 has been submitted successfully
When the patient opens the Progress tab
Then the Surveys & assessments area reflects one additional pain-score record
And the new record has a pain-score value of 1
And it is attributed to the intended patient-local calendar date
And navigating away from and back to Progress does not remove or duplicate it
```

#### Scenario B3 — Submission fails

```gherkin
Given the patient has entered a valid daily check-in
When the submission request fails or times out
Then no successful-submission confirmation is displayed
And no new pain-score record appears on Progress
And the patient is clearly told that the check-in was not recorded
And retrying must not create an unintended duplicate
```

#### Scenario B4 — A check-in already exists for today

```gherkin
Given a daily check-in already exists for the intended date
When the patient attempts another check-in for that date
Then the app must follow the agreed duplicate-check-in rule
And must either prevent the submission or explicitly offer an edit or replacement action
And must not silently create an unintended duplicate
And Progress must remain consistent with the action confirmed to the patient
```

---

## Derived test cases

| ID | Test case and expected result | Task 2 decision | Reason |
|---|---|---|---|
| `SUR-01` | Login with zero pending surveys; Home is immediately usable | **Automate** | The reusable helper must safely handle the zero-survey state |
| `SUR-02` | Login with one or several surveys; dismiss all until Home is accessible | **Automate** | Core required flow; implement as a bounded loop rather than assuming a count |
| `SUR-03` | Survey dismissal fails; no false success or completion status | **Manual/exploratory for Task 2** | Reliable reproduction requires network interception, stubbing, or a controllable backend failure |
| `SUR-04` | The same blocking survey repeatedly reappears | **Automate as framework protection** | A maximum-iteration/timeout guard prevents the test hanging and produces a clear failure |
| `CHK-01` | Submit a new check-in with pain score `1`; one new record is persisted | **Automate** | Main advanced regression path |
| `CHK-02` | Open Progress; new value and intended date are shown and remain after reopening the tab | **Automate** | Verifies the business outcome, not only successful taps |
| `CHK-03` | A check-in already exists for today; no silent duplicate | **Manual until clarified** | Expected behaviour is undefined and the shared demo account may already contain today's data |
| `CHK-04` | Submission fails or times out; no success message or Progress record | **Manual/exploratory for Task 2** | Better suited to future automation with service virtualisation or API interception |
| `CHK-05` | Submit close to midnight or after a timezone change | **Manual/exploratory for Task 2** | Important date edge case, but device-time manipulation is disproportionate to the two-hour exercise |
| `CHK-06` | Select minimum and maximum permitted pain values | **Manual for Task 2; automate later** | Useful boundary coverage, but lower priority than the specified score-`1` E2E path |

### Task 2 implementation note

The automated survey handler will:

- wait explicitly for either a pending survey or the Home page;
- dismiss surveys while a dismissible survey is displayed;
- use a maximum iteration limit;
- fail with the current screen/survey identified if progress stops;
- never use a hardcoded survey count.

The automated check-in test will calculate the expected date at runtime rather than hardcoding it.

---

## Open questions and ambiguities

1. **What counts as a pending survey?**  
   Does this include introductory/consent messages such as the Remote Therapeutic Monitoring welcome modal, or only clinical surveys and assessments?

2. **What does “dismiss” mean?**  
   Is the survey hidden only for the current session, deferred, permanently declined, or recorded as skipped? Should dismissal be auditable?

3. **What happens if dismissal fails?**  
   Must the survey continue to block Home, or may the patient proceed while it remains pending?

4. **What does “Pain score recorded as 1” mean?**  
   Is `1` the submitted score value, or should the Progress card say that one pain-score record exists? If the card shows only a count, where should the value be verified?

5. **Which date and timezone own the check-in?**  
   Patient profile timezone, device timezone, server timezone, start time, or successful submission time?

6. **What is the rule when today's check-in already exists?**  
   Block, edit, replace, or add another entry?

7. **When should Progress update?**  
   Immediately after submission or eventually? If eventually, what delay is acceptable?

8. **Deterministic test data — resolved via in-app debug tooling.**  
   The build exposes a "Test settings" menu (More > Test settings) with QA-only 
   controls including "Set all surveys to partial" (resets surveys to pending), 
   "Forward/Back 1 day/1 week" (shifts the app's virtual "Today"), "Complete day 
   tasks (random data)," and "Clear local results." These appear to be the intended 
   mechanism for achieving a known survey/check-in state before a test run.
   
   Follow-up question for Henna: is using this debug menu for automated test setup 
   considered in-scope/expected, or should the suite instead assume a pre-seeded 
   account state provided externally? I've used it to reset state during this 
   exercise on that assumption.

---

## Generative AI usage

**Tool:** ChatGPT, used to review and challenge my draft rather than to define product behaviour.

**Example prompts:**

> Review these mobile healthcare acceptance criteria. Identify missing assumptions, failure modes, date/timezone risks, and any behaviour I have invented rather than derived from the requirement.

> Critique these test cases and separate what is realistic for a two-hour Appium E2E exercise from later manual, integration, or service-virtualised coverage.

I retained suggestions concerning variable survey counts, clear failure handling, persistence, duplicate protection, date attribution, deterministic test data, and loop protection.

I discarded speculative behaviours such as offline queuing, clinical alert thresholds, and automatic overwrite rules because they were not defined by the supplied requirement.
