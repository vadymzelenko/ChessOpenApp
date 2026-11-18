import { samplePack } from './fixtures';
import { indexPack } from './indexer';
import { childrenAt, countOurMoves, repertoireTree } from './tree';
import { validatePack } from './validate';

describe('repertoireTree', () => {
  it('merges shared prefixes of lines', () => {
    const v = validatePack(samplePack());
    if (!v.ok) throw new Error(v.errors.join('\n'));
    const tree = repertoireTree(indexPack(v.pack));
    expect(tree.map((n) => n.san)).toEqual(['d4']);
    const bf4 = tree[0]!.children[0]!.children[0]!;
    expect(bf4.san).toBe('Bf4');
    expect(bf4.lineIds).toEqual(['main', 'c5']);
    expect(bf4.children.map((n) => n.san)).toEqual(['Nf6', 'c5']);
    expect(bf4.ours).toBe(true);
    // d4, Bf4, e3 (main), e3 (c5) — four distinct our-move nodes.
    expect(countOurMoves(tree)).toBe(4);
  });
});

describe('childrenAt', () => {
  it('follows a SAN path through the repertoire tree', () => {
    const v = validatePack(samplePack());
    if (!v.ok) throw new Error(v.errors.join('\n'));
    const roots = repertoireTree(indexPack(v.pack));
    expect(childrenAt(roots, [])).toBe(roots);
    expect(childrenAt(roots, ['d4'])!.map((n) => n.san)).toContain('d5');
    expect(childrenAt(roots, ['e4'])).toBeNull();
  });
});
