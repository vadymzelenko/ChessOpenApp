/**
 * PGN parser that keeps the whole move tree: variations, comments and NAGs
 * (chess.js keeps only the main line). Moves are not validated here — the
 * converter replays them with ChessGame.
 */

export interface PgnNode {
  san: string;
  /** Comments placed after this move. */
  comments: string[];
  /** Numeric annotation glyphs ($1, or !, ?, !? … converted to numbers). */
  nags: number[];
  /** children[0] is the main continuation, the rest are variations. */
  children: PgnNode[];
}

export interface PgnGame {
  headers: Record<string, string>;
  /** Comments before the first move. */
  comments: string[];
  /** First moves: [0] main line, rest are alternative first moves. */
  children: PgnNode[];
  result: string;
}

const SUFFIX_NAGS: Record<string, number> = { '!': 1, '?': 2, '!!': 3, '??': 4, '!?': 5, '?!': 6 };
const RESULTS = new Set(['1-0', '0-1', '1/2-1/2', '*']);

type Token =
  | { t: 'header'; key: string; value: string }
  | { t: 'comment'; text: string }
  | { t: 'open' }
  | { t: 'close' }
  | { t: 'nag'; n: number }
  | { t: 'result'; value: string }
  | { t: 'move'; san: string };

function tokenize(text: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = text.length;
  while (i < n) {
    const c = text[i]!;
    if (/\s/.test(c)) {
      i++;
    } else if (c === '[') {
      const end = text.indexOf(']', i);
      const m = /^\[\s*(\w+)\s+"((?:[^"\\]|\\.)*)"\s*\]$/.exec(text.slice(i, end + 1));
      if (m) out.push({ t: 'header', key: m[1]!, value: m[2]!.replace(/\\(.)/g, '$1') });
      i = end < 0 ? n : end + 1;
    } else if (c === '{') {
      const end = text.indexOf('}', i);
      out.push({ t: 'comment', text: text.slice(i + 1, end < 0 ? n : end).trim() });
      i = end < 0 ? n : end + 1;
    } else if (c === ';') {
      const end = text.indexOf('\n', i);
      out.push({ t: 'comment', text: text.slice(i + 1, end < 0 ? n : end).trim() });
      i = end < 0 ? n : end + 1;
    } else if (c === '(') {
      out.push({ t: 'open' });
      i++;
    } else if (c === ')') {
      out.push({ t: 'close' });
      i++;
    } else if (c === '$') {
      const m = /^\$(\d+)/.exec(text.slice(i));
      if (m) out.push({ t: 'nag', n: Number(m[1]) });
      i += m ? m[0].length : 1;
    } else {
      const m = /^[^\s{}()[\];$]+/.exec(text.slice(i))!;
      let word = m[0];
      i += word.length;
      if (RESULTS.has(word)) {
        out.push({ t: 'result', value: word });
        continue;
      }
      // Strip move numbers: "12." / "12..." / "12...Nf6".
      word = word.replace(/^\d+\.+/, '');
      if (!word) continue;
      const suffix = /(!!|\?\?|!\?|\?!|!|\?)$/.exec(word);
      if (suffix) word = word.slice(0, -suffix[0].length);
      if (word) out.push({ t: 'move', san: word });
      if (suffix) out.push({ t: 'nag', n: SUFFIX_NAGS[suffix[0]]! });
    }
  }
  return out;
}

/** Split a multi-game PGN (e.g. a Lichess study export) into games. */
export function parsePgn(text: string): PgnGame[] {
  const tokens = tokenize(text.replace(/\r\n?/g, '\n'));
  const games: PgnGame[] = [];
  let i = 0;

  while (i < tokens.length) {
    const game: PgnGame = { headers: {}, comments: [], children: [], result: '*' };
    while (i < tokens.length && tokens[i]!.t === 'header') {
      const h = tokens[i] as Extract<Token, { t: 'header' }>;
      game.headers[h.key] = h.value;
      i++;
    }

    // Each frame is a list of siblings we append to + the node new moves follow.
    // `parentChildren` is where the next move goes; `last` is the last move played.
    interface Frame {
      parentChildren: PgnNode[];
      last: PgnNode | null;
      /** Where a variation opened at this level attaches (siblings of `last`). */
      prevSiblings: PgnNode[] | null;
    }
    const stack: Frame[] = [];
    let frame: Frame = { parentChildren: game.children, last: null, prevSiblings: null };
    let sawMove = false;

    for (; i < tokens.length; i++) {
      const tok = tokens[i]!;
      if (tok.t === 'header') break; // next game
      if (tok.t === 'result') {
        game.result = tok.value;
        i++;
        break;
      }
      switch (tok.t) {
        case 'move': {
          const node: PgnNode = { san: tok.san, comments: [], nags: [], children: [] };
          frame.parentChildren.push(node);
          frame.prevSiblings = frame.parentChildren;
          frame.parentChildren = node.children;
          frame.last = node;
          sawMove = true;
          break;
        }
        case 'comment':
          if (frame.last) frame.last.comments.push(tok.text);
          else if (stack.length === 0) game.comments.push(tok.text);
          break;
        case 'nag':
          frame.last?.nags.push(tok.n);
          break;
        case 'open': {
          // A variation is an alternative to the last move: same parent.
          stack.push(frame);
          frame = {
            parentChildren: frame.prevSiblings ?? game.children,
            last: null,
            prevSiblings: null,
          };
          break;
        }
        case 'close':
          frame = stack.pop() ?? frame;
          break;
      }
    }
    if (sawMove || Object.keys(game.headers).length > 0 || game.comments.length > 0)
      games.push(game);
  }
  return games;
}

/** All root-to-leaf paths of a game tree. */
export function pgnLeafPaths(game: PgnGame): PgnNode[][] {
  const out: PgnNode[][] = [];
  const walk = (nodes: PgnNode[], path: PgnNode[]) => {
    for (const node of nodes) {
      const next = [...path, node];
      if (node.children.length === 0) out.push(next);
      else walk(node.children, next);
    }
  };
  walk(game.children, []);
  return out;
}
