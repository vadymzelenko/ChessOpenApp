/**
 * Explorer pipeline (ТЗ §5 «Вариант B», modules 11 + 13): statistics of real
 * Lichess games by rating group → packs/<id>/explorer.json + coverage report.
 *
 *   npm run pack:explorer -- <id> [--max 3000] [--min-prob 0.001] [--min-games 50]
 *
 * Needs network access to explorer.lichess.ovh (runs in GitHub Actions:
 * .github/workflows/explorer.yml). Set LICHESS_TOKEN if the API asks for auth.
 * Responses are cached in .cache/explorer so an interrupted run can resume.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import {
  PackBuildError,
  buildExplorer,
  buildPackFromPgn,
  coverageReport,
  repertoireFromPack,
  validatePack,
  type MoveStats,
  type RatingGroup,
} from '@chess-open/core';

const ROOT = resolve(__dirname, '..', '..');
const CACHE = join(ROOT, '.cache', 'explorer');

/** Lichess rating buckets for our three groups. */
const GROUP_RATINGS: Record<RatingGroup, string> = {
  lt1400: '0,1000,1200',
  '1400-1800': '1400,1600',
  gt1800: '1800,2000,2200,2500',
};

interface LichessMove {
  san: string;
  white: number;
  draws: number;
  black: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let requests = 0;

async function fetchGroup(fen: string, group: RatingGroup): Promise<LichessMove[]> {
  const url =
    'https://explorer.lichess.ovh/lichess?variant=standard&speeds=blitz,rapid,classical' +
    `&ratings=${GROUP_RATINGS[group]}&moves=12&topGames=0&recentGames=0&fen=${encodeURIComponent(fen)}`;
  const cacheFile = join(CACHE, `${createHash('sha1').update(url).digest('hex')}.json`);
  if (existsSync(cacheFile)) return JSON.parse(readFileSync(cacheFile, 'utf8')) as LichessMove[];

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.LICHESS_TOKEN) headers.Authorization = `Bearer ${process.env.LICHESS_TOKEN}`;
  for (let attempt = 0; ; attempt++) {
    requests++;
    const res = await fetch(url, { headers });
    if (res.status === 429) {
      // Lichess asks clients to wait a full minute after a 429.
      console.log('  … rate limited, waiting 60 s');
      await sleep(60_000);
      continue;
    }
    if (!res.ok) {
      if (attempt < 3) {
        await sleep(2000 * (attempt + 1));
        continue;
      }
      throw new Error(`Explorer API ${res.status}: ${await res.text()}`);
    }
    const body = (await res.json()) as { moves: LichessMove[] };
    const moves = body.moves.map(({ san, white, draws, black }) => ({ san, white, draws, black }));
    mkdirSync(CACHE, { recursive: true });
    writeFileSync(cacheFile, JSON.stringify(moves));
    await sleep(350); // be gentle with a free service
    return moves;
  }
}

async function fetchPosition(fen: string): Promise<MoveStats[]> {
  const bySan = new Map<string, MoveStats>();
  for (const group of Object.keys(GROUP_RATINGS) as RatingGroup[]) {
    for (const m of await fetchGroup(fen, group)) {
      let entry = bySan.get(m.san);
      if (!entry) bySan.set(m.san, (entry = { san: m.san, stats: {} }));
      entry.stats[group] = { w: m.white, d: m.draws, l: m.black };
    }
  }
  return [...bySan.values()];
}

function arg(name: string, fallback: number): number {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? Number(process.argv[i + 1]) : fallback;
}

async function main() {
  const id = process.argv[2];
  if (!id || id.startsWith('--')) {
    console.error('usage: pack:explorer -- <id> [--max 3000] [--min-prob 0.001] [--min-games 50]');
    process.exit(2);
  }
  const dir = join(ROOT, 'packs', id);
  const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8'));
  const ideasPath = join(dir, 'ideas.json');
  const ideas = existsSync(ideasPath) ? JSON.parse(readFileSync(ideasPath, 'utf8')) : [];
  const { readdirSync } = await import('node:fs');
  const pgn = readdirSync(dir)
    .filter((f) => f.endsWith('.pgn'))
    .map((f) => readFileSync(join(dir, f), 'utf8'))
    .join('\n\n');

  let pack;
  try {
    const built = buildPackFromPgn({ meta, ideas, pgn });
    const v = validatePack(built.pack);
    if (!v.ok) throw new PackBuildError(v.errors);
    pack = v.pack;
  } catch (e) {
    if (e instanceof PackBuildError) e.errors.forEach((x) => console.error(`✗ ${x}`));
    process.exit(1);
  }

  const rep = repertoireFromPack(pack);
  console.log(`▶ ${id}: ${rep.ours.size} repertoire positions`);
  const result = await buildExplorer(fetchPosition, {
    side: pack.meta.side,
    ...(pack.meta.startFen ? { startFen: pack.meta.startFen } : {}),
    ours: rep.ours,
    forced: rep.forced,
    minProbability: arg('min-prob', 0.001),
    minGames: arg('min-games', 50),
    maxPositions: arg('max', 3000),
  });

  const out = join(dir, 'explorer.json');
  writeFileSync(out, JSON.stringify(result.nodes));
  const cov = coverageReport(result.nodes, rep.ours, pack.meta.side);
  const pct = (x: number) => `${(x * 100).toFixed(1)} %`;
  const report = [
    `# Explorer report: ${id}`,
    '',
    `Positions: ${Object.keys(result.nodes).length}, fetched ${result.fetched}, API requests ${requests}, max depth ${result.maxPly} plies.`,
    '',
    '## Coverage (games staying in the repertoire)',
    '',
    ...Object.entries(cov).map(([n, c]) => `- до ${n}-го хода: **${pct(c)}**`),
    '',
    '## Top-20 holes (write these lines first)',
    '',
    '| # | Probability | Position after |',
    '| - | - | - |',
    ...result.holes
      .slice(0, 20)
      .map((h, i) => `| ${i + 1} | ${pct(h.probability)} | ${h.path.join(' ')} |`),
    '',
  ].join('\n');
  writeFileSync(join(dir, 'explorer-report.md'), report);
  console.log(report);
  console.log(`→ ${out}`);
}

void main();
