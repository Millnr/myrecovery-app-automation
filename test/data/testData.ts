import { testConfig } from '../../config/capabilities.js';

/**
 * Test data for the pain check-in flow.
 *
 * Credentials come from `config/capabilities.ts` (env-overridable, with the
 * supplied demo defaults). The expected pain score is fixed by the exercise (1).
 */
export const patient = {
  email: testConfig.account.email,
  password: testConfig.account.password,
};

/** The exercise specifies a pain score of 1 for the "more advanced" flow. */
export const EXPECTED_PAIN_SCORE = 1;

/**
 * Today's date in the device's local timezone, computed at runtime (never
 * hardcoded), per the date-attribution reasoning in TASK1.md. Provided in a few
 * common formats so a Progress-tab date assertion can be added without guessing
 * the display format up front.
 */
export function expectedLocalDate(now: Date = new Date()): {
  iso: string;
  dayMonthYear: string;
  monthDay: string;
} {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const monthName = now.toLocaleString('en-GB', { month: 'long' });
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    dayMonthYear: `${dd}/${mm}/${yyyy}`,
    monthDay: `${dd} ${monthName}`,
  };
}
