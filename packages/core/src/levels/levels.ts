import type { PackIndex } from '../pack/indexer';
import type { LineLevel, LocalizedText } from '../pack/schema';

/** One level of the course map: a course line (ТЗ §6, «уровни как в игре»). */
export interface CourseLevel {
  /** 1-based number on the map. */
  n: number;
  lineId: string;
  chapterId: string;
  chapterTitle: LocalizedText;
  title: LocalizedText;
  level: LineLevel;
  /** Full moves in the line. */
  moves: number;
}

export type Stars = 0 | 1 | 2 | 3;

const LEVEL_RANK: Record<LineLevel, number> = { base: 0, advanced: 1, deep: 2 };

/**
 * Levels in learning order: chapters as in the course (most common replies
 * first), and inside a chapter the base lines before advanced and deep ones,
 * keeping the author's order otherwise.
 */
export function courseLevels(index: PackIndex): CourseLevel[] {
  const out: CourseLevel[] = [];
  for (const chapter of index.pack.course.chapters) {
    const lines = chapter.lines
      .map((line, i) => ({ line, i }))
      .sort((a, b) => LEVEL_RANK[a.line.level] - LEVEL_RANK[b.line.level] || a.i - b.i);
    for (const { line } of lines) {
      out.push({
        n: out.length + 1,
        lineId: line.id,
        chapterId: chapter.id,
        chapterTitle: chapter.title,
        title: line.title,
        level: line.level,
        moves: Math.ceil(line.moves.length / 2),
      });
    }
  }
  return out;
}

/**
 * Stars for a training run of a level: 3 — no mistakes and no hints,
 * 2 — at most one mistake or hint, 1 — the line was completed.
 */
export function starsForRun(mistakes: number, hints: number): Stars {
  const slips = mistakes + hints;
  return slips === 0 ? 3 : slips <= 1 ? 2 : 1;
}

/** Keep the best result. */
export function bestStars(prev: Stars | undefined, next: Stars): Stars {
  return Math.max(prev ?? 0, next) as Stars;
}

/**
 * How many levels are open: the first one always, then each level after one
 * with at least a star (like level maps in games).
 */
export function unlockedCount(
  levels: readonly CourseLevel[],
  starsOf: (lineId: string) => Stars,
): number {
  let n = levels.length ? 1 : 0;
  while (n < levels.length && starsOf(levels[n - 1]!.lineId) > 0) n++;
  return n;
}

/** Sum of stars and the maximum possible. */
export function starTotals(
  levels: readonly CourseLevel[],
  starsOf: (lineId: string) => Stars,
): { stars: number; max: number } {
  return {
    stars: levels.reduce((a, l) => a + starsOf(l.lineId), 0),
    max: levels.length * 3,
  };
}
