import type { Puzzle } from '../pack/schema';

/** One row of the Lichess puzzle database (lichess_db_puzzle.csv, CC0). */
export interface PuzzleRow extends Puzzle {
  popularity: number;
  plays: number;
  openingTags: string[];
}

/**
 * Parse a CSV line: PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,
 * NbPlays,Themes,GameUrl,OpeningTags. Returns null for the header / bad rows.
 */
export function parsePuzzleCsvLine(line: string): PuzzleRow | null {
  const f = line.split(',');
  if (f.length < 9 || f[0] === 'PuzzleId') return null;
  const rating = Number(f[3]);
  const popularity = Number(f[5]);
  const plays = Number(f[6]);
  if (!f[1] || !f[2] || !Number.isFinite(rating)) return null;
  return {
    id: f[0]!,
    fen: f[1],
    moves: f[2].split(' '),
    rating,
    themes: (f[7] ?? '').split(' ').filter(Boolean),
    popularity,
    plays,
    openingTags: (f[9] ?? '').trim().split(' ').filter(Boolean),
  };
}

export interface PuzzleSelectOptions {
  /** Lichess opening tags; a puzzle matches if any of its tags equals or starts with one. */
  tags: readonly string[];
  minRating?: number;
  maxRating?: number;
  minPopularity?: number;
  minPlays?: number;
  /** How many to keep (ТЗ: 300+ per pack). */
  limit?: number;
  /** Width of rating bands used to spread the selection evenly. */
  band?: number;
}

export function matchesTags(row: Pick<PuzzleRow, 'openingTags'>, tags: readonly string[]): boolean {
  return row.openingTags.some((t) => tags.some((want) => t === want || t.startsWith(`${want}_`)));
}

/** Is the row worth keeping at all (tags, rating range, quality)? */
export function acceptPuzzle(row: PuzzleRow, o: PuzzleSelectOptions): boolean {
  return (
    matchesTags(row, o.tags) &&
    row.rating >= (o.minRating ?? 600) &&
    row.rating <= (o.maxRating ?? 2200) &&
    row.popularity >= (o.minPopularity ?? 80) &&
    row.plays >= (o.minPlays ?? 300)
  );
}

/**
 * Pick the best puzzles, spread over rating bands (round-robin across bands,
 * best first within a band — quality = popularity × log(plays)).
 */
export function selectPuzzles(rows: readonly PuzzleRow[], o: PuzzleSelectOptions): Puzzle[] {
  const band = o.band ?? 200;
  const limit = o.limit ?? 400;
  const quality = (r: PuzzleRow) => r.popularity * Math.log10(r.plays + 10);
  const bands = new Map<number, PuzzleRow[]>();
  for (const r of rows) {
    if (!acceptPuzzle(r, o)) continue;
    const b = Math.floor(r.rating / band);
    let list = bands.get(b);
    if (!list) bands.set(b, (list = []));
    list.push(r);
  }
  const lists = [...bands.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, l]) => l.sort((x, y) => quality(y) - quality(x)));
  const out: Puzzle[] = [];
  for (let i = 0; out.length < limit; i++) {
    let added = false;
    for (const l of lists) {
      const r = l[i];
      if (!r) continue;
      out.push({ id: r.id, fen: r.fen, moves: r.moves, rating: r.rating, themes: r.themes });
      added = true;
      if (out.length >= limit) break;
    }
    if (!added) break;
  }
  return out.sort((a, b) => a.rating - b.rating);
}
