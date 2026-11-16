import type { PackIndex } from '../pack/indexer';
import type { SrsCard } from '../srs/fsrs';

/** One review task: replay `lineId` from the start and find our move at `stepIndex`. */
export interface ReviewItem {
  key: string;
  lineId: string;
  /** 0-based index of the step (our move) to answer. */
  stepIndex: number;
  due: number;
}

/**
 * Daily review queue (ТЗ §6 «Повторение (SRS)», module 21): due cards of a
 * pack, most overdue first. Each card is replayed along the shortest line
 * that reaches it, so the user sees how the position arises.
 * `cards` is keyed by position key (already filtered to this pack).
 */
export function reviewQueue(
  index: PackIndex,
  cards: Readonly<Record<string, SrsCard>>,
  now: number,
  limit = 20,
): ReviewItem[] {
  const items: ReviewItem[] = [];
  for (const [key, card] of Object.entries(cards)) {
    if (card.state === 'new' || card.due > now) continue;
    let best: { lineId: string; stepIndex: number } | null = null;
    for (const lineId of index.linesByPosition.get(key) ?? []) {
      const steps = index.lines.get(lineId)?.steps ?? [];
      const stepIndex = steps.findIndex((s) => s.ours && s.keyBefore === key);
      if (stepIndex >= 0 && (!best || stepIndex < best.stepIndex)) best = { lineId, stepIndex };
    }
    if (best) items.push({ key, ...best, due: card.due });
  }
  return items.sort((a, b) => a.due - b.due || a.stepIndex - b.stepIndex).slice(0, limit);
}

/** Number of due cards (for badges), regardless of the queue limit. */
export function dueCount(cards: Readonly<Record<string, SrsCard>>, now: number): number {
  return Object.values(cards).filter((c) => c.state !== 'new' && c.due <= now).length;
}
