import { ChessGame } from '../chess/game';
import { samplePack } from '../pack/fixtures';
import { indexPack } from '../pack/indexer';
import { validatePack } from '../pack/validate';
import { newCard, type SrsCard } from '../srs/fsrs';
import { examResult, pickExamLines, seededRandom } from './exam';
import { dueCount, reviewQueue } from './review';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 5, 1);

function index() {
  const v = validatePack(samplePack());
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return indexPack(v.pack);
}
const due = (daysAgo: number): SrsCard => ({
  ...newCard(0),
  state: 'review',
  due: NOW - daysAgo * DAY,
  lastReview: 1,
});

describe('reviewQueue', () => {
  it('lists due cards, most overdue first, along the shortest line', () => {
    const k = (...m: string[]) => ChessGame.fromSan(m).key;
    const cards: Record<string, SrsCard> = {
      [k('d4', 'd5')]: due(1), // Bf4 — in both lines at step 2
      [k('d4', 'd5', 'Bf4', 'c5')]: due(3), // e3 — only in the c5 line
      [k('d4', 'd5', 'Bf4', 'Nf6')]: { ...due(0), due: NOW + DAY }, // not due yet
      [k()]: newCard(NOW), // new cards are not reviews
    };
    const q = reviewQueue(index(), cards, NOW);
    expect(q.map((i) => [i.lineId, i.stepIndex])).toEqual([
      ['c5', 4],
      ['main', 2],
    ]);
    expect(dueCount(cards, NOW)).toBe(2);
  });

  it('skips cards whose position is no longer in the pack and respects the limit', () => {
    const cards = { 'unknown position': due(5), [ChessGame.fromSan(['d4', 'd5']).key]: due(1) };
    expect(reviewQueue(index(), cards, NOW, 1).map((i) => i.lineId)).toEqual(['main']);
  });
});

describe('exam', () => {
  it('picks lines reproducibly with a seed', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const one = pickExamLines(ids, 3, seededRandom(42));
    expect(one).toHaveLength(3);
    expect(new Set(one).size).toBe(3);
    expect(pickExamLines(ids, 3, seededRandom(42))).toEqual(one);
    expect(pickExamLines(ids, 10, seededRandom(1)).sort()).toEqual(ids);
  });

  it('passes at 85 % clean lines', () => {
    const r = (m: number[]) => m.map((mistakes, i) => ({ lineId: `l${i}`, mistakes }));
    expect(examResult(r([0, 0, 0, 0, 0, 0, 1]))).toMatchObject({ passed: true });
    expect(examResult(r([0, 0, 0, 1])).passed).toBe(false);
    expect(examResult(r([0, 2])).failed).toEqual(['l1']);
    expect(examResult([]).passed).toBe(false);
  });
});
