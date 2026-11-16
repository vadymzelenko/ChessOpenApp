import { dayKey, newCard, review, type Rating, type SrsCard } from '@chess-open/core';
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
}

export interface Medal {
  score: number;
  at: number;
}

interface ProgressState {
  cards: Record<string, SrsCard>;
  /** Exam medals by `${packId}|${chapterId}` (best passing score). */
  medals: Record<string, Medal>;
  lines: Record<string, LineProgress>;
  xp: number;
  activeDays: string[];
  gradeCard: (packId: string, positionKey: string, rating: Rating, now?: number) => void;
  markStudied: (packId: string, lineId: string, now?: number) => void;
  finishRun: (packId: string, lineId: string, mistakes: number, now?: number) => void;
  addXp: (amount: number, now?: number) => void;
  saveExam: (
    packId: string,
    chapterId: string,
    score: number,
    passed: boolean,
    now?: number,
  ) => void;
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
      finishRun: (packId, lineId, mistakes, now = Date.now()) =>
        set((s) => {
          const k = lineKey(packId, lineId);
          const prev = s.lines[k] ?? {};
          return {
            lines: {
              ...s.lines,
              [k]: {
                ...prev,
                runs: (prev.runs ?? 0) + 1,
                ...(mistakes === 0 ? { cleanRun: now } : {}),
              },
            },
            activeDays: touchDay(s.activeDays, now),
          };
        }),
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
      reset: () => set({ cards: {}, medals: {}, lines: {}, xp: 0, activeDays: [] }),
    }),
    {
      name: 'progress',
      version: 1,
      storage: createJSONStorage(() => kvStorage),
      partialize: ({ cards, medals, lines, xp, activeDays }) => ({
        cards,
        medals,
        lines,
        xp,
        activeDays,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...(persisted as object),
        medals: (persisted as { medals?: Record<string, Medal> })?.medals ?? {},
      }),
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
