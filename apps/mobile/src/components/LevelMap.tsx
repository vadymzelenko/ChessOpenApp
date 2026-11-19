import {
  courseLevels,
  dueCount,
  starTotals,
  unlockedCount,
  type CourseLevel,
  type Stars,
} from '@chess-open/core';
import { Button, PressableScale, ThemedText, shade, useTheme } from '@chess-open/ui';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Crown, Lock, Play, Repeat, Skull, Star } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ScrollView, View, type ScrollViewInstance } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePack } from '@/hooks/usePack';
import { lineKey, lineStars, packCards, useProgress } from '@/store/progress';

const GAP = 10;

/** Opening blocks shown on the home screen; only shipped packs are playable. */
const BLOCKS: { id: string; side: 'w' | 'b' }[] = [
  { id: 'london', side: 'w' },
  { id: 'caro-kann', side: 'b' },
  { id: 'slav', side: 'b' },
];
const MAX_WIDTH = 760;

type CardState = 'done' | 'current' | 'open' | 'locked';

type Card =
  | { kind: 'level'; key: string; level: CourseLevel; state: CardState; stars: Stars }
  | { kind: 'boss'; key: string; chapterId: string; state: CardState; medal: boolean }
  | { kind: 'bonus'; key: string; state: CardState };

interface Section {
  id: string;
  title: string;
  stars: number;
  max: number;
  cards: Card[];
}

/**
 * The course as a game level select (ТЗ §6): the London block split into
 * chapters, each a grid of level cards — one per line, in learning order —
 * worth up to three stars. A level opens once the previous one has a star;
 * every chapter ends with a boss (the chapter exam), the block with a bonus
 * level (traps).
 */
