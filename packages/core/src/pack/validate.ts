import { Chess } from 'chess.js';
import type { z } from 'zod';

import { ChessGame } from '../chess/game';
import { START_FEN, isValidFen, positionKey } from '../chess/position';
import { OpeningPackSchema, type MoveAnnotation, type OpeningPack } from './schema';

export type PackValidation =
  | { ok: true; pack: OpeningPack; warnings: string[] }
  | { ok: false; errors: string[]; warnings: string[] };

function formatPath(path: readonly PropertyKey[]): string {
  return path
    .map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`))
    .join('');
}

function zodErrors(error: z.ZodError): string[] {
  return error.issues.map((i) => `${formatPath(i.path) || '(root)'}: ${i.message}`);
}

/** Plays SAN moves; returns the game or an error naming the first bad move. */
function playLine(
  moves: readonly string[],
  startFen: string,
  where: string,
  errors: string[],
): ChessGame | null {
  const g = new ChessGame(startFen);
  for (let i = 0; i < moves.length; i++) {
    if (!g.play(moves[i]!)) {
      errors.push(
        `${where}.moves[${i}]: illegal move "${moves[i]}" at ply ${i + 1} (position ${g.fen})`,
      );
      return null;
    }
  }
  return g;
}

function isLegalUci(fen: string, uci: string): boolean {
  try {
    const c = new Chess(fen);
    c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
    return true;
  } catch {
    return false;
  }
}

/**
 * Full validation of an Opening Pack (ТЗ module 9): structure (schema) plus
 * chess rules — every move legal, every idea reference resolves, ids unique,
 * explorer keys normalised. Errors make the pack unusable; warnings do not.
 */
export function validatePack(input: unknown): PackValidation {
  const parsed = OpeningPackSchema.safeParse(input);
  if (!parsed.success) return { ok: false, errors: zodErrors(parsed.error), warnings: [] };
  const pack = parsed.data;
  const errors: string[] = [];
  const warnings: string[] = [];

  const startFen = pack.meta.startFen ?? START_FEN;
  if (!isValidFen(startFen)) {
    return { ok: false, errors: [`meta.startFen: invalid FEN "${startFen}"`], warnings };
  }

  // --- unique ids --------------------------------------------------------------
  const unique = (kind: string, ids: { id: string; where: string }[]) => {
    const seen = new Map<string, string>();
    for (const { id, where } of ids) {
      const prev = seen.get(id);
      if (prev) errors.push(`${where}.id: duplicate ${kind} id "${id}" (also at ${prev})`);
      else seen.set(id, where);
    }
  };
  unique(
    'idea',
    pack.ideas.map((x, i) => ({ id: x.id, where: `ideas[${i}]` })),
  );
  unique(
    'chapter',
    pack.course.chapters.map((x, i) => ({ id: x.id, where: `course.chapters[${i}]` })),
  );
  const allLines = pack.course.chapters.flatMap((c, ci) =>
    c.lines.map((l, li) => ({ line: l, where: `course.chapters[${ci}].lines[${li}]` })),
  );
  unique(
    'line',
    allLines.map(({ line, where }) => ({ id: line.id, where })),
  );
  unique(
    'trap',
    pack.traps.map((x, i) => ({ id: x.id, where: `traps[${i}]` })),
  );
  unique(
    'auto line',
    pack.autoLines.map((x, i) => ({ id: x.id, where: `autoLines[${i}]` })),
  );
  unique(
    'model game',
    pack.modelGames.map((x, i) => ({ id: x.id, where: `modelGames[${i}]` })),
  );

  const ideaIds = new Set(pack.ideas.map((i) => i.id));
  const lineIds = new Set(allLines.map((l) => l.line.id));

  const checkIdeas = (ids: readonly string[] | undefined, where: string) => {
    for (const id of ids ?? []) {
      if (!ideaIds.has(id)) errors.push(`${where}: unknown idea "${id}"`);
    }
  };
  const checkAnnotations = (
    annotations: Record<string, MoveAnnotation> | undefined,
    length: number,
    where: string,
  ) => {
    for (const [ply, a] of Object.entries(annotations ?? {})) {
      if (Number(ply) > length) {
        errors.push(
          `${where}.annotations.${ply}: ply ${ply} is beyond the ${length} moves of the line`,
        );
      }
      checkIdeas(a.ideas, `${where}.annotations.${ply}.ideas`);
    }
  };

  // --- ideas -----------------------------------------------------------------------
  pack.ideas.forEach((idea, i) => {
    if (idea.diagram && !isValidFen(idea.diagram.fen)) {
      errors.push(`ideas[${i}].diagram.fen: invalid FEN "${idea.diagram.fen}"`);
    }
  });

  // --- course lines ------------------------------------------------------------------
  const lineBySequence = new Map<string, string>();
  /** Our side's chosen move per position, to spot conflicting repertoire moves. */
  const repertoireMoves = new Map<string, { san: string; where: string }>();
  for (const { line, where } of allLines) {
    const g = playLine(line.moves, startFen, where, errors);
    checkAnnotations(line.annotations, line.moves.length, where);
    const seq = line.moves.join(' ');
    const dup = lineBySequence.get(seq);
    if (dup) errors.push(`${where}: same moves as ${dup}`);
    else lineBySequence.set(seq, where);
    if (!g) continue;
    // Walk the line and record our moves.
    const walk = new ChessGame(startFen);
    for (const san of line.moves) {
      const ours = walk.turn === pack.meta.side;
      const key = walk.key;
      const rec = walk.play(san)!;
      if (!ours) continue;
      const prev = repertoireMoves.get(key);
      if (prev && prev.san !== rec.san) {
        warnings.push(
          `${where}: plays ${rec.san} where ${prev.where} plays ${prev.san} — two repertoire moves in one position`,
        );
      } else if (!prev) repertoireMoves.set(key, { san: rec.san, where });
    }
  }

  // --- traps -----------------------------------------------------------------------------
  pack.traps.forEach((trap, i) => {
    const where = `traps[${i}]`;
    playLine(trap.moves, startFen, where, errors);
    if (trap.mistakePly > trap.moves.length) {
      errors.push(
        `${where}.mistakePly: ${trap.mistakePly} is beyond the ${trap.moves.length} moves`,
      );
    }
  });

  // --- auto lines --------------------------------------------------------------------------
  pack.autoLines.forEach((al, i) => {
    const where = `autoLines[${i}]`;
    playLine(al.moves, startFen, where, errors);
    if (al.fromLine && !lineIds.has(al.fromLine))
      errors.push(`${where}.fromLine: unknown line "${al.fromLine}"`);
    checkIdeas(al.ideas, `${where}.ideas`);
  });

  // --- model games -------------------------------------------------------------------------
  pack.modelGames.forEach((mg, i) => {
    const where = `modelGames[${i}]`;
    playLine(mg.moves, START_FEN, where, errors);
    checkAnnotations(mg.annotations, mg.moves.length, where);
  });

  // --- explorer & evals --------------------------------------------------------------------
  const checkKey = (key: string, where: string): string | null => {
    const fen = `${key} 0 1`;
    if (!isValidFen(fen)) {
      errors.push(`${where}: invalid position key "${key}"`);
      return null;
    }
    if (positionKey(fen) !== key) {
      errors.push(`${where}: position key is not normalised (expected "${positionKey(fen)}")`);
      return null;
    }
    return fen;
  };

  for (const [key, node] of Object.entries(pack.explorer)) {
    const where = `explorer["${key}"]`;
    const fen = checkKey(key, where);
    if (!fen) continue;
    const g = new ChessGame(fen);
    const legal = new Set(g.legalMoves().map((m) => m.san));
    node.moves.forEach((m, j) => {
      if (!legal.has(m.san)) errors.push(`${where}.moves[${j}]: illegal move "${m.san}"`);
    });
    if (node.moves.filter((m) => m.repertoire).length > 1) {
      warnings.push(`${where}: more than one repertoire move`);
    }
  }

  for (const [key, ev] of Object.entries(pack.evals)) {
    const where = `evals["${key}"]`;
    const fen = checkKey(key, where);
    if (fen && ev.best && !isLegalUci(fen, ev.best)) {
      errors.push(`${where}.best: illegal move "${ev.best}"`);
    }
  }

  // --- puzzles -------------------------------------------------------------------------------
  pack.puzzles.forEach((pz, i) => {
    const where = `puzzles[${i}]`;
    if (!isValidFen(pz.fen)) {
      errors.push(`${where}.fen: invalid FEN`);
      return;
    }
    const c = new Chess(pz.fen);
    for (let j = 0; j < pz.moves.length; j++) {
      const uci = pz.moves[j]!;
      try {
        c.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' });
      } catch {
        errors.push(`${where}.moves[${j}]: illegal move "${uci}"`);
        break;
      }
    }
  });

  return errors.length ? { ok: false, errors, warnings } : { ok: true, pack, warnings };
}
