import { ChessGame } from '../chess/game';
import { samplePack } from './fixtures';
import { indexPack, lineCards } from './indexer';
import { validatePack } from './validate';

function index() {
  const v = validatePack(samplePack());
  if (!v.ok) throw new Error(v.errors.join('\n'));
  return indexPack(v.pack);
}

describe('indexPack', () => {
  it('indexes lines with steps and annotations', () => {
    const idx = index();
    const main = idx.lines.get('main')!;
    expect(main.chapter.id).toBe('vs-d5');
    expect(main.steps.map((s) => s.move.san)).toEqual(['d4', 'd5', 'Bf4', 'Nf6', 'e3']);
    expect(main.steps.map((s) => s.ours)).toEqual([true, false, true, false, true]);
    expect(main.steps[2]!.annotation?.ideas).toEqual(['bf4-before-e3']);
    expect(main.steps[2]!.fenBefore).toBe(ChessGame.fromSan(['d4', 'd5']).fen);
  });

  it('knows our move and the lines of each position', () => {
    const idx = index();
    const afterD5 = ChessGame.fromSan(['d4', 'd5']).key;
    expect(idx.ourMoves.get(afterD5)).toBe('Bf4');
    expect(idx.linesByPosition.get(afterD5)).toEqual(['main', 'c5']);
    expect(idx.ideas.get('bf4-before-e3')?.title.ru).toBe('Слон f4 до e3');
  });

  it('lists cards: our moves only', () => {
    const cards = lineCards(index().lines.get('c5')!);
    expect(cards.map((c) => c.move.san)).toEqual(['d4', 'Bf4', 'e3']);
  });
});
