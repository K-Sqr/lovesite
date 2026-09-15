/**
 * weddingFund.js — the only numbers behind wedding.html. Edit here, nothing else.
 *
 * The page never stores a balance. It takes `balance` as of `balanceAsOf` and
 * adds one `weekly` deposit for every payday that has passed since, so the
 * total keeps itself up to date without anyone touching it. When you move
 * money in that doesn't fit the rhythm (a bonus, a gift), bump `balance` and
 * set `balanceAsOf` to that day.
 *
 * No goal amount on purpose — there isn't one yet, so there is no bar to fill.
 */

/** The day. 'YYYY-MM-DD', local. */
export const WEDDING_DATE = '2028-05-13';

export const FUND = {
  /** What was in the jar on `balanceAsOf`, before any automatic deposits. */
  balance: 400,
  balanceAsOf: '2026-09-15',

  /** 5% of a paycheck, every week. */
  weekly: 43.75,

  /** Day of the week the deposit lands: 0 = Sunday … 5 = Friday … 6 = Saturday. */
  payday: 5,

  /** Shown on the page so she knows where the number comes from. */
  source: '5% of every paycheck',
};
