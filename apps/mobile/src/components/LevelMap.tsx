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
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import { usePack } from '@/hooks/usePack';
import { lineKey, lineStars, packCards, useProgress } from '@/store/progress';

const NODE = 66;
const ROW = 118;
const HEADER = 84;
const TOP = 24;

type NodeState = 'done' | 'current' | 'open' | 'locked';

type MapItem =
  | { kind: 'header'; key: string; y: number; title: string; stars: number; max: number }
  | {
      kind: 'level';
      key: string;
      y: number;
      x: number;
      level: CourseLevel;
      state: NodeState;
      stars: Stars;
    }
  | {
      kind: 'boss';
      key: string;
      y: number;
      x: number;
      chapterId: string;
      state: NodeState;
      medal: boolean;
    }
  | { kind: 'bonus'; key: string; y: number; x: number; state: NodeState };

type NodeItem = Exclude<MapItem, { kind: 'header' }>;

/**
 * The course as a game level map (ТЗ §6): a winding path of numbered levels —
 * one per line, in learning order — each worth up to three stars. A level
 * opens once the previous one has a star; every chapter ends with a boss
 * (the chapter exam), and the traps are a bonus level at the end.
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
  const [width, setWidth] = useState(360);
  const [message, setMessage] = useState<string | null>(null);
  const scroll = useRef<ScrollViewInstance>(null);
  const scrolled = useRef(false);

  const levels = useMemo(() => (index ? courseLevels(index) : []), [index]);
  const starsOf = (lineId: string) => lineStars(lines[lineKey(packId, lineId)]);
  const open = unlockedCount(levels, starsOf);
  const totals = starTotals(levels, starsOf);
  const due = dueCount(packCards(cards, packId), now);

  // --- layout: every item gets a y, nodes also an x on the winding path -------------
  const center = width / 2;
  const amp = Math.min(width * 0.27, 130);
  const xAt = (i: number) => center + amp * Math.sin(i * 0.9);
  const items: MapItem[] = [];
  let y = TOP;
  let nodeIdx = 0;
  let currentSet = false;
  const stateOf = (isOpen: boolean, isDone: boolean): NodeState => {
    if (!isOpen) return 'locked';
    if (isDone) return 'done';
    if (!currentSet) {
      currentSet = true;
      return 'current';
    }
    return 'open';
  };
  const chapters = index?.pack.course.chapters ?? [];
  for (const ch of chapters) {
    const chLevels = levels.filter((l) => l.chapterId === ch.id);
    if (!chLevels.length) continue;
    const chStars = chLevels.reduce((a, l) => a + starsOf(l.lineId), 0);
    items.push({
      kind: 'header',
      key: `h-${ch.id}`,
      y,
      title: ch.title.ru,
      stars: chStars,
      max: chLevels.length * 3,
    });
    y += HEADER;
    for (const level of chLevels) {
      const stars = starsOf(level.lineId);
      items.push({
        kind: 'level',
        key: level.lineId,
        y,
        x: xAt(nodeIdx++),
        level,
        stars,
        state: stateOf(level.n <= open, stars > 0),
      });
      y += ROW;
    }
    const medal = !!medals[lineKey(packId, ch.id)];
    items.push({
      kind: 'boss',
      key: `b-${ch.id}`,
      y,
      x: xAt(nodeIdx++),
      chapterId: ch.id,
      medal,
      state: stateOf(
        chLevels.every((l) => starsOf(l.lineId) > 0),
        medal,
      ),
    });
    y += ROW;
  }
  if (index?.pack.traps.length) {
    items.push({ kind: 'bonus', key: 'bonus', y, x: xAt(nodeIdx++), state: 'open' });
    y += ROW;
  }
  const height = y + TOP;
  const nodes = items.filter((i): i is NodeItem => i.kind !== 'header');
  const currentNode = nodes.find((n) => n.state === 'current');

  // Path through the node centres: done part solid in the accent, the rest dashed.
  const pathOf = (pts: NodeItem[]) =>
    pts
      .map((p, i) => {
        const cy = p.y + NODE / 2;
        if (i === 0) return `M ${p.x} ${cy}`;
        const prev = pts[i - 1]!;
        const py = prev.y + NODE / 2;
        const mid = (py + cy) / 2;
        return `C ${prev.x} ${mid} ${p.x} ${mid} ${p.x} ${cy}`;
      })
      .join(' ');
  const cut = currentNode ? nodes.indexOf(currentNode) : nodes.length - 1;
  const donePath = pathOf(nodes.slice(0, cut + 1));
  const restPath = pathOf(nodes.slice(Math.max(0, cut)));

  // Start with the current level in view.
  useEffect(() => {
    if (scrolled.current || !currentNode || width === 360) return;
    scrolled.current = true;
    scroll.current?.scrollTo({ y: Math.max(0, currentNode.y - 120), animated: false });
  }, [currentNode, width]);
  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => setMessage(null), 2200);
    return () => clearTimeout(id);
  }, [message]);

  if (!index) return null;
  const meta = index.pack.meta;
  const accent = meta.accentColor;

  const onNode = (n: NodeItem) => {
    if (n.state === 'locked') {
      setMessage(
        n.kind === 'boss' ? t('levels.bossLocked') : t('levels.locked', { n: Math.max(1, open) }),
      );
      return;
    }
    if (n.kind === 'level') router.push(`/line/${packId}/${n.level.lineId}`);
    else if (n.kind === 'boss') router.push(`/exam/${packId}/${n.chapterId}`);
    else router.push(`/traps/${packId}`);
  };

  const starRow = (stars: number, size: number) => (
    <View style={{ flexDirection: 'row', gap: 1 }}>
      {[1, 2, 3].map((s) => (
        <Star
          key={s}
          size={size}
          color={s <= stars ? theme.colors.verified : theme.colors.border}
          fill={s <= stars ? theme.colors.verified : theme.colors.surfaceRaised}
        />
      ))}
    </View>
  );

  const node = (n: NodeItem) => {
    const locked = n.state === 'locked';
    const done = n.state === 'done';
    const special = n.kind !== 'level';
    const bg = locked
      ? theme.colors.surfaceRaised
      : n.kind === 'boss'
        ? '#9B6BF2'
        : n.kind === 'bonus'
          ? '#F08A3C'
          : done
            ? accent
            : theme.colors.surface;
    const fg = locked ? theme.colors.textMuted : done || special ? '#FFFFFF' : accent;
    const labelLeft = n.x > center;
    const title =
      n.kind === 'level'
        ? n.level.title.ru
        : n.kind === 'boss'
          ? t('levels.boss')
          : t('levels.bonus');
    let inner: ReactNode;
    if (locked) inner = <Lock color={fg} size={22} />;
    else if (n.kind === 'boss') inner = <Crown color={fg} size={28} />;
    else if (n.kind === 'bonus') inner = <Skull color={fg} size={26} />;
    else
      inner = (
        <ThemedText variant="heading" style={{ color: fg, fontSize: 22 }}>
          {n.level.n}
        </ThemedText>
      );
    return (
      <View
        key={n.key}
        style={{ position: 'absolute', top: n.y, left: n.x - NODE / 2, width: NODE }}>
        {n.state === 'current' ? <Pulse color={accent} /> : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: locked }}
          accessibilityLabel={
            n.kind === 'level' ? t('levels.level', { n: n.level.n }) + `: ${title}` : title
          }
          onPress={() => onNode(n)}
          style={{
            width: NODE,
            height: NODE,
            borderRadius: NODE / 2,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bg,
            borderWidth: n.state === 'current' ? 4 : 3,
            borderColor:
              n.state === 'current' ? accent : locked ? theme.colors.border : shade(bg, -0.25),
          }}>
          {inner}
        </PressableScale>
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          {n.kind === 'level' && !locked ? starRow(n.stars, 15) : null}
          {n.kind === 'boss' && n.medal ? (
            <ThemedText variant="caption" tone="verified">
              {t('levels.medal')}
            </ThemedText>
          ) : null}
        </View>
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: NODE / 2 - 18,
            width: Math.min(150, center - amp * 0.2),
            ...(labelLeft ? { right: NODE + 10 } : { left: NODE + 10 }),
          }}>
          <ThemedText
            variant="caption"
            numberOfLines={2}
            tone={locked ? 'textMuted' : 'text'}
            style={{ textAlign: labelLeft ? 'right' : 'left', lineHeight: 16 }}>
            {title}
          </ThemedText>
        </View>
      </View>
    );
  };

  const header = (h: Extract<MapItem, { kind: 'header' }>) => (
    <View
      key={h.key}
      style={{
        position: 'absolute',
        top: h.y + 8,
        left: 0,
        right: 0,
        alignItems: 'center',
      }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: theme.spacing.sm,
          paddingHorizontal: theme.spacing.lg,
          paddingVertical: theme.spacing.sm,
          borderRadius: theme.radii.pill,
          backgroundColor: theme.colors.surface,
          borderWidth: 1,
          borderColor: theme.colors.border,
        }}>
        <ThemedText variant="label" style={{ fontSize: 15 }}>
          {h.title}
        </ThemedText>
        <Star size={14} color={theme.colors.verified} fill={theme.colors.verified} />
        <ThemedText variant="caption" tone="textMuted">
          {h.stars}/{h.max}
        </ThemedText>
      </View>
    </View>
  );

  const doneLevels = levels.filter((l) => starsOf(l.lineId) > 0).length;
  const currentLevel = currentNode?.kind === 'level' ? currentNode.level : null;
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
            style={{ maxWidth: 560, width: '100%', alignSelf: 'center', gap: theme.spacing.md }}>
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
              {currentNode ? (
                <Button
                  variant="inverse"
                  icon={Play}
                  label={
                    currentLevel
                      ? t('levels.play', { n: currentLevel.n })
                      : currentNode.kind === 'boss'
                        ? t('levels.boss')
                        : t('levels.bonus')
                  }
                  onPress={() => onNode(currentNode)}
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
          onLayout={(e) => setWidth(Math.round(e.nativeEvent.layout.width))}
          style={{ width: '100%', maxWidth: 560, alignSelf: 'center', height }}>
          <Svg width={width} height={height} style={{ position: 'absolute', left: 0, top: 0 }}>
            <Path
              d={restPath}
              stroke={theme.colors.border}
              strokeWidth={8}
              strokeLinecap="round"
              strokeDasharray="2 16"
              fill="none"
            />
            <Path
              d={donePath}
              stroke={accent}
              strokeWidth={8}
              strokeLinecap="round"
              fill="none"
              opacity={0.85}
            />
          </Svg>
          {items.map((it) => (it.kind === 'header' ? header(it) : node(it)))}
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

/** Soft ring pulsing around the current level (transform + opacity only). */
function Pulse({ color }: { color: string }) {
  const theme = useTheme();
  const p = useSharedValue(0);
  useEffect(() => {
    if (theme.animationsDisabled) return;
    p.set(withRepeat(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }), -1));
  }, [p, theme.animationsDisabled]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.55 * (1 - p.get()),
    transform: [{ scale: 1 + 0.45 * p.get() }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        {
          position: 'absolute',
          left: 0,
          top: 0,
          width: NODE,
          height: NODE,
          borderRadius: NODE / 2,
          backgroundColor: color,
        },
        style,
      ]}
    />
  );
}
