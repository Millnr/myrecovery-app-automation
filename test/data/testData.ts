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

export interface ExpectedLocalDate {
  iso: string;
  dayMonthYear: string;
  monthDay: string;
  /** Matches Home's Today label, e.g. "Fri 17 Jul". */
  weekdayDayMonth: string;
}

/**
 * Format a Date the way the Home timeline shows "Today" (en-GB short weekday
 * + day + short month). Prefer reading the live label via HomePage when the
 * app's virtual day has been advanced via Test settings.
 */
export function expectedLocalDate(now: Date = new Date()): ExpectedLocalDate {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const monthName = now.toLocaleString('en-GB', { month: 'long' });
  const weekdayDayMonth = now
    .toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/,/g, '');
  return {
    iso: `${yyyy}-${mm}-${dd}`,
    dayMonthYear: `${dd}/${mm}/${yyyy}`,
    monthDay: `${dd} ${monthName}`,
    weekdayDayMonth,
  };
}

/** Build ExpectedLocalDate helpers around a live Home label like "Fri 17 Jul". */
export function expectedDateFromHomeLabel(label: string): ExpectedLocalDate {
  const trimmed = label.trim();
  const base = expectedLocalDate();
  return {
    ...base,
    weekdayDayMonth: trimmed,
    // Keep monthDay loosely aligned for Progress best-effort matching.
    monthDay: trimmed.replace(/^[A-Za-z]{3}\s+/, ''),
  };
}
