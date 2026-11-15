import { ChessGame } from '../chess/game';
import { START_FEN } from '../chess/position';
import type {
  ContentStatus,
  LineLevel,
  MoveAnnotation,
  OpeningPackInput,
  PackArrow,
  PackHighlight,
} from '../pack/schema';
import { parsePgn, pgnLeafPaths, type PgnGame, type PgnNode } from './parse';

/**
 * PGN (Lichess study export) → Opening Pack course (ТЗ §3 «Формат авторского
 * исходника», module 10).
 *
 * Every chapter (PGN game) becomes a course chapter; every root-to-leaf path
 * becomes a line. Comments may contain commands:
 *   [%cal Gc1f4,Rd8d4]   arrows (Lichess)      [%csl Gd4]        highlights (Lichess)
 *   [%idea id1,id2]      idea references        [%level advanced] line level (base|advanced|deep)
 *   [%trap] / [%trap against]  marks the trap move    [%status reviewed] draft|engine-checked|reviewed
 *   [%line some-id]      explicit line id       [%title …]        line / trap title
 * Level, status, id and title apply to every line passing through the move;
 * the deepest one wins.
 *
 * Chapters named «Ловушки…» / «Traps…» produce traps; «Партия…» / «Game…»
 * produce model games (main line only).
 */

export interface PackSources {
  meta: OpeningPackInput['meta'];
  ideas: OpeningPackInput['ideas'];
  /** Text of one or more PGN files. */
  pgn: string;
}

export class PackBuildError extends Error {
  constructor(readonly errors: string[]) {
    super(`Pack build failed:\n${errors.join('\n')}`);
  }
}

interface ParsedComment {
  text: string;
  arrows: PackArrow[];
  highlights: PackHighlight[];
  ideas: string[];
  level?: LineLevel;
  status?: ContentStatus;
  trap?: 'for' | 'against';
  lineId?: string;
  title?: string;
}

const COLORS: Record<string, PackArrow['color']> = {
  G: 'green',
  R: 'red',
  B: 'blue',
  Y: 'yellow',
};
const LEVELS: readonly LineLevel[] = ['base', 'advanced', 'deep'];
const STATUSES: readonly ContentStatus[] = ['draft', 'engine-checked', 'reviewed'];

/** Parse the [%…] commands of a comment; `where` is used in error messages. */
export function parseComment(raw: string, where: string, errors: string[]): ParsedComment {
  const out: ParsedComment = { text: '', arrows: [], highlights: [], ideas: [] };
  const text = raw.replace(/\[%(\w+)\s*([^\]]*)\]/g, (_m, cmd: string, argRaw: string) => {
    const arg = argRaw.trim();
    switch (cmd) {
      case 'cal':
        for (const a of arg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)) {
          const m = /^([GRBY])([a-h][1-8])([a-h][1-8])$/.exec(a);
          if (m)
            out.arrows.push({
              from: m[2]! as PackArrow['from'],
              to: m[3]! as PackArrow['to'],
              color: COLORS[m[1]!],
            });
          else errors.push(`${where}: bad arrow "${a}" in [%cal]`);
        }
        break;
      case 'csl':
        for (const a of arg
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)) {
          const m = /^([GRBY])([a-h][1-8])$/.exec(a);
          if (m)
            out.highlights.push({ square: m[2]! as PackHighlight['square'], color: COLORS[m[1]!] });
          else errors.push(`${where}: bad square "${a}" in [%csl]`);
        }
        break;
      case 'idea':
        out.ideas.push(...arg.split(/[\s,]+/).filter(Boolean));
        break;
      case 'level':
        if ((LEVELS as readonly string[]).includes(arg)) out.level = arg as LineLevel;
        else errors.push(`${where}: unknown level "${arg}" (use ${LEVELS.join(' | ')})`);
        break;
      case 'status':
        if ((STATUSES as readonly string[]).includes(arg)) out.status = arg as ContentStatus;
        else errors.push(`${where}: unknown status "${arg}" (use ${STATUSES.join(' | ')})`);
        break;
      case 'trap':
        if (arg === '' || arg === 'for') out.trap = 'for';
        else if (arg === 'against') out.trap = 'against';
        else errors.push(`${where}: [%trap] takes "for" or "against", got "${arg}"`);
        break;
      case 'line':
        out.lineId = arg;
        break;
      case 'title':
        out.title = arg;
        break;
      default:
        // Other Lichess commands (%clk, %eval, …) are ignored.
        break;
    }
    return ' ';
  });
  out.text = text.replace(/\s+/g, ' ').trim();
  return out;
}

