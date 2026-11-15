import { samplePack } from '../pack/fixtures';
import { validatePack } from '../pack/validate';
import { PackBuildError, buildPackFromPgn, parseComment, slugify } from './toPack';

const meta = samplePack().meta;
const ideas = samplePack().ideas;

const PGN = `[Event "Пример: Против ...d5"]
[ChapterName "Против ...d5"]

{ Главная схема Лондона. }
1. d4 d5 2. Bf4 { [%cal Gc1f4] [%csl Rd5] Слон выходит до e3. [%idea bf4-before-e3] [%status reviewed] }
2... Nf6 (2... c5 3. e3 { [%level advanced] } Nc6 4. Nf3) 3. e3 e6 *

[Event "Пример: Ловушки"]
[ChapterName "Ловушки"]

1. d4 d5 2. Bf4 c5 3. e3 Qb6 4. Nc3 { [%trap against] Пешка b2 висит. } 4... Qxb2 *

[Event "Пример: Партия"]
[ChapterName "Партия: образец"]
[White "Карлсен"]
[Black "Соперник"]
[Date "2020.01.01"]

1. d4 d5 2. Bf4 { План с e3 и c3. } Nf6 1-0
`;

describe('parseComment', () => {
  it('extracts commands and leaves the text', () => {
    const errors: string[] = [];
    const c = parseComment(
      '[%cal Gc1f4,Re7e5] Текст [%csl Yd4] [%idea a,b c] [%level deep] [%trap] [%clk 0:05:00]',
      'x',
      errors,
    );
    expect(errors).toEqual([]);
    expect(c.text).toBe('Текст');
    expect(c.arrows).toEqual([
      { from: 'c1', to: 'f4', color: 'green' },
      { from: 'e7', to: 'e5', color: 'red' },
    ]);
    expect(c.highlights).toEqual([{ square: 'd4', color: 'yellow' }]);
    expect(c.ideas).toEqual(['a', 'b', 'c']);
    expect(c.level).toBe('deep');
    expect(c.trap).toBe('for');
  });

  it('reports bad commands', () => {
    const errors: string[] = [];
    parseComment('[%level expert] [%cal Xc1f4] [%status done]', 'here', errors);
    expect(errors).toHaveLength(3);
    expect(errors.join('\n')).toMatch(/^here: bad arrow/m);
  });
});

describe('slugify', () => {
  it('transliterates Russian', () => {
    expect(slugify('Против ...d5')).toBe('protiv-d5');
    expect(slugify('Ловушки!')).toBe('lovushki');
  });
});

describe('buildPackFromPgn', () => {
  const { pack, warnings } = buildPackFromPgn({ meta, ideas, pgn: PGN });

  it('produces a valid pack', () => {
    const r = validatePack(pack);
    if (!r.ok) throw new Error(r.errors.join('\n'));
    expect(warnings).toEqual([]);
  });

  it('turns every leaf into a line with inherited level and status', () => {
    const ch = pack.course.chapters[0]!;
    expect(ch.id).toBe('protiv-d5');
    expect(ch.description).toEqual({ ru: 'Главная схема Лондона.' });
    expect(ch.lines.map((l) => l.moves.join(' '))).toEqual([
      'd4 d5 Bf4 Nf6 e3 e6',
      'd4 d5 Bf4 c5 e3 Nc6 Nf3',
    ]);
    expect(ch.lines.map((l) => l.level)).toEqual(['base', 'advanced']);
    expect(ch.lines.map((l) => l.status)).toEqual(['reviewed', 'reviewed']);
    expect(ch.lines[1]!.title.ru).toBe('3. e3 3... Nc6 4. Nf3');
  });

  it('keeps arrows, highlights, ideas and comments on the right ply', () => {
    const ann = pack.course.chapters[0]!.lines[0]!.annotations!['3']!;
    expect(ann.comment).toEqual({ ru: 'Слон выходит до e3.' });
    expect(ann.arrows).toEqual([{ from: 'c1', to: 'f4', color: 'green' }]);
    expect(ann.highlights).toEqual([{ square: 'd5', color: 'red' }]);
    expect(ann.ideas).toEqual(['bf4-before-e3']);
  });

  it('builds traps and model games from special chapters', () => {
    expect(pack.traps).toHaveLength(1);
    const trap = pack.traps![0]!;
    expect(trap.kind).toBe('against');
    expect(trap.mistakePly).toBe(7);
    expect(trap.explanation.ru).toBe('Пешка b2 висит.');
    expect(pack.modelGames![0]).toMatchObject({ white: 'Карлсен', year: 2020, result: '1-0' });
  });

  it('line ids are stable across builds', () => {
    const again = buildPackFromPgn({ meta, ideas, pgn: PGN }).pack;
    expect(again.course.chapters[0]!.lines.map((l) => l.id)).toEqual(
      pack.course.chapters[0]!.lines.map((l) => l.id),
    );
  });

  it('fails with a clear error on an illegal move', () => {
    expect(() =>
      buildPackFromPgn({ meta, ideas, pgn: '[ChapterName "X"]\n1. d4 d5 2. Bf5 *' }),
    ).toThrow(PackBuildError);
    try {
      buildPackFromPgn({ meta, ideas, pgn: '[ChapterName "X"]\n1. d4 d5 2. Bf5 *' });
    } catch (e) {
      expect((e as PackBuildError).errors[0]).toBe(
        'chapter 1 «X», line 1: illegal move "Bf5" at ply 3 after d4 d5',
      );
    }
  });

  it('requires a [%trap] marker in trap chapters', () => {
    expect(() =>
      buildPackFromPgn({ meta, ideas, pgn: '[ChapterName "Ловушки"]\n1. e4 e5 *' }),
    ).toThrow(/without a \[%trap\] move/);
  });
});
