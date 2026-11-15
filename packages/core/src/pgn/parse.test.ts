import { parsePgn, pgnLeafPaths } from './parse';

const study = `[Event "London: Против ...d5"]
[ChapterName "Против ...d5"]

{ Главная схема. } 1. d4 d5 2. Bf4 { [%cal Gc1f4] Слон до e3. [%idea bf4-before-e3] } 2... Nf6 (2... c5 3. e3 $1 Nc6 (3... Qb6 4. Nc3!?) 4. Nf3) 3. e3 e6 *

[Event "London: Ловушки"]
[ChapterName "Ловушки"]

1. d4 Nf6 2. Bf4 c5 3. e3 Qb6 4. Nc3?? Qxb2 1-0
`;

describe('parsePgn', () => {
  const games = parsePgn(study);

  it('splits games and reads headers and results', () => {
    expect(games).toHaveLength(2);
    expect(games[0]!.headers.ChapterName).toBe('Против ...d5');
    expect(games[0]!.result).toBe('*');
    expect(games[1]!.result).toBe('1-0');
  });

  it('keeps the pre-game comment and move comments', () => {
    const g = games[0]!;
    expect(g.comments).toEqual(['Главная схема.']);
    const bf4 = g.children[0]!.children[0]!.children[0]!;
    expect(bf4.san).toBe('Bf4');
    expect(bf4.comments[0]).toContain('[%cal Gc1f4]');
  });

  it('builds variations as siblings', () => {
    const bf4 = games[0]!.children[0]!.children[0]!.children[0]!;
    expect(bf4.children.map((c) => c.san)).toEqual(['Nf6', 'c5']);
    const lines = pgnLeafPaths(games[0]!).map((p) => p.map((n) => n.san).join(' '));
    expect(lines).toEqual([
      'd4 d5 Bf4 Nf6 e3 e6',
      'd4 d5 Bf4 c5 e3 Nc6 Nf3',
      'd4 d5 Bf4 c5 e3 Qb6 Nc3',
    ]);
  });

  it('reads NAGs and suffix annotations', () => {
    const e3 = games[0]!.children[0]!.children[0]!.children[0]!.children[1]!.children[0]!;
    expect(e3.san).toBe('e3');
    expect(e3.nags).toEqual([1]);
    const nc3 = pgnLeafPaths(games[1]!)[0]![6]!;
    expect(nc3.san).toBe('Nc3');
    expect(nc3.nags).toEqual([4]);
  });

  it('handles move numbers glued to moves and CRLF', () => {
    const [g] = parsePgn('1.e4 e5 2.Nf3 2...Nc6\r\n3.Bb5 *');
    expect(pgnLeafPaths(g!)[0]!.map((n) => n.san)).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  it('supports a variation on the first move', () => {
    const [g] = parsePgn('1. d4 (1. Nf3) d5 *');
    expect(g!.children.map((c) => c.san)).toEqual(['d4', 'Nf3']);
    expect(g!.children[0]!.children[0]!.san).toBe('d5');
  });
});
