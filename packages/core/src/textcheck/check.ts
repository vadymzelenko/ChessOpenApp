import { ChessGame } from '../chess/game';
import { START_FEN } from '../chess/position';
import type { LocalizedText, MoveAnnotation, OpeningPack } from '../pack/schema';

/**
 * Moves mentioned in a comment. Only unambiguous tokens count: with a piece
 * letter, a capture, castling, promotion, or a move number / ellipsis in front
 * («…Qb6», «12.Qb3», «Bxf7+», «O-O»). A bare square («контроль над e4») is not a move.
 */
export function extractMoveMentions(text: string): string[] {
  const re =
    /(?:\d+\s*\.(?:\s*\.\.)?\s*|…\s*|\.\.\.\s*)?(O-O-O|O-O|[KQRBN][a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?|[a-h]x[a-h][1-8](?:=[QRBN])?[+#]?|[a-h][1-8]=[QRBN][+#]?|[a-h][1-8][+#]?)(?![\w=])/g;
  const out: string[] = [];
  for (const m of text.matchAll(re)) {
    const full = m[0];
    const san = m[1]!;
    const numbered = full !== san; // had a move number or an ellipsis
    const bareSquare = /^[a-h][1-8][+#]?$/.test(san);
    if (bareSquare && !numbered) continue;
    out.push(san.replace(/[+#]$/, ''));
  }
  return out;
}

export interface TextIssue {
  where: string;
  message: string;
}

/**
 * A move mentioned in a comment should be playable around that moment of the
 * line: in the position before or after the commented move, or as a
 * continuation of the previous mention («если …Qb6, то Qb3»).
 */
function checkComment(
  text: string,
  before: string,
  after: string,
  where: string,
  issues: TextIssue[],
) {
  let chain: string[] = [before, after];
  for (const san of extractMoveMentions(text)) {
    let next: string[] = [];
    for (const fen of chain) {
      const g = new ChessGame(fen);
      const rec = g.play(san);
      if (rec) next.push(rec.fenAfter);
    }
    if (next.length === 0) {
      issues.push({ where, message: `mentions ${san}, which is not a legal move here` });
      next = [before, after];
    }
    // Following mentions may continue the sequence or refer to the line again.
    chain = [...next, before, after];
  }
}

function texts(t: LocalizedText | undefined): string[] {
  return t ? Object.values(t) : [];
}

/** Check every comment of the pack (ТЗ module 15, legality part). */
export function checkPackTexts(
  pack: Pick<OpeningPack, 'meta' | 'course' | 'traps' | 'modelGames'>,
): TextIssue[] {
  const issues: TextIssue[] = [];
  const start = pack.meta.startFen ?? START_FEN;
  const walk = (
    moves: readonly string[],
    annotations: Record<string, MoveAnnotation> | undefined,
    where: string,
    from = start,
  ) => {
    const g = new ChessGame(from);
    moves.forEach((san, i) => {
      const before = g.fen;
      if (!g.play(san)) return;
      const ann = annotations?.[String(i + 1)];
      for (const text of texts(ann?.comment))
        checkComment(text, before, g.fen, `${where} ply ${i + 1}`, issues);
    });
  };
  pack.course.chapters.forEach((c) =>
    c.lines.forEach((l) => walk(l.moves, l.annotations, `${c.id}/${l.id}`)),
  );
  pack.traps.forEach((t) => {
    const g = ChessGame.fromSan(t.moves.slice(0, t.mistakePly - 1), start);
    for (const text of texts(t.explanation)) {
      const after = ChessGame.fromSan(t.moves.slice(0, t.mistakePly), start).fen;
      checkComment(text, g.fen, after, `trap ${t.id}`, issues);
    }
  });
  pack.modelGames.forEach((mg) => walk(mg.moves, mg.annotations, `game ${mg.id}`, START_FEN));
  return issues;
}
