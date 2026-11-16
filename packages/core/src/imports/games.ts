import { Chess } from 'chess.js';

import { ChessGame } from '../chess/game';
import type { Color } from '../chess/position';
import type { PackIndex } from '../pack/indexer';

/** A game imported from Lichess or Chess.com (ТЗ module 34). */
export interface ImportedGame {
  id: string;
  url: string;
  /** The user's colour in this game. */
  color: Color;
  /** SAN moves from the standard start position. */
  moves: string[];
  /** Epoch ms (0 if unknown). */
  playedAt: number;
}

const lower = (s: unknown) => (typeof s === 'string' ? s.toLowerCase() : '');

/** Lichess `/api/games/user/{name}` NDJSON → games (standard chess from the start only). */
export function parseLichessNdjson(ndjson: string, username: string): ImportedGame[] {
  const me = username.toLowerCase();
  const out: ImportedGame[] = [];
  for (const line of ndjson.split('\n')) {
    if (!line.trim()) continue;
    let g: {
      id?: string;
      variant?: string;
      initialFen?: string;
      moves?: string;
      createdAt?: number;
      players?: {
        white?: { user?: { name?: string; id?: string } };
        black?: { user?: { name?: string; id?: string } };
      };
    };
    try {
      g = JSON.parse(line);
    } catch {
      continue;
    }
    if (!g.id || !g.moves || (g.variant && g.variant !== 'standard') || g.initialFen) continue;
    const white = g.players?.white?.user;
    const black = g.players?.black?.user;
    const color: Color | null =
      lower(white?.name) === me || lower(white?.id) === me
        ? 'w'
        : lower(black?.name) === me || lower(black?.id) === me
          ? 'b'
          : null;
    if (!color) continue;
    out.push({
      id: `lichess:${g.id}`,
      url: `https://lichess.org/${g.id}`,
      color,
      moves: g.moves.split(' ').filter(Boolean),
      playedAt: g.createdAt ?? 0,
    });
  }
  return out;
}

/** Chess.com monthly archive JSON (`{ games: [...] }`) → games. */
export function parseChessComArchive(json: unknown, username: string): ImportedGame[] {
  const me = username.toLowerCase();
  const games = (json as { games?: unknown[] })?.games ?? [];
  const out: ImportedGame[] = [];
  for (const raw of games) {
    const g = raw as {
      url?: string;
      uuid?: string;
      pgn?: string;
      rules?: string;
      end_time?: number;
      white?: { username?: string };
      black?: { username?: string };
    };
    if (!g.pgn || (g.rules && g.rules !== 'chess')) continue;
    const color: Color | null =
      lower(g.white?.username) === me ? 'w' : lower(g.black?.username) === me ? 'b' : null;
    if (!color) continue;
    const c = new Chess();
    try {
      c.loadPgn(g.pgn);
    } catch {
      continue;
    }
    if (c.getHeaders().SetUp === '1') continue;
    out.push({
      id: `chesscom:${g.uuid ?? g.url ?? out.length}`,
      url: g.url ?? '',
      color,
      moves: c.history(),
      playedAt: (g.end_time ?? 0) * 1000,
    });
  }
  return out;
}

/** Where a game left the repertoire. */
export interface Deviation {
  game: ImportedGame;
  /** 1-based ply of the user's move that differed from the course. */
  ply: number;
  /** Position key before the move — the card to review. */
  key: string;
  played: string;
  expected: string;
}

/**
 * The first move of the user that differs from the repertoire, in games
 * played with the course side (ТЗ module 34: «где ты отошёл от репертуара»).
 * Games where the opponent leaves the course first are skipped — that is
 * not the user's mistake.
 */
export function findDeviations(index: PackIndex, games: readonly ImportedGame[]): Deviation[] {
  const out: Deviation[] = [];
  for (const game of games) {
    if (game.color !== index.side) continue;
    const g = new ChessGame(index.startFen);
    for (let i = 0; i < game.moves.length; i++) {
      const key = g.key;
      const expected = index.ourMoves.get(key);
      const ours = g.turn === index.side;
      const rec = g.play(game.moves[i]!);
      if (!rec) break;
      if (ours) {
        if (!expected) break; // beyond the course
        if (rec.san !== expected) {
          out.push({ game, ply: i + 1, key, played: rec.san, expected });
          break;
        }
      } else if (!index.linesByPosition.has(g.key) && !index.ourMoves.has(g.key)) {
        break; // the opponent left the course
      }
    }
  }
  return out;
}
