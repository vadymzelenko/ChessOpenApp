import type { SrsCard } from './fsrs';

/** Share (0..1) of a line's cards that are learned (in review, not lapsed into relearning). */
export function mastery(cards: readonly (SrsCard | undefined)[]): number {
  if (cards.length === 0) return 0;
  const learned = cards.filter((c) => c && c.state === 'review').length;
  return learned / cards.length;
}

/** Local calendar day "YYYY-MM-DD". */
export function dayKey(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Current streak in days (ТЗ §6 «серия дней»): consecutive active days ending
 * today, or yesterday if there is no activity yet today.
 */
export function streak(activeDays: readonly string[], todayMs: number): number {
  const set = new Set(activeDays);
  const DAY = 86_400_000;
  let cursor = todayMs;
  if (!set.has(dayKey(cursor))) cursor -= DAY;
  let n = 0;
  while (set.has(dayKey(cursor))) {
    n++;
    cursor -= DAY;
  }
  return n;
}
