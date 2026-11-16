/** Deterministic PRNG (mulberry32) so exams are reproducible in tests. */
export function seededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Pick up to `count` lines in random order (ТЗ §6 «Экзамен: 10–20 случайных линий главы»). */
export function pickExamLines(
  lineIds: readonly string[],
  count: number,
  random: () => number = Math.random,
): string[] {
  const a = [...lineIds];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a.slice(0, Math.max(0, count));
}

export interface ExamLineResult {
  lineId: string;
  mistakes: number;
}

export const EXAM_PASS_SCORE = 0.85;

/** Score = share of lines played without a mistake; ≥ 85 % earns a medal. */
export function examResult(results: readonly ExamLineResult[]): {
  score: number;
  passed: boolean;
  failed: string[];
} {
  const clean = results.filter((r) => r.mistakes === 0).length;
  const score = results.length ? clean / results.length : 0;
  return {
    score,
    passed: results.length > 0 && score >= EXAM_PASS_SCORE,
    failed: results.filter((r) => r.mistakes > 0).map((r) => r.lineId),
  };
}
