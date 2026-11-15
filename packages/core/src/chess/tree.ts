import { Chess, type Move as ChessJsMove } from 'chess.js';

import { toRecord, type GameStatus, type LegalMove, type MoveInput, type MoveRecord } from './game';
import {
  START_FEN,
  positionKey,
  type Color,
  type PlacedPiece,
  type PromotionPiece,
  type Square,
} from './position';

/** A position in the move tree. The root has no move. */
export interface TreeNode {
  readonly id: string;
  /** Half-moves from the start position (root = 0). */
  readonly ply: number;
  readonly move: MoveRecord | null;
  readonly fen: string;
  readonly key: string;
  parent: TreeNode | null;
  /** children[0] continues the main line of this branch; the rest are variations. */
  children: TreeNode[];
}

/**
 * Analysis tree with variations (ТЗ «Анализ / свободная доска»): playing a
 * move from any position never discards anything — it either follows an
 * existing branch or creates a new variation. Mutable; `version` increments
 * on every change.
 */
export class GameTree {
  readonly root: TreeNode;
  private currentNode: TreeNode;
  private nextId = 1;
  private _version = 0;
  private chessCache: { node: TreeNode; chess: Chess } | null = null;

  constructor(startFen: string = START_FEN) {
    const fen = new Chess(startFen).fen();
    this.root = {
      id: 'n0',
      ply: 0,
      move: null,
      fen,
      key: positionKey(fen),
      parent: null,
      children: [],
    };
    this.currentNode = this.root;
  }

  /** Main line from SAN moves. Throws on an illegal move. */
  static fromSan(moves: readonly string[], startFen: string = START_FEN): GameTree {
    const t = new GameTree(startFen);
    for (const san of moves) {
      if (!t.play(san)) throw new Error(`Illegal move "${san}" at ply ${t.current.ply + 1}`);
    }
    return t;
  }

  get version(): number {
    return this._version;
  }

  get current(): TreeNode {
    return this.currentNode;
  }

  get fen(): string {
    return this.currentNode.fen;
  }

  get key(): string {
    return this.currentNode.key;
  }

  get lastMove(): MoveRecord | null {
    return this.currentNode.move;
  }

  get turn(): Color {
    return this.chess().turn();
  }

  get inCheck(): boolean {
    return this.chess().inCheck();
  }

  get checkedKingSquare(): Square | null {
    const c = this.chess();
    if (!c.inCheck()) return null;
    return c.findPiece({ color: c.turn(), type: 'k' })[0] ?? null;
  }

  get status(): GameStatus {
    const c = this.chess();
    if (c.isCheckmate()) return 'checkmate';
    if (c.isStalemate()) return 'stalemate';
    if (c.isInsufficientMaterial()) return 'insufficient-material';
    if (c.isDrawByFiftyMoves()) return 'fifty-moves';
    let repeats = 0;
    for (const n of this.path(true)) if (n.key === this.currentNode.key) repeats++;
    if (repeats >= 3) return 'threefold-repetition';
    return 'playing';
  }

  /** Nodes from the root to the current node. */
  path(includeRoot = false): TreeNode[] {
    const out: TreeNode[] = [];
    for (let n: TreeNode | null = this.currentNode; n; n = n.parent) out.push(n);
    out.reverse();
    return includeRoot ? out : out.slice(1);
  }

  /** The main line from the root (children[0] all the way). */
  mainline(): TreeNode[] {
    const out: TreeNode[] = [];
    for (let n = this.root.children[0]; n; n = n.children[0]) out.push(n);
    return out;
  }

  /** True if the node lies on the main line. */
  isMainline(node: TreeNode): boolean {
    for (let n: TreeNode | null = node; n?.parent; n = n.parent) {
      if (n.parent.children[0] !== n) return false;
    }
    return true;
  }

  /** First node of the variation containing `node` (where it leaves its parent line), or null on the main line. */
  variationStart(node: TreeNode): TreeNode | null {
    for (let n: TreeNode | null = node; n?.parent; n = n.parent) {
      if (n.parent.children[0] !== n) return n;
    }
    return null;
  }

  pieces(): PlacedPiece[] {
    const out: PlacedPiece[] = [];
    for (const row of this.chess().board()) {
      for (const cell of row)
        if (cell) out.push({ square: cell.square, color: cell.color, type: cell.type });
    }
    return out;
  }

  legalMoves(from?: Square): LegalMove[] {
    const c = this.chess();
    const moves = from ? c.moves({ square: from, verbose: true }) : c.moves({ verbose: true });
    return moves.map((m) => {
      const lm: LegalMove = { from: m.from, to: m.to, san: m.san, capture: m.isCapture() };
      if (m.promotion) lm.promotion = m.promotion as PromotionPiece;
      return lm;
    });
  }

  destinations(from: Square): Square[] {
    return [...new Set(this.legalMoves(from).map((m) => m.to))];
  }

  isPromotion(from: Square, to: Square): boolean {
    return this.legalMoves(from).some((m) => m.to === to && m.promotion !== undefined);
  }

