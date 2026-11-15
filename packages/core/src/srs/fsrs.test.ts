import {
  Again,
  Easy,
  Good,
  Hard,
  dueCards,
  intervalDays,
  newCard,
  ratingFromAttempt,
  retrievability,
  review,
  type SrsCard,
} from './fsrs';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 0, 1);
const days = (c: SrsCard, now: number) => Math.round((c.due - now) / DAY);

describe('FSRS-5', () => {
  it('interval equals stability at 90 % retention', () => {
    expect(intervalDays(10)).toBeCloseTo(10);
    expect(retrievability(10, 10)).toBeCloseTo(0.9);
  });

  it('schedules a new card by its first rating', () => {
    expect(days(review(newCard(T0), Good, T0), T0)).toBe(3);
    expect(days(review(newCard(T0), Easy, T0), T0)).toBe(16);
    expect(days(review(newCard(T0), Hard, T0), T0)).toBe(1);
    const again = review(newCard(T0), Again, T0);
    expect(again.state).toBe('learning');
    expect(again.due - T0).toBe(5 * 60_000);
  });

  it('grows intervals with successful reviews', () => {
    let c = review(newCard(T0), Good, T0);
    let now = c.due;
    const intervals: number[] = [];
    for (let i = 0; i < 4; i++) {
      c = review(c, Good, now);
      intervals.push(days(c, now));
      now = c.due;
    }
    for (let i = 1; i < intervals.length; i++)
      expect(intervals[i]!).toBeGreaterThan(intervals[i - 1]!);
    expect(c.reps).toBe(5);
  });

  it('a lapse shrinks stability and counts', () => {
    const c = review(review(newCard(T0), Good, T0), Good, T0 + 3 * DAY);
    const lapsed = review(c, Again, c.due);
    expect(lapsed.stability).toBeLessThan(c.stability);
    expect(lapsed.lapses).toBe(1);
    expect(lapsed.state).toBe('relearning');
  });

  it('keeps difficulty within 1..10 and makes Hard cards harder', () => {
    let easy = review(newCard(T0), Good, T0);
    let hard = easy;
    for (let i = 1; i <= 5; i++) {
      easy = review(easy, Easy, T0 + i * 30 * DAY);
      hard = review(hard, Hard, T0 + i * 30 * DAY);
    }
    expect(easy.difficulty).toBeGreaterThanOrEqual(1);
    expect(hard.difficulty).toBeLessThanOrEqual(10);
    expect(hard.difficulty).toBeGreaterThan(easy.difficulty);
  });

  it('caps the interval', () => {
    let c = review(newCard(T0), Easy, T0);
    for (let i = 0; i < 10; i++) c = review(c, Easy, c.due);
    expect(days(c, c.lastReview)).toBeLessThanOrEqual(365);
  });
});

describe('ratingFromAttempt and dueCards', () => {
  it('maps hints and mistakes to ratings', () => {
    expect(ratingFromAttempt({ mistakes: 1, hintLevel: 0 })).toBe(Again);
    expect(ratingFromAttempt({ mistakes: 0, hintLevel: 3 })).toBe(Again);
    expect(ratingFromAttempt({ mistakes: 0, hintLevel: 2 })).toBe(Hard);
    expect(ratingFromAttempt({ mistakes: 0, hintLevel: 1 })).toBe(Good);
    expect(ratingFromAttempt({ mistakes: 0, hintLevel: 0, fast: true })).toBe(Easy);
  });

  it('lists due cards, most overdue first, never new ones', () => {
    const cards = new Map<string, SrsCard>([
      ['a', { ...newCard(T0), state: 'review', due: T0 - DAY }],
      ['b', { ...newCard(T0), state: 'review', due: T0 - 2 * DAY }],
      ['c', { ...newCard(T0), state: 'review', due: T0 + DAY }],
      ['d', newCard(T0 - DAY)],
    ]);
    expect(dueCards(cards, T0)).toEqual(['b', 'a']);
  });
});
