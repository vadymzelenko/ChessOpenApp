import {
  bestStars,
  dayKey,
  newCard,
  review,
  starsForRun,
  type Rating,
  type SrsCard,
  type Stars,
} from '@chess-open/core';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { kvStorage } from '@/services/kvStorage';

/**
 * Learning progress (ТЗ §11 / module 17). Cards are keyed by pack + position
 * key — not by line numbers — so pack updates keep the progress (ТЗ §3).
 */
export const cardId = (packId: string, positionKey: string) => `${packId}|${positionKey}`;
export const lineKey = (packId: string, lineId: string) => `${packId}|${lineId}`;

export interface LineProgress {
  /** Epoch ms when the line was studied (walked through with comments). */
  studied?: number;
  /** Epoch ms of the last training run without mistakes. */
  cleanRun?: number;
  runs?: number;
  /** Best result of the level (training run): 1–3 stars. */
  stars?: Stars;
}

export interface Medal {
  score: number;
  at: number;
}

/** A line the user added to their own repertoire (ТЗ §4 «Личный репертуар»). */
export interface CustomLine {
  id: string;
  moves: string[];
  createdAt: number;
}

interface ProgressState {
  cards: Record<string, SrsCard>;
  /** Personal lines by pack id. */
  custom: Record<string, CustomLine[]>;
  /** Puzzle results by `${packId}|${puzzleId}`. */
  puzzles: Record<string, { ok: boolean; at: number }>;
  /** Exam medals by `${packId}|${chapterId}` (best passing score). */
  medals: Record<string, Medal>;
  lines: Record<string, LineProgress>;
  xp: number;
  activeDays: string[];
  gradeCard: (packId: string, positionKey: string, rating: Rating, now?: number) => void;
  markStudied: (packId: string, lineId: string, now?: number) => void;
  /** Records a completed training run; returns the stars of this run. */
  finishRun: (
    packId: string,
    lineId: string,
    mistakes: number,
    hints: number,
    now?: number,
  ) => Stars;
  addXp: (amount: number, now?: number) => void;
  saveExam: (
    packId: string,
    chapterId: string,
    score: number,
    passed: boolean,
    now?: number,
  ) => void;
  addCustomLine: (packId: string, moves: string[], now?: number) => void;
  savePuzzle: (packId: string, puzzleId: string, ok: boolean, now?: number) => void;
  removeCustomLine: (packId: string, id: string) => void;
  reset: () => void;
}

const touchDay = (days: string[], now: number) => {
  const d = dayKey(now);
  return days.includes(d) ? days : [...days.slice(-400), d];
};

export const useProgress = create<ProgressState>()(
  persist(
    (set) => ({
      cards: {},
      custom: {},
      puzzles: {},
      medals: {},
      lines: {},
      xp: 0,
      activeDays: [],
      gradeCard: (packId, key, rating, now = Date.now()) =>
        set((s) => {
          const id = cardId(packId, key);
          const card = s.cards[id] ?? newCard(now);
          return {
            cards: { ...s.cards, [id]: review(card, rating, now) },
            activeDays: touchDay(s.activeDays, now),
          };
        }),
      markStudied: (packId, lineId, now = Date.now()) =>
        set((s) => {
          const k = lineKey(packId, lineId);
          return {
            lines: { ...s.lines, [k]: { ...s.lines[k], studied: now } },
            activeDays: touchDay(s.activeDays, now),
          };
        }),
      finishRun: (packId, lineId, mistakes, hints, now = Date.now()) => {
        const stars = starsForRun(mistakes, hints);
        set((s) => {
          const k = lineKey(packId, lineId);
          const prev = s.lines[k] ?? {};
          return {
            lines: {
              ...s.lines,
              [k]: {
                ...prev,
                runs: (prev.runs ?? 0) + 1,
                stars: bestStars(prev.stars, stars),
                ...(mistakes === 0 ? { cleanRun: now } : {}),
              },
            },
            activeDays: touchDay(s.activeDays, now),
          };
        });
        return stars;
      },
      addXp: (amount, now = Date.now()) =>
        set((s) => ({ xp: s.xp + amount, activeDays: touchDay(s.activeDays, now) })),
      saveExam: (packId, chapterId, score, passed, now = Date.now()) =>
        set((s) => {
          const k = lineKey(packId, chapterId);
          const prev = s.medals[k];
          const medals =
            passed && (!prev || score > prev.score)
              ? { ...s.medals, [k]: { score, at: now } }
              : s.medals;
          return { medals, activeDays: touchDay(s.activeDays, now) };
        }),
      addCustomLine: (packId, moves, now = Date.now()) =>
        set((s) => {
          const list = s.custom[packId] ?? [];
          if (list.some((l) => l.moves.join(' ') === moves.join(' '))) return {};
          return {
            custom: {
              ...s.custom,
              [packId]: [...list, { id: `my-${now.toString(36)}`, moves, createdAt: now }],
            },
          };
        }),
      savePuzzle: (packId, puzzleId, ok, now = Date.now()) =>
        set((s) => {
          const k = lineKey(packId, puzzleId);
          // A first failure stays recorded; a later success does not erase it.
          const prev = s.puzzles[k];
          return {
            puzzles: { ...s.puzzles, [k]: { ok: prev ? prev.ok && ok : ok, at: now } },
            activeDays: touchDay(s.activeDays, now),
          };
        }),
      removeCustomLine: (packId, id) =>
        set((s) => ({
          custom: { ...s.custom, [packId]: (s.custom[packId] ?? []).filter((l) => l.id !== id) },
        })),
      reset: () =>
        set({ cards: {}, custom: {}, puzzles: {}, medals: {}, lines: {}, xp: 0, activeDays: [] }),
    }),
    {
      name: 'progress',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ cards, custom, puzzles, medals, lines, xp, activeDays }) => ({
        cards,
        custom,
        puzzles,
        medals,
        lines,
        xp,
        activeDays,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ProgressState>;
        return {
          ...current,
          ...p,
          medals: p.medals ?? {},
          custom: p.custom ?? {},
          puzzles: p.puzzles ?? {},
        };
      },
      skipHydration: Platform.OS === 'web',
    },
  ),
);

/** Cards of one pack, keyed by position key (for core session helpers). */
export function packCards(
  cards: Readonly<Record<string, SrsCard>>,
  packId: string,
): Record<string, SrsCard> {
  const prefix = `${packId}|`;
  const out: Record<string, SrsCard> = {};
  for (const [id, card] of Object.entries(cards))
    if (id.startsWith(prefix)) out[id.slice(prefix.length)] = card;
  return out;
}

const subscribeHydration = (cb: () => void) => useProgress.persist.onFinishHydration(cb);
/** True once stored progress has been loaded (async on web, immediate on native). */
export function useProgressHydrated(): boolean {
  return useSyncExternalStore(
    subscribeHydration,
    () => useProgress.persist.hasHydrated(),
    () => false,
  );
}

/** Stars of a level; runs from before stars existed count as 3 (clean) or 1. */
export function lineStars(lp: LineProgress | undefined): Stars {
  if (!lp) return 0;
  if (lp.stars) return lp.stars;
  return lp.cleanRun ? 3 : lp.runs ? 1 : 0;
}
