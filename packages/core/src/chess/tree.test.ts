import { START_FEN } from './position';
import { GameTree } from './tree';

const sans = (nodes: { move: { san: string } | null }[]) => nodes.map((n) => n.move!.san);

describe('GameTree', () => {
  it('plays a main line', () => {
    const t = GameTree.fromSan(['d4', 'd5', 'Bf4']);
    expect(sans(t.mainline())).toEqual(['d4', 'd5', 'Bf4']);
    expect(t.current.ply).toBe(3);
    expect(t.turn).toBe('b');
    expect(t.lastMove?.san).toBe('Bf4');
  });

  it('creates a variation when playing from an earlier position', () => {
    const t = GameTree.fromSan(['d4', 'd5', 'Bf4']);
    t.back(); // after 1...d5
    t.play('c4');
    expect(sans(t.mainline())).toEqual(['d4', 'd5', 'Bf4']);
    expect(t.current.move?.san).toBe('c4');
    expect(t.isMainline(t.current)).toBe(false);
    expect(t.current.parent!.children.map((c) => c.move!.san)).toEqual(['Bf4', 'c4']);
    expect(t.variationStart(t.current)).toBe(t.current);
  });

  it('follows an existing branch instead of duplicating it', () => {
    const t = GameTree.fromSan(['d4', 'd5']);
    t.toStart();
    const v = t.version;
    expect(t.play('d4')?.san).toBe('d4');
    expect(t.root.children).toHaveLength(1);
    expect(t.version).toBe(v + 1);
  });

  it('rejects illegal moves', () => {
    const t = new GameTree();
    expect(t.play('e5')).toBeNull();
    expect(t.play({ from: 'e2', to: 'e5' })).toBeNull();
    expect(t.root.children).toHaveLength(0);
  });

  it('navigates back, forward, start and end of the current branch', () => {
    const t = GameTree.fromSan(['e4', 'e5', 'Nf3']);
    t.back();
    t.back();
    t.play('c5'); // variation 1...c5
    t.play('Nf3');
    t.toStart();
    expect(t.fen).toBe(new GameTree(START_FEN).fen);
    t.forward();
    t.forward();
    expect(t.current.move?.san).toBe('e5'); // main line
    t.back();
    t.goTo(t.current.children[1]!); // c5
    t.toEnd();
    expect(sans(t.path())).toEqual(['e4', 'c5', 'Nf3']);
  });

  it('switches between sibling variations', () => {
    const t = GameTree.fromSan(['e4']);
    t.toStart();
    t.play('d4');
    t.toStart();
    t.play('c4');
    t.switchSibling(-1);
    expect(t.current.move?.san).toBe('d4');
    t.switchSibling(1);
    t.switchSibling(1);
    expect(t.current.move?.san).toBe('e4');
  });

  it('promotes a variation to the main line', () => {
    const t = GameTree.fromSan(['d4', 'd5', 'Bf4', 'Nf6']);
    t.goTo(t.mainline()[1]!);
    t.play('c4');
    t.play('e6');
    const deep = t.current;
    t.promoteToMainline(deep);
    expect(sans(t.mainline())).toEqual(['d4', 'd5', 'c4', 'e6']);
    expect(t.isMainline(deep)).toBe(true);
  });

  it('deletes a branch and moves the cursor out of it', () => {
    const t = GameTree.fromSan(['d4', 'd5', 'Bf4']);
    t.back();
    t.play('c4');
    t.play('e6');
    const start = t.variationStart(t.current)!;
    t.deleteBranch(start);
    expect(t.current.move?.san).toBe('d5');
    expect(t.current.children.map((c) => c.move!.san)).toEqual(['Bf4']);
  });

  it('detects threefold repetition along the current path', () => {
    const t = GameTree.fromSan(['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1', 'Ng8']);
    expect(t.status).toBe('threefold-repetition');
    t.back();
    expect(t.status).toBe('playing');
  });

  it('exports PGN with variations', () => {
    const t = GameTree.fromSan(['d4', 'd5', 'Bf4', 'Nf6']);
    t.goTo(t.mainline()[0]!);
    t.play('Nf6');
    t.play('Bf4');
    t.goTo(t.mainline()[2]!);
    t.play('c5');
    expect(t.toPgn()).toBe('1. d4 d5 (1... Nf6 2. Bf4) 2. Bf4 Nf6 (2... c5)');
  });

  it('finds nodes by id and exposes board helpers', () => {
    const t = GameTree.fromSan(['e4', 'd5']);
    expect(t.findById(t.current.id)).toBe(t.current);
    expect(t.findById('nope')).toBeNull();
    expect(t.destinations('e4').sort()).toEqual(['d5', 'e5']);
    expect(t.pieces()).toHaveLength(32);
    t.play('exd5');
    expect(t.pieces()).toHaveLength(31);
  });
});
