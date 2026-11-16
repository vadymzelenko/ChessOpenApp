import { samplePack } from '../pack/fixtures';
import { indexPack } from '../pack/indexer';
import { validatePack } from '../pack/validate';
import {
  findDeviations,
  parseChessComArchive,
  parseLichessNdjson,
  type ImportedGame,
} from './games';

function index() {
  const v = validatePack(samplePack());
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return indexPack(v.pack);
}

const NDJSON = [
  JSON.stringify({
    id: 'a1',
    variant: 'standard',
    moves: 'd4 d5 Bf4 Nf6 Nf3',
    createdAt: 1,
    players: { white: { user: { name: 'Vadym' } }, black: { user: { name: 'x' } } },
  }),
  JSON.stringify({
    id: 'a2',
    variant: 'chess960',
    moves: 'e4 e5',
    players: { white: { user: { name: 'Vadym' } } },
  }),
  JSON.stringify({
    id: 'a3',
    variant: 'standard',
    moves: 'e4 e5',
    players: { white: { user: { name: 'x' } }, black: { user: { id: 'vadym' } } },
  }),
  'not json',
].join('\n');

describe('parseLichessNdjson', () => {
  it('keeps standard games of the user with their colour', () => {
    const games = parseLichessNdjson(NDJSON, 'vadym');
    expect(games.map((g) => [g.id, g.color, g.moves.length])).toEqual([
      ['lichess:a1', 'w', 5],
      ['lichess:a3', 'b', 2],
    ]);
    expect(games[0]!.url).toBe('https://lichess.org/a1');
  });
});

describe('parseChessComArchive', () => {
  it('reads PGNs and the user colour', () => {
    const archive = {
      games: [
        {
          url: 'https://www.chess.com/game/live/1',
          uuid: 'u1',
          rules: 'chess',
          end_time: 2,
          white: { username: 'Vadym' },
          black: { username: 'y' },
          pgn: '[Event "Live"]\n\n1. d4 d5 2. Bf4 c5 *',
        },
        { url: 'u2', rules: 'chess960', white: { username: 'Vadym' }, pgn: '1. e4 *' },
        {
          url: 'u3',
          rules: 'chess',
          white: { username: 'z' },
          black: { username: 'q' },
          pgn: '1. e4 *',
        },
      ],
    };
    const games = parseChessComArchive(archive, 'vadym');
    expect(games).toHaveLength(1);
    expect(games[0]).toMatchObject({
      id: 'chesscom:u1',
      color: 'w',
      moves: ['d4', 'd5', 'Bf4', 'c5'],
      playedAt: 2000,
    });
  });
});

describe('findDeviations', () => {
  const game = (moves: string[], color: 'w' | 'b' = 'w'): ImportedGame => ({
    id: moves.join(),
    url: '',
    color,
    moves,
    playedAt: 0,
  });

  it('finds the first move that left the repertoire', () => {
    const d = findDeviations(index(), [game(['d4', 'd5', 'Bf4', 'Nf6', 'Nf3'])]);
    expect(d).toHaveLength(1);
    expect(d[0]).toMatchObject({ ply: 5, played: 'Nf3', expected: 'e3' });
  });

  it('ignores games that follow the course, other colours and opponent deviations', () => {
    expect(findDeviations(index(), [game(['d4', 'd5', 'Bf4', 'Nf6', 'e3'])])).toEqual([]);
    expect(findDeviations(index(), [game(['d4', 'd5', 'Bf4', 'Nf6', 'Nf3'], 'b')])).toEqual([]);
    expect(findDeviations(index(), [game(['d4', 'e5', 'dxe5'])])).toEqual([]);
  });

  it('catches a deviation on the first move', () => {
    expect(findDeviations(index(), [game(['e4', 'e5'])])[0]).toMatchObject({
      ply: 1,
      played: 'e4',
      expected: 'd4',
    });
  });
});
