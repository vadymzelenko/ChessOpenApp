import type { PackIndex } from './indexer';

/** A node of the repertoire tree (ТЗ §6 «Дерево репертуара»). */
export interface RepertoireNode {
  san: string;
  ply: number;
  /** Position key before this move (the card key when the move is ours). */
  keyBefore: string;
  ours: boolean;
  /** Lines passing through this move. */
  lineIds: string[];
  children: RepertoireNode[];
}

/**
 * Merge all course lines into one move tree (shared prefixes once).
 * Children keep the order in which lines appear in the course.
 */
export function repertoireTree(index: PackIndex): RepertoireNode[] {
  const roots: RepertoireNode[] = [];
  for (const [lineId, il] of index.lines) {
    let level = roots;
    for (const s of il.steps) {
      let node = level.find((n) => n.san === s.move.san);
      if (!node) {
        node = {
          san: s.move.san,
          ply: s.ply,
          keyBefore: s.keyBefore,
          ours: s.ours,
          lineIds: [],
          children: [],
        };
        level.push(node);
      }
      if (!node.lineIds.includes(lineId)) node.lineIds.push(lineId);
      level = node.children;
    }
  }
  return roots;
}

/** Count our moves (cards) in a subtree. */
export function countOurMoves(nodes: readonly RepertoireNode[]): number {
  let n = 0;
  for (const node of nodes) n += (node.ours ? 1 : 0) + countOurMoves(node.children);
  return n;
}

/** The children reachable after playing `path` (SAN) from the root; null if off the tree. */
export function childrenAt(
  roots: readonly RepertoireNode[],
  path: readonly string[],
): readonly RepertoireNode[] | null {
  let level: readonly RepertoireNode[] = roots;
  for (const san of path) {
    const node = level.find((n) => n.san === san);
    if (!node) return null;
    level = node.children;
  }
  return level;
}
