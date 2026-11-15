import { samplePack } from '../pack/fixtures';
import { validatePack } from '../pack/validate';
import { checkPackTexts, extractMoveMentions } from './check';

describe('extractMoveMentions', () => {
  it('finds unambiguous moves only', () => {
    expect(extractMoveMentions('Если …Qb6, то Qb3, а после 12.Bxf7+ Kxf7 — O-O.')).toEqual([
      'Qb6',
      'Qb3',
      'Bxf7',
      'Kxf7',
      'O-O',
    ]);
    expect(extractMoveMentions('Контроль над e4 и d5 важен.')).toEqual([]);
    expect(extractMoveMentions('После 3...e5 и exd5 белые лучше; e8=Q')).toEqual([
      'e5',
      'exd5',
      'e8=Q',
    ]);
  });
});

describe('checkPackTexts', () => {
  function pack(comment: string) {
    const p = samplePack();
    p.course.chapters[0]!.lines[0]!.annotations = { '3': { comment: { ru: comment } } };
    const v = validatePack(p);
    if (!v.ok) throw new Error(v.errors.join('\n'));
    return v.pack;
  }

  it('accepts moves that are legal around the commented move', () => {
    // After 1.d4 d5 2.Bf4: …Nf6 (black, next), Nf3 (white, as an alternative) and a sequence.
    expect(checkPackTexts(pack('Дальше …Nf6, а если …c5, то e3.'))).toEqual([]);
  });

  it('reports a move that cannot be played', () => {
    const issues = checkPackTexts(pack('Слон бьёт Bxh7.'));
    expect(issues).toHaveLength(1);
    expect(issues[0]!.message).toBe('mentions Bxh7, which is not a legal move here');
    expect(issues[0]!.where).toContain('ply 3');
  });
});
