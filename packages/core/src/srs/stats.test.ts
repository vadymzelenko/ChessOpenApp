import { newCard, type SrsCard } from './fsrs';
import { dayKey, mastery, streak } from './stats';

const T = new Date(2026, 4, 10, 12).getTime();
const DAY = 86_400_000;

describe('mastery', () => {
  it('is the share of cards in review', () => {
    const review: SrsCard = { ...newCard(T), state: 'review' };
    const relearn: SrsCard = { ...newCard(T), state: 'relearning' };
    expect(mastery([review, relearn, undefined, review])).toBe(0.5);
    expect(mastery([])).toBe(0);
  });
});

describe('streak', () => {
  it('counts consecutive days ending today or yesterday', () => {
    const days = [dayKey(T), dayKey(T - DAY), dayKey(T - 2 * DAY), dayKey(T - 4 * DAY)];
    expect(streak(days, T)).toBe(3);
    expect(streak(days.slice(1), T)).toBe(2); // nothing today yet — still alive
    expect(streak([dayKey(T - 2 * DAY)], T)).toBe(0);
    expect(streak([], T)).toBe(0);
  });
});