export function LevelMap({ packId }: { packId: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const index = usePack(packId);
  const lines = useProgress((s) => s.lines);
  const medals = useProgress((s) => s.medals);
  const cards = useProgress((s) => s.cards);
  const [now] = useState(() => Date.now());
  const [width, setWidth] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);

  const levels = useMemo(() => (index ? courseLevels(index) : []), [index]);
  const starsOf = (lineId: string) => lineStars(lines[lineKey(packId, lineId)]);
  const open = unlockedCount(levels, starsOf);
  const totals = starTotals(levels, starsOf);
  const due = dueCount(packCards(cards, packId), now);

  // --- sections: chapter → its level cards, then the boss --------------------------
  let currentSet = false;
  const stateOf = (isOpen: boolean, isDone: boolean): CardState => {
    if (!isOpen) return 'locked';
    if (isDone) return 'done';
    if (!currentSet) {
      currentSet = true;
      return 'current';
    }
    return 'open';
  };
  const sections: Section[] = [];
  for (const ch of index?.pack.course.chapters ?? []) {
    const chLevels = levels.filter((l) => l.chapterId === ch.id);
    if (!chLevels.length) continue;
    const list: Card[] = chLevels.map((level) => {
      const stars = starsOf(level.lineId);
      return {
        kind: 'level',
        key: level.lineId,
        level,
        stars,
        state: stateOf(level.n <= open, stars > 0),
      };
    });
    const medal = !!medals[lineKey(packId, ch.id)];
    list.push({
      kind: 'boss',
      key: `boss-${ch.id}`,
      chapterId: ch.id,
      medal,
      state: stateOf(
        chLevels.every((l) => starsOf(l.lineId) > 0),
        medal,
      ),
    });
    sections.push({
      id: ch.id,
      title: ch.title.ru,
      stars: chLevels.reduce((a, l) => a + starsOf(l.lineId), 0),
      max: chLevels.length * 3,
      cards: list,
    });
  }
  if (index?.pack.traps.length) {
    sections.push({
      id: 'bonus',
      title: t('levels.bonusSection'),
      stars: 0,
      max: 0,
      cards: [{ kind: 'bonus', key: 'bonus', state: 'open' }],
    });
  }
  const current = sections.flatMap((s) => s.cards).find((c) => c.state === 'current');
  const currentSection = sections.find((s) => current && s.cards.includes(current))?.id;

  const columns = width >= 640 ? 5 : width >= 460 ? 4 : 3;
  const cardW = width ? Math.floor((width - GAP * (columns - 1)) / columns) : 0;

  // Open the map at the chapter of the current level (not needed for the first one).
  const onSectionLayout = (id: string, y: number) => {
    if (scrolled.current || id !== currentSection || id === sections[0]?.id) return;
    scrolled.current = true;
    scroll.current?.scrollTo({ y: y + 140, animated: false });
  };
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(id);
  }, [message]);

  if (!index) return null;
  const meta = index.pack.meta;
  const accent = meta.accentColor;

  const onCard = (c: Card) => {
    if (c.state === 'locked') {
      setMessage(
        c.kind === 'boss' ? t('levels.bossLocked') : t('levels.locked', { n: Math.max(1, open) }),
      );
      return;
    }
    if (c.kind === 'level') router.push(`/line/${packId}/${c.level.lineId}`);
    else if (c.kind === 'boss') router.push(`/exam/${packId}/${c.chapterId}`);
    else router.push(`/traps/${packId}`);
  };

  const starRow = (stars: number, onColor: boolean) => (
    <View style={{ flexDirection: 'row', gap: 2 }}>
      {[1, 2, 3].map((s) => (
        <Star
          key={s}
          size={15}
          color={
            s <= stars
              ? theme.colors.verified
              : onColor
                ? 'rgba(255,255,255,0.5)'
                : theme.colors.border
          }
          fill={s <= stars ? theme.colors.verified : 'transparent'}
        />
      ))}
    </View>
  );

  const card = (c: Card) => {
    const locked = c.state === 'locked';
    const done = c.state === 'done';
    const color = c.kind === 'boss' ? '#9B6BF2' : c.kind === 'bonus' ? '#F08A3C' : accent;
    // Completed levels and the special cards are filled with their colour.
    const filled = !locked && (done || c.kind !== 'level');
    const fg = filled ? '#FFFFFF' : locked ? theme.colors.textMuted : theme.colors.text;
    const title =
      c.kind === 'level'
        ? c.level.title.ru
        : c.kind === 'boss'
          ? t('levels.boss')
          : t('levels.bonus');
    let badge: ReactNode;
    if (c.kind === 'boss') badge = <Crown color={fg} size={26} />;
    else if (c.kind === 'bonus') badge = <Skull color={fg} size={26} />;
    else
      badge = (
        <ThemedText
          variant="heading"
          style={{ color: filled ? '#FFFFFF' : locked ? fg : color, fontSize: 26, lineHeight: 30 }}>
          {c.level.n}
        </ThemedText>
      );
    const body = (
      <PressableScale
        accessibilityRole="button"
        accessibilityState={{ disabled: locked }}
        accessibilityLabel={
          c.kind === 'level' ? `${t('levels.level', { n: c.level.n })}: ${title}` : title
        }
        onPress={() => onCard(c)}
        style={{
          width: cardW,
          minHeight: Math.max(104, Math.round(cardW * 0.9)),
          padding: 10,
          gap: 6,
          borderRadius: theme.radii.lg,
          overflow: 'hidden',
          backgroundColor: filled ? color : theme.colors.surface,
          borderWidth: c.state === 'current' ? 2 : 1,
          borderColor:
            c.state === 'current' ? color : filled ? shade(color, -0.2) : theme.colors.border,
          opacity: locked ? 0.65 : 1,
        }}>
        {filled ? (
          <LinearGradient
            colors={[shade(color, 0.12), shade(color, -0.28)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
          />
        ) : null}
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          {badge}
          {locked ? <Lock color={theme.colors.textMuted} size={16} /> : null}
        </View>
        <ThemedText
          variant="caption"
          numberOfLines={3}
          style={{
            flex: 1,
            color: fg,
            fontFamily: theme.typography.family.semibold,
            lineHeight: 16,
          }}>
          {title}
        </ThemedText>
        {c.kind === 'level' && !locked ? starRow(c.stars, filled) : null}
        {c.kind === 'boss' && c.medal ? (
          <ThemedText variant="caption" style={{ color: '#FFFFFF' }}>
            {t('levels.medal')}
          </ThemedText>
        ) : null}
      </PressableScale>
    );
    return c.state === 'current' ? (
      <Breathe key={c.key}>{body}</Breathe>
    ) : (
      <View key={c.key}>{body}</View>
    );
  };

  const doneLevels = levels.filter((l) => starsOf(l.lineId) > 0).length;
  const currentLevel = current?.kind === 'level' ? current.level : null;
  const pct = totals.max ? totals.stars / totals.max : 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView
        ref={scroll}
        contentContainerStyle={{ paddingBottom: theme.spacing.xxl }}
        showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[accent, shade(accent, -0.5)]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            paddingTop: insets.top + theme.spacing.lg,
            paddingHorizontal: theme.spacing.lg,
            paddingBottom: theme.spacing.xl,
          }}>
          <View
            style={{
              maxWidth: MAX_WIDTH,
              width: '100%',
              alignSelf: 'center',
              gap: theme.spacing.md,
            }}>
            <ThemedText variant="caption" style={{ color: 'rgba(255,255,255,0.8)' }}>
              {t('levels.block')}
            </ThemedText>
            <ThemedText variant="title" style={{ color: '#FFFFFF' }}>
              {meta.title.ru}
            </ThemedText>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.lg }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Star size={22} color={theme.colors.verified} fill={theme.colors.verified} />
                <ThemedText variant="heading" style={{ color: '#FFFFFF' }}>
                  {totals.stars}/{totals.max}
                </ThemedText>
              </View>
              <ThemedText style={{ color: 'rgba(255,255,255,0.85)' }}>
                {t('levels.progress', { done: doneLevels, count: levels.length })}
              </ThemedText>
            </View>
            <View
              style={{
                height: 8,
                borderRadius: 4,
                backgroundColor: 'rgba(255,255,255,0.25)',
                overflow: 'hidden',
              }}>
              <View
                style={{
                  width: `${Math.round(pct * 100)}%`,
                  height: 8,
                  backgroundColor: theme.colors.verified,
                }}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: theme.spacing.sm, flexWrap: 'wrap' }}>
              {current ? (
                <Button
                  variant="inverse"
                  icon={Play}
                  label={
                    currentLevel
                      ? t('levels.play', { n: currentLevel.n })
                      : current.kind === 'boss'
                        ? t('levels.boss')
                        : t('levels.bonus')
                  }
                  onPress={() => onCard(current)}
                />
              ) : null}
              <Button
                variant="inverse"
                icon={Repeat}
                label={due > 0 ? t('levels.review', { count: due }) : t('review.title')}
                onPress={() => router.push(`/review/${packId}`)}
                style={{ backgroundColor: 'rgba(255,255,255,0.18)', borderWidth: 0 }}
              />
            </View>
          </View>
        </LinearGradient>

        <View
          onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width) - 2 * theme.spacing.lg)}
          style={{
            width: '100%',
            maxWidth: MAX_WIDTH,
            alignSelf: 'center',
            paddingHorizontal: theme.spacing.lg,
            paddingTop: theme.spacing.lg,
            gap: theme.spacing.xl,
          }}>
          <View style={{ gap: theme.spacing.sm }}>
            <ThemedText variant="label" tone="textMuted">
              {t('levels.blocks')}
            </ThemedText>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: GAP }}>
                {BLOCKS.map((b) => {
                  const active = b.id === packId;
                  return (
                    <PressableScale
                      key={b.id}
                      accessibilityRole="button"
                      accessibilityLabel={t(`levels.block_${b.id}`)}
                      onPress={() => (active ? null : setMessage(t('levels.soonText')))}
                      style={{
                        width: 168,
                        padding: theme.spacing.md,
                        gap: 4,
                        borderRadius: theme.radii.lg,
                        backgroundColor: active ? `${accent}26` : theme.colors.surface,
                        borderWidth: active ? 2 : 1,
                        borderColor: active ? accent : theme.colors.border,
                        opacity: active ? 1 : 0.75,
                      }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <ThemedText variant="caption" tone="textMuted" style={{ flex: 1 }}>
                          {t(b.side === 'w' ? 'levels.forWhite' : 'levels.forBlack')}
                        </ThemedText>
                        {active ? null : <Lock color={theme.colors.textMuted} size={14} />}
                      </View>
                      <ThemedText variant="label" style={{ fontSize: 15 }} numberOfLines={1}>
                        {t(`levels.block_${b.id}`)}
                      </ThemedText>
                      {active ? (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Star
                            size={13}
                            color={theme.colors.verified}
                            fill={theme.colors.verified}
                          />
                          <ThemedText variant="caption" tone="textMuted">
                            {totals.stars}/{totals.max}
                          </ThemedText>
                        </View>
                      ) : (
                        <ThemedText variant="caption" tone="generated">
                          {t('levels.soon')}
                        </ThemedText>
                      )}
                    </PressableScale>
                  );
                })}
              </View>
            </ScrollView>
          </View>
          {sections.map((s, si) => (
            <View
              key={s.id}
              onLayout={(e) => onSectionLayout(s.id, e.nativeEvent.layout.y)}
              style={{ gap: theme.spacing.md }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: theme.spacing.sm }}>
                <View style={{ flex: 1, gap: 2 }}>
                  {s.max ? (
                    <ThemedText variant="caption" tone="textMuted">
                      {t('levels.chapter', { n: si + 1 })}
                    </ThemedText>
                  ) : null}
                  <ThemedText variant="heading" style={{ fontSize: 19 }}>
                    {s.title}
                  </ThemedText>
                </View>
                {s.max ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                    <Star size={15} color={theme.colors.verified} fill={theme.colors.verified} />
                    <ThemedText variant="label" tone="textMuted">
                      {s.stars}/{s.max}
                    </ThemedText>
                  </View>
                ) : null}
              </View>
              {cardW > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: GAP }}>
                  {s.cards.map(card)}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
      {message ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: theme.spacing.lg,
            right: theme.spacing.lg,
            bottom: theme.spacing.lg,
            alignItems: 'center',
          }}>
          <View
            style={{
              paddingHorizontal: theme.spacing.lg,
              paddingVertical: theme.spacing.md,
              borderRadius: theme.radii.lg,
              backgroundColor: theme.colors.surfaceRaised,
              borderWidth: 1,
              borderColor: theme.colors.border,
            }}>
            <ThemedText>{message}</ThemedText>
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The current level card gently «breathes» (transform only). */
function Breathe({ children }: { children: ReactNode }) {
  const theme = useTheme();
  const p = useSharedValue(1);
  useEffect(() => {
    if (theme.animationsDisabled) return;
    p.set(
      withRepeat(
        withSequence(
          withTiming(1.05, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
        ),
        -1,
      ),
    );
  }, [p, theme.animationsDisabled]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: p.get() }] }));
  return <Animated.View style={style}>{children}</Animated.View>;
}
