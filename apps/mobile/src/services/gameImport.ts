import { parseChessComArchive, parseLichessNdjson, type ImportedGame } from '@chess-open/core';

export type GameSource = 'lichess' | 'chesscom';

const NICK = /^[A-Za-z0-9_-]{2,30}$/;
export const isValidNick = (nick: string) => NICK.test(nick.trim());

/**
 * Downloads the user's recent games straight from the public Lichess /
 * Chess.com APIs (ТЗ module 34). Nothing is sent anywhere else.
 */
export async function fetchGames(
  source: GameSource,
  nick: string,
  max = 60,
): Promise<ImportedGame[]> {
  const name = nick.trim();
  if (!isValidNick(name)) throw new Error('nick');
  if (source === 'lichess') {
    const res = await fetch(
      `https://lichess.org/api/games/user/${encodeURIComponent(name)}?max=${max}&moves=true&tags=false&clocks=false&evals=false&opening=false&perfType=bullet,blitz,rapid,classical,correspondence`,
      { headers: { Accept: 'application/x-ndjson' } },
    );
    if (res.status === 404) throw new Error('notFound');
    if (!res.ok) throw new Error('network');
    return parseLichessNdjson(await res.text(), name);
  }
  const base = `https://api.chess.com/pub/player/${encodeURIComponent(name.toLowerCase())}`;
  const list = await fetch(`${base}/games/archives`);
  if (list.status === 404) throw new Error('notFound');
  if (!list.ok) throw new Error('network');
  const archives = ((await list.json()) as { archives?: string[] }).archives ?? [];
  const games: ImportedGame[] = [];
  // Newest months first until we have enough games.
  for (const url of archives.slice(-3).reverse()) {
    const res = await fetch(url);
    if (!res.ok) break;
    games.push(
      ...parseChessComArchive(await res.json(), name).sort((a, b) => b.playedAt - a.playedAt),
    );
    if (games.length >= max) break;
  }
  return games.slice(0, max);
}
