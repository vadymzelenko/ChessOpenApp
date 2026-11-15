import { z } from 'zod';

import type { Square } from '../chess/position';

/**
 * Opening Pack format (ТЗ §3). One pack = one course; the app knows nothing
 * about specific openings. Structural rules live here (zod → TS types + JSON
 * Schema); chess rules (legal moves, references) are checked in validate.ts.
 */

export const PACK_FORMAT = 1;

const slug = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase slug like "london-bf4-first"');

/** Text in several languages; RU is the source language and is required (ТЗ §8). */
export const LocalizedTextSchema = z
  .object({ ru: z.string().min(1) })
  .catchall(z.string().min(1))
  .describe('Localized text; keys are language codes (ru, uk, pl, en)');

/** Who wrote/checked the content (ТЗ §8 «Конвейер написания»). Only `reviewed` gets ⭐. */
export const ContentStatusSchema = z.enum(['draft', 'engine-checked', 'reviewed']);

export const SideSchema = z.enum(['w', 'b']);
const square = z
  .string()
  .regex(/^[a-h][1-8]$/, 'must be a square like "e4"')
  .transform((v) => v as Square);
const annotationColor = z.enum(['green', 'red', 'blue', 'yellow']);

export const ArrowSchema = z.object({
  from: square,
  to: square,
  color: annotationColor.optional(),
});
export const HighlightSchema = z.object({ square, color: annotationColor.optional() });

/** FEN + drawings, used for idea diagrams. */
export const DiagramSchema = z.object({
  fen: z.string().min(1),
  arrows: z.array(ArrowSchema).optional(),
  highlights: z.array(HighlightSchema).optional(),
});

export const IdeaSchema = z.object({
  id: slug,
  title: LocalizedTextSchema,
  /** 3–8 sentences (ТЗ §8). */
  text: LocalizedTextSchema,
  diagram: DiagramSchema.optional(),
  tags: z.array(z.string()).optional(),
  status: ContentStatusSchema,
});

export const MoveAnnotationSchema = z.object({
  /** 1–2 sentences, answers «зачем». */
  comment: LocalizedTextSchema.optional(),
  arrows: z.array(ArrowSchema).optional(),
  highlights: z.array(HighlightSchema).optional(),
  /** References to ideas of this pack. */
  ideas: z.array(slug).optional(),
  trap: z.boolean().optional(),
});

export const LineLevelSchema = z.enum(['base', 'advanced', 'deep']);

export const LineSchema = z.object({
  id: slug,
  title: LocalizedTextSchema,
  level: LineLevelSchema,
  /** SAN moves from the pack start position. */
  moves: z.array(z.string().min(1)).min(1),
  /** Keyed by ply (1-based, as a string): annotation of the move at that ply. */
  annotations: z.record(z.string().regex(/^[1-9][0-9]*$/), MoveAnnotationSchema).optional(),
  status: ContentStatusSchema,
});

export const ChapterSchema = z.object({
  id: slug,
  title: LocalizedTextSchema,
  description: LocalizedTextSchema.optional(),
  lines: z.array(LineSchema).min(1),
});

export const TrapSchema = z.object({
  id: slug,
  title: LocalizedTextSchema,
  /** `for` — the opponent falls into it; `against` — don't fall into it yourself. */
  kind: z.enum(['for', 'against']),
  moves: z.array(z.string().min(1)).min(1),
  /** Ply of the mistake that springs the trap. */
  mistakePly: z.number().int().min(1),
  explanation: LocalizedTextSchema,
  status: ContentStatusSchema,
});

/** Win/draw/loss counts from White's point of view. */
export const WdlSchema = z.object({
  w: z.number().int().min(0),
  d: z.number().int().min(0),
  l: z.number().int().min(0),
});

/** Rating groups (ТЗ §5): до 1400, 1400–1800, 1800+. */
export const RatingGroupSchema = z.enum(['lt1400', '1400-1800', 'gt1800']);

export const ExplorerMoveSchema = z.object({
  san: z.string().min(1),
  stats: z.partialRecord(RatingGroupSchema, WdlSchema),
  /** This is the repertoire move in this position. */
  repertoire: z.boolean().optional(),
  /** Our move chosen by the pipeline (not by the course author) — shown with ⚙. */
  auto: z.boolean().optional(),
});

/** Keyed by positionKey (FEN without counters). */
export const ExplorerNodeSchema = z.object({
  moves: z.array(ExplorerMoveSchema).min(1),
  /** All games in the position (including moves not stored), for move shares and coverage. */
  total: z.number().int().min(0).optional(),
});

