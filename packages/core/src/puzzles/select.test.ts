import { acceptPuzzle, parsePuzzleCsvLine, selectPuzzles, type PuzzleRow } from './select';

const LINE =
  '00sHx,q3k1nr/1pp1nQpp/3p4/1P2p3/4P3/B1PP1b2/B5PP/5K2 b k - 0 17,e8d7 a2e6 d7d8 f7f8,1760,80,83,72,mate mateIn2 middlegame short,https://lichess.org/yyznGmXs/black#34,Italian_Game Italian_Game_Classical_Variation';

const row = (
  id: string,
  rating: number,
  popularity = 90,
  plays = 1000,
  tags = ['London_System'],
): PuzzleRow => ({
  id,
  fen: '8/8/8/8/8/8/8/8 w - - 0 1',
  moves: ['a1a2', 'a2a3'],
  rating,
  themes: [],
  popularity,
  plays,
  openingTags: tags,
});

describe('parsePuzzleCsvLine', () => {
  it('parses a Lichess puzzle row', () => {
    const r = parsePuzzleCsvLine(LINE)!;
    expect(r.id).toBe('00sHx');
    expect(r.moves).toEqual(['e8d7', 'a2e6', 'd7d8', 'f7f8']);
    expect(r.rating).toBe(1760);
    expect(r.popularity).toBe(83);
    expect(r.plays).toBe(72);
    expect(r.themes).toContain('mateIn2');
    expect(r.openingTags).toEqual(['Italian_Game', 'Italian_Game_Classical_Variation']);
  });

  it('skips the header and broken lines', () => {
    expect(
      parsePuzzleCsvLine(
        'PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags',
      ),
    ).toBeNull();
    expect(parsePuzzleCsvLine('garbage')).toBeNull();
  });
});

describe('selectPuzzles', () => {
  it('filters by tag prefix, rating and quality', () => {
    const o = { tags: ['Italian_Game'] };
    expect(acceptPuzzle({ ...parsePuzzleCsvLine(LINE)!, plays: 500 }, o)).toBe(true);
    expect(acceptPuzzle(row('a', 1500), o)).toBe(false); // other opening
    expect(acceptPuzzle(row('b', 1500, 50, 1000, ['Italian_Game']), o)).toBe(false); // unpopular
    expect(acceptPuzzle(row('c', 3000, 90, 1000, ['Italian_Game']), o)).toBe(false); // too hard
    expect(acceptPuzzle(row('d', 1500, 90, 1000, ['Italian_Game_Two_Knights']), o)).toBe(true);
    expect(acceptPuzzle(row('e', 1500, 90, 1000, ['Italian_GameX']), o)).toBe(false);
  });

  it('spreads the selection over rating bands and sorts by rating', () => {
    const rows = [
      ...Array.from({ length: 10 }, (_, i) => row(`easy${i}`, 800 + i, 90 - i)),
      row('mid', 1300),
      row('hard', 1900),
    ];
    const picked = selectPuzzles(rows, { tags: ['London_System'], limit: 3 });
    expect(picked.map((p) => p.id)).toEqual(['easy0', 'mid', 'hard']);
  });
});
