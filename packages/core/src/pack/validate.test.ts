import { positionKey, START_FEN } from '../chess/position';
import { samplePack } from './fixtures';
import { packJsonSchema } from './schema';
import { validatePack } from './validate';

function expectError(input: unknown, fragment: string | RegExp) {
  const r = validatePack(input);
  expect(r.ok).toBe(false);
  if (!r.ok) expect(r.errors.join('\n')).toMatch(fragment);
}

describe('validatePack', () => {
  it('accepts a valid pack and fills defaults', () => {
    const r = validatePack(samplePack());
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.pack.traps).toEqual([]);
      expect(r.pack.explorer).toEqual({});
      expect(r.warnings).toEqual([]);
    }
  });

  it('rejects structural problems with a path', () => {
    const p = samplePack() as Record<string, unknown>;
    delete p.meta;
    expectError(p, /^meta: /m);

    const q = samplePack();
    q.meta.side = 'x' as 'w';
    expectError(q, 'meta.side');

    const r = samplePack();
    r.course.chapters[0]!.lines[0]!.title = { en: 'no russian' } as never;
    expectError(r, 'course.chapters[0].lines[0].title.ru');
  });

  it('rejects an illegal move and names it', () => {
    const p = samplePack();
    p.course.chapters[0]!.lines[1]!.moves = ['d4', 'd5', 'Bf4', 'c5', 'e3', 'Nc6', 'Bf4'];
    expectError(p, /lines\[1\]\.moves\[6\]: illegal move "Bf4" at ply 7/);
  });

  it('rejects unknown idea references', () => {
    const p = samplePack();
    p.course.chapters[0]!.lines[0]!.annotations!['3']!.ideas = ['no-such-idea'];
    expectError(p, 'unknown idea "no-such-idea"');
  });

  it('rejects annotations beyond the line', () => {
    const p = samplePack();
    p.course.chapters[0]!.lines[0]!.annotations!['9'] = { trap: true };
    expectError(p, 'ply 9 is beyond the 5 moves');
  });

  it('rejects duplicate ids and duplicate lines', () => {
    const p = samplePack();
    p.course.chapters[0]!.lines[1]!.id = 'main';
    expectError(p, 'duplicate line id "main"');

    const q = samplePack();
    q.course.chapters[0]!.lines[1]!.moves = ['d4', 'd5', 'Bf4', 'Nf6', 'e3'];
    expectError(q, 'same moves as course.chapters[0].lines[0]');
  });

  it('warns about two repertoire moves in one position', () => {
    const p = samplePack();
    p.course.chapters[0]!.lines[1]!.moves = ['d4', 'd5', 'Nf3'];
    const r = validatePack(p);
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch('plays Nf3 where course.chapters[0].lines[0] plays Bf4');
  });

  it('checks traps, auto lines and model games', () => {
    const p = samplePack();
    p.traps = [
      {
        id: 't1',
        title: { ru: 'Ловушка' },
        kind: 'for',
        moves: ['d4', 'd5'],
        mistakePly: 5,
        explanation: { ru: '…' },
        status: 'draft',
      },
    ];
    expectError(p, 'traps[0].mistakePly');

    const q = samplePack();
    q.autoLines = [{ id: 'a1', fromLine: 'nope', moves: ['d4'] }];
    expectError(q, 'autoLines[0].fromLine: unknown line "nope"');

    const r = samplePack();
    r.modelGames = [
      { id: 'g1', white: 'A', black: 'B', result: '1-0', moves: ['e4', 'e4'], status: 'draft' },
    ];
    expectError(r, 'modelGames[0].moves[1]: illegal move');
  });

  it('validates explorer and eval keys', () => {
    const key = positionKey(START_FEN);
    const ok = samplePack();
    ok.explorer = {
      [key]: { moves: [{ san: 'd4', stats: { lt1400: { w: 5, d: 1, l: 4 } }, repertoire: true }] },
    };
    ok.evals = { [key]: { cp: 20, best: 'd2d4', depth: 30 } };
    expect(validatePack(ok).ok).toBe(true);

    const badMove = samplePack();
    badMove.explorer = { [key]: { moves: [{ san: 'Nf6', stats: {} }] } };
    expectError(badMove, 'illegal move "Nf6"');

    const notNormalised = samplePack();
    notNormalised.explorer = { [`${key.slice(0, -1)}e3`]: { moves: [{ san: 'd4', stats: {} }] } };
    expectError(notNormalised, /invalid position key|not normalised/);

    const badEval = samplePack();
    badEval.evals = { [key]: { cp: 10, best: 'e2e5' } };
    expectError(badEval, 'best: illegal move "e2e5"');

    const noScore = samplePack();
    noScore.evals = { [key]: { depth: 10 } };
    expectError(noScore, 'eval needs cp or mate');
  });

  it('validates puzzles', () => {
    const p = samplePack();
    p.puzzles = [
      { id: 'p1', fen: START_FEN, moves: ['e2e4', 'e7e5', 'e4e5'], rating: 1500, themes: [] },
    ];
    expectError(p, 'puzzles[0].moves[2]: illegal move "e4e5"');
  });
});

describe('packJsonSchema', () => {
  it('produces a JSON Schema with the top-level sections', () => {
    const schema = packJsonSchema() as { properties: Record<string, unknown>; required: string[] };
    expect(Object.keys(schema.properties)).toEqual(
      expect.arrayContaining(['meta', 'ideas', 'course', 'explorer', 'evals', 'puzzles']),
    );
    expect(schema.required).toEqual(expect.arrayContaining(['meta', 'ideas', 'course']));
    expect(schema.required).not.toContain('explorer');
  });
});
