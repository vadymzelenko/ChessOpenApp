import { positionKey } from '../chess/position';
import { samplePack } from '../pack/fixtures';
import { indexPack } from '../pack/indexer';
import { validatePack } from '../pack/validate';
import {
  bestStars,
  levelOfPosition,
  courseLevels,
  starTotals,
  starsForRun,
  unlockedCount,
  type Stars,
} from './levels';

function index() {
  const v = validatePack(samplePack());
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return indexPack(v.pack);
}

describe('courseLevels', () => {
  it('numbers every line, base lines before advanced ones inside a chapter', () => {
    const levels = courseLevels(index());
    expect(levels.map((l) => l.n)).toEqual(levels.map((_, i) => i + 1));
    expect(levels.length).toBeGreaterThan(0);
    expect(levels.length).toBeLessThanOrEqual(index().lines.size);
    for (const ch of new Set(levels.map((l) => l.chapterId))) {
      const ranks = levels
        .filter((l) => l.chapterId === ch)
        .map((l) => ['base', 'advanced', 'deep'].indexOf(l.level));
      expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);
    }
  });
});

describe('stars', () => {
  it('rates a run by mistakes and hints', () => {
    expect(starsForRun(0, 0)).toBe(3);
    expect(starsForRun(1, 0)).toBe(2);
    expect(starsForRun(0, 1)).toBe(2);
    expect(starsForRun(1, 1)).toBe(1);
    expect(starsForRun(5, 0)).toBe(1);
  });

  it('keeps the best result', () => {
    expect(bestStars(undefined, 1)).toBe(1);
    expect(bestStars(3, 1)).toBe(3);
    expect(bestStars(1, 2)).toBe(2);
  });

  it('opens levels one after another', () => {
    const levels = courseLevels(index());
    const stars: Record<string, Stars> = {};
    const of = (id: string) => stars[id] ?? 0;
    expect(unlockedCount(levels, of)).toBe(1);
    stars[levels[0]!.lineId] = 1;
    expect(unlockedCount(levels, of)).toBe(Math.min(2, levels.length));
    expect(unlockedCount([], of)).toBe(0);
    expect(starTotals(levels, of)).toEqual({ stars: 1, max: levels.length * 3 });
  });
});

describe('transpositions', () => {
  it('skips a line that only reaches another level by a different move order', () => {
    const base = samplePack();
    const pack = {
      ...base,
      course: {
        chapters: [
          {
            id: 'main',
            title: { ru: 'Главная' },
            lines: [
              {
                id: 'a',
                title: { ru: 'A' },
                level: 'base' as const,
                status: 'draft' as const,
                moves: [
                  'd4',
                  'd5',
                  'Bf4',
                  'Nf6',
                  'e3',
                  'e6',
                  'Nf3',
                  'Bd6',
                  'Bg3',
                  'O-O',
                  'Nbd2',
                  'c5',
                ],
              },
              {
                id: 'b',
                title: { ru: 'B' },
                level: 'base' as const,
                status: 'draft' as const,
                // Same position after a different order: 2…e6 instead of 2…Nf6.
                moves: ['d4', 'd5', 'Bf4', 'e6', 'e3', 'Nf6', 'Nf3', 'Bd6'],
              },
            ],
          },
        ],
      },
    };
    const v = validatePack(pack);
    if (!v.ok) throw new Error(v.errors.join('\n'));
    const idx = indexPack(v.pack);
    const levels = courseLevels(idx);
    expect(levels.map((l) => l.lineId)).toEqual(['a']);
    const lineB = idx.lines.get('b')!;
    const end = lineB.steps[lineB.steps.length - 1]!;
    expect(levelOfPosition(idx, levels, positionKey(end.move.fenAfter))?.lineId).toBe('a');
  });
});