export const EvalSchema = z
  .object({
    /** Centipawns, White's point of view. */
    cp: z.number().int().optional(),
    mate: z.number().int().optional(),
    /** Best move in UCI. */
    best: z
      .string()
      .regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)
      .optional(),
    depth: z.number().int().min(1).optional(),
  })
  .refine((e) => e.cp !== undefined || e.mate !== undefined, 'eval needs cp or mate');

export const AutoLineSchema = z.object({
  id: slug,
  /** The hand-written line it continues. */
  fromLine: slug.optional(),
  moves: z.array(z.string().min(1)).min(1),
  ideas: z.array(slug).optional(),
});

export const PuzzleSchema = z.object({
  id: z.string().min(1),
  fen: z.string().min(1),
  /** UCI; the first move is the opponent's, as in the Lichess puzzle DB. */
  moves: z.array(z.string().regex(/^[a-h][1-8][a-h][1-8][qrbn]?$/)).min(2),
  rating: z.number().int(),
  themes: z.array(z.string()),
});

export const ModelGameSchema = z.object({
  id: slug,
  white: z.string().min(1),
  black: z.string().min(1),
  year: z.number().int().optional(),
  result: z.enum(['1-0', '0-1', '1/2-1/2', '*']),
  moves: z.array(z.string().min(1)).min(1),
  annotations: z.record(z.string().regex(/^[1-9][0-9]*$/), MoveAnnotationSchema).optional(),
  status: ContentStatusSchema,
});

export const PackMetaSchema = z.object({
  id: slug,
  format: z.literal(PACK_FORMAT),
  /** Increments with every published change; progress is tied to position keys, not versions. */
  packVersion: z.number().int().min(1),
  title: LocalizedTextSchema,
  description: LocalizedTextSchema,
  side: SideSchema,
  eco: z.array(z.string().regex(/^[A-E][0-9]{2}$/)).min(1),
  style: z.enum(['solid', 'aggressive', 'universal', 'gambit']),
  difficulty: z.number().int().min(1).max(5),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  /** Defaults to the standard start position. */
  startFen: z.string().optional(),
  /** Lichess puzzle opening tags for the puzzle pipeline, e.g. ["London_System"]. */
  puzzleTags: z.array(z.string().min(1)).optional(),
  /** Data sources and licences (ТЗ §12), shown on the «Лицензии» screen. */
  sources: z.array(z.string().min(1)),
});

export const OpeningPackSchema = z.object({
  meta: PackMetaSchema,
  ideas: z.array(IdeaSchema),
  course: z.object({ chapters: z.array(ChapterSchema).min(1) }),
  traps: z.array(TrapSchema).default([]),
  explorer: z.record(z.string(), ExplorerNodeSchema).default({}),
  autoLines: z.array(AutoLineSchema).default([]),
  evals: z.record(z.string(), EvalSchema).default({}),
  puzzles: z.array(PuzzleSchema).default([]),
  modelGames: z.array(ModelGameSchema).default([]),
});

export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
export type ContentStatus = z.infer<typeof ContentStatusSchema>;
export type PackArrow = z.infer<typeof ArrowSchema>;
export type PackHighlight = z.infer<typeof HighlightSchema>;
export type Idea = z.infer<typeof IdeaSchema>;
export type MoveAnnotation = z.infer<typeof MoveAnnotationSchema>;
export type LineLevel = z.infer<typeof LineLevelSchema>;
export type Line = z.infer<typeof LineSchema>;
export type Chapter = z.infer<typeof ChapterSchema>;
export type Trap = z.infer<typeof TrapSchema>;
export type Wdl = z.infer<typeof WdlSchema>;
export type RatingGroup = z.infer<typeof RatingGroupSchema>;
export type ExplorerMove = z.infer<typeof ExplorerMoveSchema>;
export type ExplorerNode = z.infer<typeof ExplorerNodeSchema>;
export type Eval = z.infer<typeof EvalSchema>;
export type AutoLine = z.infer<typeof AutoLineSchema>;
export type Puzzle = z.infer<typeof PuzzleSchema>;
export type ModelGame = z.infer<typeof ModelGameSchema>;
export type PackMeta = z.infer<typeof PackMetaSchema>;
/** A validated pack (defaults applied). */
export type OpeningPack = z.infer<typeof OpeningPackSchema>;
/** Pack as written in JSON (optional sections may be missing). */
export type OpeningPackInput = z.input<typeof OpeningPackSchema>;

/** JSON Schema of the pack format (for editors and external tools). */
export function packJsonSchema(): unknown {
  return z.toJSONSchema(OpeningPackSchema, { io: 'input', unrepresentable: 'any' });
}