const TRANSLIT: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
};

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .split('')
    .map((c) => TRANSLIT[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** FNV-1a 32-bit → 7 hex chars: short, stable ids from move sequences. */
function shortHash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0').slice(0, 7);
}

function chapterTitle(game: PgnGame, index: number): string {
  if (game.headers.ChapterName) return game.headers.ChapterName;
  const ev = game.headers.Event ?? '';
  const colon = ev.indexOf(':');
  return (colon >= 0 ? ev.slice(colon + 1) : ev).trim() || `Глава ${index + 1}`;
}

type ChapterKind = 'course' | 'traps' | 'games';
function chapterKind(title: string): ChapterKind {
  if (/^(ловушк|пастк|pułapk|trap)/i.test(title)) return 'traps';
  if (/^(партия|партія|partia|game|model)/i.test(title)) return 'games';
  return 'course';
}

/** "4. Nf3" / "3... Nc6" for the move at a 1-based ply (from the standard start). */
function numbered(san: string, ply: number, startsWithBlack: boolean): string {
  const p = ply + (startsWithBlack ? 1 : 0);
  const n = Math.ceil(p / 2);
  return p % 2 === 1 ? `${n}. ${san}` : `${n}... ${san}`;
}

interface PathInfo {
  sans: string[];
  annotations: Record<string, MoveAnnotation>;
  level: LineLevel;
  status: ContentStatus;
  lineId?: string;
  title?: string;
  trapPly?: number;
  trapKind?: 'for' | 'against';
  /** Comment text from the trap move onwards (the explanation). */
  trapText: string[];
}

function readPath(
  path: PgnNode[],
  startFen: string,
  where: string,
  errors: string[],
): PathInfo | null {
  const game = new ChessGame(startFen);
  const info: PathInfo = {
    sans: [],
    annotations: {},
    level: 'base',
    status: 'draft',
    trapText: [],
  };
  for (let i = 0; i < path.length; i++) {
    const node = path[i]!;
    const ply = i + 1;
    const rec = game.play(node.san);
    if (!rec) {
      errors.push(
        `${where}: illegal move "${node.san}" at ply ${ply} after ${info.sans.join(' ') || 'start'}`,
      );
      return null;
    }
    info.sans.push(rec.san);
    const parsed = node.comments.map((c) => parseComment(c, `${where} ply ${ply}`, errors));
    const ann: MoveAnnotation = {};
    const text = parsed
      .map((p) => p.text)
      .filter(Boolean)
      .join(' ');
    if (text) ann.comment = { ru: text };
    const arrows = parsed.flatMap((p) => p.arrows);
    if (arrows.length) ann.arrows = arrows;
    const highlights = parsed.flatMap((p) => p.highlights);
    if (highlights.length) ann.highlights = highlights;
    const ideas = [...new Set(parsed.flatMap((p) => p.ideas))];
    if (ideas.length) ann.ideas = ideas;
    for (const p of parsed) {
      if (p.level) info.level = p.level;
      if (p.status) info.status = p.status;
      if (p.lineId) info.lineId = p.lineId;
      if (p.title) info.title = p.title;
      if (p.trap && info.trapPly === undefined) {
        info.trapPly = ply;
        info.trapKind = p.trap;
        ann.trap = true;
      }
    }
    if (info.trapPly !== undefined && text) info.trapText.push(text);
    if (Object.keys(ann).length) info.annotations[String(ply)] = ann;
  }
  return info;
}

/** Build the pack (course, traps, model games) from PGN sources. Throws PackBuildError. */
export function buildPackFromPgn(src: PackSources): { pack: OpeningPackInput; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const startFen = src.meta.startFen ?? START_FEN;
  const startsWithBlack = startFen.split(' ')[1] === 'b';
  const games = parsePgn(src.pgn);
  if (games.length === 0) throw new PackBuildError(['PGN contains no games']);

  const pack: OpeningPackInput = {
    meta: src.meta,
    ideas: src.ideas,
    course: { chapters: [] },
    traps: [],
    modelGames: [],
  };
  const usedChapterIds = new Set<string>();

  games.forEach((game, gi) => {
    const title = chapterTitle(game, gi);
    const where = `chapter ${gi + 1} «${title}»`;
    const kind = chapterKind(title);
    const paths = pgnLeafPaths(game);
    if (paths.length === 0) {
      warnings.push(`${where}: no moves, skipped`);
      return;
    }

    if (kind === 'games') {
      const main: PgnNode[] = [];
      for (let n = game.children[0]; n; n = n.children[0]) main.push(n);
      const info = readPath(main, START_FEN, where, errors);
      if (!info) return;
      const year = /^(\d{4})/.exec(game.headers.Date ?? '')?.[1];
      const result = game.result as '1-0' | '0-1' | '1/2-1/2' | '*';
      pack.modelGames!.push({
        id: game.headers.GameId ?? (slugify(title) || `game-${gi + 1}`),
        white: game.headers.White ?? '?',
        black: game.headers.Black ?? '?',
        ...(year ? { year: Number(year) } : {}),
        result,
        moves: info.sans,
        ...(Object.keys(info.annotations).length ? { annotations: info.annotations } : {}),
        status: info.status,
      });
      return;
    }

    if (kind === 'traps') {
      paths.forEach((path, pi) => {
        const lw = `${where}, line ${pi + 1}`;
        const info = readPath(path, startFen, lw, errors);
        if (!info) return;
        if (info.trapPly === undefined) {
          errors.push(`${lw}: trap line without a [%trap] move`);
          return;
        }
        if (info.trapText.length === 0) {
          errors.push(`${lw}: trap has no explanation (comment on/after the [%trap] move)`);
          return;
        }
        pack.traps!.push({
          id: info.lineId ?? `trap-${shortHash(info.sans.join(' '))}`,
          title: {
            ru:
              info.title ??
              `${title}: ${numbered(info.sans[info.trapPly - 1]!, info.trapPly, startsWithBlack)}`,
          },
          kind: info.trapKind!,
          moves: info.sans,
          mistakePly: info.trapPly,
          explanation: { ru: info.trapText.join(' ') },
          status: info.status,
        });
      });
      return;
    }

    let chapterId = game.headers.ChapterId ?? (slugify(title) || `chapter-${gi + 1}`);
    if (usedChapterIds.has(chapterId)) chapterId = `${chapterId}-${gi + 1}`;
    usedChapterIds.add(chapterId);

    const lines = paths
      .map((path, pi) => {
        const info = readPath(path, startFen, `${where}, line ${pi + 1}`, errors);
        if (!info) return null;
        const tail = info.sans
          .slice(-3)
          .map((s, k) =>
            numbered(s, info.sans.length - Math.min(3, info.sans.length) + k + 1, startsWithBlack),
          )
          .join(' ');
        return {
          id: info.lineId ?? `${chapterId}-${shortHash(info.sans.join(' '))}`,
          title: { ru: info.title ?? tail },
          level: info.level,
          moves: info.sans,
          ...(Object.keys(info.annotations).length ? { annotations: info.annotations } : {}),
          status: info.status,
        };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);

    const description = game.comments
      .map((c) => parseComment(c, where, errors).text)
      .filter(Boolean)
      .join(' ');
    pack.course.chapters.push({
      id: chapterId,
      title: { ru: title },
      ...(description ? { description: { ru: description } } : {}),
      lines,
    });
  });

  if (errors.length) throw new PackBuildError(errors);
  return { pack, warnings };
}
