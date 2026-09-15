/**
 * weddingFund.js — the arithmetic behind wedding.html. Pure: imports only
 * dates.js and the config in src/data/weddingFund.js, touches no DOM.
 *
 * A deposit "lands" at local midnight on each payday strictly after
 * `balanceAsOf`. Between paydays the live figure accrues the next deposit
 * continuously at the weekly rate, so it is continuous across midnight:
 * the moment a deposit lands, the accrued part is exactly one `weekly`.
 */

import { parseISO, startOfDay, addDays, daysBetween, calendarDuration } from './dates.js';
import { FUND, WEDDING_DATE } from '../data/weddingFund.js';

const WEEK_MS = 7 * 86_400_000;

/** Most recent payday on or before `d` (local midnight). */
export function lastPayday(d = new Date(), payday = FUND.payday) {
  const day = startOfDay(d);
  return addDays(day, -((day.getDay() - payday + 7) % 7));
}

/** First payday strictly after `d`'s calendar day (local midnight). */
export function nextPayday(d = new Date(), payday = FUND.payday) {
  return addDays(lastPayday(d, payday), 7);
}

/** Paydays in (after, before) — both exclusive, whole calendar days. */
export function paydaysBetween(after, before, payday = FUND.payday) {
  const first = nextPayday(after, payday);
  const days = daysBetween(first, startOfDay(before));
  if (days <= 0) return 0;
  return Math.floor((days - 1) / 7) + 1;
}

/** Automatic deposits that have landed by `now` (on or before today). */
export function depositsSoFar(now = new Date(), fund = FUND) {
  const first = nextPayday(parseISO(fund.balanceAsOf), fund.payday);
  const days = daysBetween(first, startOfDay(now));
  if (days < 0) return 0;
  return Math.floor(days / 7) + 1;
}

/** Dates of the most recent `limit` deposits, newest first. */
export function recentDeposits(now = new Date(), limit = 6, fund = FUND) {
  const count = depositsSoFar(now, fund);
  const first = nextPayday(parseISO(fund.balanceAsOf), fund.payday);
  const dates = [];
  for (let i = count - 1; i >= Math.max(0, count - limit); i -= 1) {
    dates.push(addDays(first, i * 7));
  }
  return dates;
}

/** Round to cents so 43.75 × n never shows a floating-point tail. */
function cents(n) {
  return Math.round(n * 100) / 100;
}

/**
 * Everything the page renders, for one instant.
 * @param {Date} [now]
 */
export function snapshot(now = new Date(), fund = FUND, weddingDate = WEDDING_DATE) {
  const deposits = depositsSoFar(now, fund);
  const saved = cents(fund.balance + deposits * fund.weekly);
  const wedding = parseISO(weddingDate);
  const last = lastPayday(now, fund.payday);
  const next = nextPayday(now, fund.payday);

  // Continuous accrual of the next deposit: 0 at payday midnight, `weekly` a week later.
  const accrued = fund.weekly * ((now.getTime() - last.getTime()) / WEEK_MS);

  const ahead = paydaysBetween(now, wedding, fund.payday);

  return {
    saved,
    deposits,
    /** Weeks the jar represents, counting the opening balance at the weekly rate. */
    weeksIn: Math.floor(saved / fund.weekly),
    live: saved + accrued,
    // A payday on or after `balanceAsOf` counts, so the day the balance was set still says so.
    isDepositDay: daysBetween(last, now) === 0 && daysBetween(parseISO(fund.balanceAsOf), now) >= 0,
    lastDeposit: deposits > 0 ? last : null,
    nextDeposit: next,
    weekly: fund.weekly,
    monthly: cents((fund.weekly * 52) / 12),
    yearly: cents(fund.weekly * 52),
    daysToWedding: daysBetween(now, wedding),
    untilWedding: calendarDuration(now, wedding),
    /** If nothing changes: what's in the jar the morning of the wedding. */
    projected: cents(saved + ahead * fund.weekly),
    depositsAhead: ahead,
  };
}

/** '$1,234.56' — no currency assumptions beyond the sign she'll recognise. */
export function money(n, fractionDigits = 2) {
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}
