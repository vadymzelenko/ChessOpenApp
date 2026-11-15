/**
 * FSRS-5 spaced repetition (ТЗ §6 «Повторение (SRS)», module 18).
 * Card = a position where the user must find our move.
 * https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-Algorithm
 */

export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy
export const Again: Rating = 1;
export const Hard: Rating = 2;
export const Good: Rating = 3;
export const Easy: Rating = 4;

export type CardState = 'new' | 'learning' | 'review' | 'relearning';

export interface SrsCard {
  state: CardState;
  /** Days until recall probability falls to 90 %. */
  stability: number;
  /** 1 (easy) … 10 (hard). */
  difficulty: number;
  /** Epoch ms when the card is due. */
  due: number;
  /** Epoch ms of the last review (0 = never). */
  lastReview: number;
  reps: number;
  lapses: number;
}

/** Default FSRS-5 parameters. */
export const FSRS5_WEIGHTS = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575, 0.1192, 1.01925,
  1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655, 0.6621,
] as const;

const DECAY = -0.5;
const FACTOR = 19 / 81;
const DAY = 86_400_000;
const MINUTE = 60_000;

export interface FsrsOptions {
  /** Target recall probability (default 0.9). */
  retention?: number;
  maximumIntervalDays?: number;
  weights?: readonly number[];
}

export function newCard(now: number): SrsCard {
  return { state: 'new', stability: 0, difficulty: 0, due: now, lastReview: 0, reps: 0, lapses: 0 };
}

const clampD = (d: number) => Math.min(10, Math.max(1, d));

/** Probability of recall after `elapsedDays` with stability `s`. */
export function retrievability(elapsedDays: number, s: number): number {
  return s > 0 ? (1 + (FACTOR * elapsedDays) / s) ** DECAY : 0;
}

/** Interval in days for a target retention. */
export function intervalDays(s: number, retention = 0.9): number {
  return (s / FACTOR) * (retention ** (1 / DECAY) - 1);
}

/** Schedule the next review of a card answered with `rating` at `now`. */
export function review(
  card: SrsCard,
  rating: Rating,
  now: number,
  opts: FsrsOptions = {},
): SrsCard {
  const w = opts.weights ?? FSRS5_WEIGHTS;
  const retention = opts.retention ?? 0.9;
  const maxInterval = opts.maximumIntervalDays ?? 365;
  const d0 = (g: Rating) => clampD(w[4]! - Math.exp(w[5]! * (g - 1)) + 1);

  let { stability: s, difficulty: d } = card;
  if (card.state === 'new') {
    s = w[rating - 1]!;
    d = d0(rating);
  } else {
    const elapsed = Math.max(0, (now - card.lastReview) / DAY);
    if (elapsed < 1) {
      // Same-day (short-term) review.
      s = s * Math.exp(w[17]! * (rating - 3 + w[18]!));
    } else {
      const r = retrievability(elapsed, s);
      if (rating === Again) {
        s = Math.min(
          s,
          w[11]! * d ** -w[12]! * ((s + 1) ** w[13]! - 1) * Math.exp(w[14]! * (1 - r)),
        );
      } else {
        const hard = rating === Hard ? w[15]! : 1;
        const easy = rating === Easy ? w[16]! : 1;
        s =
          s *
          (Math.exp(w[8]!) *
            (11 - d) *
            s ** -w[9]! *
            (Math.exp(w[10]! * (1 - r)) - 1) *
            hard *
            easy +
            1);
      }
    }
    const delta = -w[6]! * (rating - 3);
    const dPrime = d + (delta * (10 - d)) / 9;
    d = clampD(w[7]! * d0(Easy) + (1 - w[7]!) * dPrime);
  }
  s = Math.max(0.01, s);

  const lapses = card.lapses + (rating === Again && card.state !== 'new' ? 1 : 0);
  if (rating === Again) {
    // Re-show soon in this session; the stability above still counts.
    return {
      state: card.state === 'new' ? 'learning' : 'relearning',
      stability: s,
      difficulty: d,
      due: now + 5 * MINUTE,
      lastReview: now,
      reps: card.reps + 1,
      lapses,
    };
  }
  const days = Math.min(maxInterval, Math.max(1, Math.round(intervalDays(s, retention))));
  return {
    state: 'review',
    stability: s,
    difficulty: d,
    due: now + days * DAY,
    lastReview: now,
    reps: card.reps + 1,
    lapses,
  };
}

/**
 * Rating from a training attempt (ТЗ §6 «Подсказки»): a mistake = Again,
 * the move shown by an arrow = Again, a text hint = Hard, a piece highlight
 * = Good, clean answer = Good (Easy if answered fast).
 */
export function ratingFromAttempt(a: {
  mistakes: number;
  hintLevel: 0 | 1 | 2 | 3;
  fast?: boolean;
}): Rating {
  if (a.mistakes > 0 || a.hintLevel >= 3) return Again;
  if (a.hintLevel === 2) return Hard;
  if (a.hintLevel === 1) return Good;
  return a.fast ? Easy : Good;
}

/** Cards due at `now`, most overdue first. */
export function dueCards<K>(cards: ReadonlyMap<K, SrsCard>, now: number): K[] {
  return [...cards.entries()]
    .filter(([, c]) => c.state !== 'new' && c.due <= now)
    .sort((a, b) => a[1].due - b[1].due)
    .map(([k]) => k);
}
