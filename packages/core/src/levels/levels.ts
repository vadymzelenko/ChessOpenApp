import { positionKey } from '../chess/position';
import type { IndexedLine, PackIndex } from '../pack/indexer';
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

/** Own moves a line needs to be a level when it ends by transposing into another one. */
const MIN_OWN_FOR_TRANSPOSITION = 4;

const LEVEL_RANK: Record<LineLevel, number> = { base: 0, advanced: 1, deep: 2 };

/**
 * Levels in learning order: chapters as in the course (most common replies
 * first), and inside a chapter the base lines before advanced and deep ones,
 * keeping the author's order otherwise. Lines without enough moves of their
 * own (move orders that transpose into another level) are not levels.
 */
export function courseLevels(index: PackIndex): CourseLevel[] {
  const ordered: IndexedLine[] = [];
  for (const chapter of index.pack.course.chapters) {
    const lines = chapter.lines
      .map((line, i) => ({ line, i }))
      .sort((a, b) => LEVEL_RANK[a.line.level] - LEVEL_RANK[b.line.level] || a.i - b.i);
    for (const { line } of lines) {
      const il = index.lines.get(line.id);
      if (il) ordered.push(il);
    }
  }
  // Every move order that reaches a position, to spot transpositions.
  const paths = new Map<string, Set<string>>();
  for (const il of ordered) {
    const moves: string[] = [];
    for (const s of il.steps) {
      moves.push(s.move.san);
      const k = positionKey(s.move.fenAfter);
      if (!paths.has(k)) paths.set(k, new Set());
      paths.get(k)!.add(moves.join(' '));
    }
  }
  const out: CourseLevel[] = [];
  const known = new Set<string>();
  for (const il of ordered) {
    let own = 0;
    for (const s of il.steps) {
      if (!s.ours) continue;
      const k = `${s.keyBefore} ${s.move.san}`;
      if (!known.has(k)) own++;
      known.add(k);
    }
    const last = il.steps[il.steps.length - 1];
    const transposes = !!last && (paths.get(positionKey(last.move.fenAfter))?.size ?? 0) > 1;
    // A level must teach something of its own: a line that only reaches
    // another level by a different move order stays in the tree, not on the map.
    if (own < 2 || (transposes && own < MIN_OWN_FOR_TRANSPOSITION)) continue;
    out.push({
      n: out.length + 1,
      lineId: il.line.id,
      chapterId: il.chapter.id,
      chapterTitle: il.chapter.title,
      title: il.line.title,
      level: il.line.level,
      moves: Math.ceil(il.steps.length / 2),
    });
  }
  return out;
}

/** The first level whose line passes through the position (for «continue in level N»). */
export function levelOfPosition(
  index: PackIndex,
  levels: readonly CourseLevel[],
  key: string,
): CourseLevel | undefined {
  return levels.find((l) =>
    index.lines
      .get(l.lineId)
      ?.steps.some((s) => s.keyBefore === key || positionKey(s.move.fenAfter) === key),
  );
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