  /**
   * Play a move from the current node. Follows an existing child with the
   * same move, otherwise adds a new branch (the main line if it is the first
   * child). Returns the record, or null if illegal.
   */
  play(input: MoveInput | string): MoveRecord | null {
    const c = new Chess(this.currentNode.fen);
    let m: ChessJsMove;
    try {
      m =
        typeof input === 'string'
          ? c.move(input)
          : c.move({ from: input.from, to: input.to, promotion: input.promotion ?? 'q' });
    } catch {
      return null;
    }
    const existing = this.currentNode.children.find((ch) => ch.move?.uci === m.lan);
    if (existing) {
      this.setCurrent(existing);
      return existing.move;
    }
    const record = toRecord(m, this.currentNode.ply + 1, c);
    const node: TreeNode = {
      id: `n${this.nextId++}`,
      ply: record.ply,
      move: record,
      fen: record.fenAfter,
      key: record.keyAfter,
      parent: this.currentNode,
      children: [],
    };
    this.currentNode.children.push(node);
    this.setCurrent(node);
    return record;
  }

  goTo(node: TreeNode): void {
    this.setCurrent(node);
  }

  findById(id: string): TreeNode | null {
    const stack = [this.root];
    while (stack.length) {
      const n = stack.pop()!;
      if (n.id === id) return n;
      stack.push(...n.children);
    }
    return null;
  }

  back(): void {
    if (this.currentNode.parent) this.setCurrent(this.currentNode.parent);
  }

  /** Follow the main continuation of the current branch. */
  forward(): void {
    const next = this.currentNode.children[0];
    if (next) this.setCurrent(next);
  }

  toStart(): void {
    this.setCurrent(this.root);
  }

  /** End of the current branch. */
  toEnd(): void {
    let n = this.currentNode;
    while (n.children[0]) n = n.children[0];
    this.setCurrent(n);
  }

  /** Switch to the previous / next sibling variation of the current move (↑ / ↓). */
  switchSibling(delta: -1 | 1): void {
    const parent = this.currentNode.parent;
    if (!parent || parent.children.length < 2) return;
    const i = parent.children.indexOf(this.currentNode);
    const j = (i + delta + parent.children.length) % parent.children.length;
    this.setCurrent(parent.children[j]!);
  }

  /** Make the line through `node` the main line (at every fork up to the root). */
  promoteToMainline(node: TreeNode): void {
    let changed = false;
    for (let n: TreeNode | null = node; n?.parent; n = n.parent) {
      const siblings = n.parent.children;
      const i = siblings.indexOf(n);
      if (i > 0) {
        siblings.splice(i, 1);
        siblings.unshift(n);
        changed = true;
      }
    }
    if (changed) this.touch();
  }

  /** Delete `node` with everything after it. The current position moves up if it was inside. */
  deleteBranch(node: TreeNode): void {
    const parent = node.parent;
    if (!parent) return;
    parent.children = parent.children.filter((c) => c !== node);
    for (let n: TreeNode | null = this.currentNode; n; n = n.parent) {
      if (n === node) {
        this.currentNode = parent;
        break;
      }
    }
    this.touch();
  }

  /** PGN movetext with variations, e.g. "1. d4 d5 (1... Nf6 2. Bf4) 2. Bf4". */
  toPgn(): string {
    const startsBlack = this.root.fen.split(' ')[1] === 'b';
    const num = (ply: number) => {
      const p = ply + (startsBlack ? 1 : 0);
      return Math.ceil(p / 2);
    };
    const isWhitePly = (ply: number) => (ply + (startsBlack ? 1 : 0)) % 2 === 1;
    const out: string[] = [];

    const line = (first: TreeNode, forceNumber: boolean) => {
      let n: TreeNode | undefined = first;
      let needNumber = forceNumber;
      while (n) {
        const mv = n.move!;
        if (isWhitePly(n.ply)) out.push(`${num(n.ply)}. ${mv.san}`);
        else out.push(needNumber ? `${num(n.ply)}... ${mv.san}` : mv.san);
        needNumber = false;
        const siblings: TreeNode[] = n.parent!.children;
        if (siblings[0] === n && siblings.length > 1) {
          for (const v of siblings.slice(1)) {
            out.push('(');
            line(v, true);
            out.push(')');
          }
          needNumber = true;
        }
        n = n.children[0];
      }
    };
    if (this.root.children[0]) line(this.root.children[0], true);
    return out.join(' ').replace(/\( /g, '(').replace(/ \)/g, ')');
  }

  private chess(): Chess {
    if (this.chessCache?.node !== this.currentNode) {
      this.chessCache = { node: this.currentNode, chess: new Chess(this.currentNode.fen) };
    }
    return this.chessCache.chess;
  }

  private setCurrent(node: TreeNode): void {
    if (node === this.currentNode) return;
    this.currentNode = node;
    this.touch();
  }

  private touch(): void {
    this._version++;
  }
}
