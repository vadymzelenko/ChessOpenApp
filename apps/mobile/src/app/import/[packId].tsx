import { findDeviations, type Deviation } from '@chess-open/core';
import {
  Button,
  PressableScale,
  Screen,
  SectionHeader,
  SegmentedControl,
  ThemedText,
  useTheme,
} from '@chess-open/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Download, ExternalLink, Repeat } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, TextInput, View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { PanelCard } from '@/components/SessionLayout';
import { usePack } from '@/hooks/usePack';
import { PACK_IDS } from '@/packs/registry';
import { fetchGames, isValidNick, type GameSource } from '@/services/gameImport';
import { useProgress } from '@/store/progress';
import { useSettings } from '@/store/settings';

export function generateStaticParams(): { packId: string }[] {
  return PACK_IDS.map((packId) => ({ packId }));
}

interface Group {
  key: string;
  ply: number;
  played: string;
  expected: string;
  games: Deviation[];
}

type Status =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'error'; code: string }
  | { kind: 'done'; total: number; ours: number; deviations: Deviation[] };

const moveLabel = (ply: number, san: string) =>
  `${Math.ceil(ply / 2)}${ply % 2 === 1 ? '.' : '…'} ${san}`;

/** Import games by nickname and show where the user left the repertoire (ТЗ module 34). */
export default function ImportScreen() {
  const { packId } = useLocalSearchParams<{ packId: string }>();
  const { t } = useTranslation();
  const theme = useTheme();
  const index = usePack(packId);
  const gradeCard = useProgress((s) => s.gradeCard);
  const savedNick = useSettings((s) => s.importNick);
  const savedSource = useSettings((s) => s.importSource);
  const setSetting = useSettings((s) => s.set);
  const [nick, setNick] = useState(savedNick);
  const [source, setSource] = useState<GameSource>(savedSource);
  const [status, setStatus] = useState<Status>({ kind: 'idle' });
  const [queued, setQueued] = useState<ReadonlySet<string>>(new Set());

  const groups = useMemo<Group[]>(() => {
    if (status.kind !== 'done') return [];
    const map = new Map<string, Group>();
    for (const d of status.deviations) {
      const id = `${d.key}|${d.played}`;
      const g = map.get(id) ?? { ...d, games: [] };
      g.games.push(d);
      map.set(id, g);
    }
    return [...map.values()].sort((a, b) => b.games.length - a.games.length || a.ply - b.ply);
  }, [status]);

  if (!index) return null;
  const meta = index.pack.meta;

  const load = async () => {
    if (!isValidNick(nick)) {
      setStatus({ kind: 'error', code: 'nick' });
      return;
    }
    setSetting('importNick', nick.trim());
    setSetting('importSource', source);
    setStatus({ kind: 'loading' });
    try {
      const games = await fetchGames(source, nick);
      setStatus({
        kind: 'done',
        total: games.length,
        ours: games.filter((g) => g.color === index.side).length,
        deviations: findDeviations(index, games),
      });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'network';
      setStatus({ kind: 'error', code: ['nick', 'notFound'].includes(code) ? code : 'network' });
    }
  };

  const queue = (g: Group) => {
    gradeCard(meta.id, g.key, 1);
    setQueued((s) => new Set(s).add(g.key));
  };

  return (
    <Screen
      title={t('import.title')}
      subtitle={meta.title.ru}
      right={<BackButton href={`/course/${meta.id}`} />}>
      <PanelCard>
        <ThemedText tone="textMuted">{t('import.intro')}</ThemedText>
        <SegmentedControl
          value={source}
          onChange={(v) => setSource(v as GameSource)}
          options={[
            { value: 'lichess', label: 'Lichess' },
            { value: 'chesscom', label: 'Chess.com' },
          ]}
        />
        <TextInput
          value={nick}
          onChangeText={setNick}
          onSubmitEditing={() => void load()}
          placeholder={t('import.nick')}
          placeholderTextColor={theme.colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          accessibilityLabel={t('import.nick')}
          style={{
            borderWidth: 1,
            borderColor: theme.colors.border,
            borderRadius: theme.radii.md,
            backgroundColor: theme.colors.surfaceRaised,
            color: theme.colors.text,
            paddingHorizontal: theme.spacing.md,
            paddingVertical: theme.spacing.sm,
            fontFamily: theme.typography.family.medium,
            fontSize: theme.typography.size.md,
          }}
        />
        <Button
          variant="primary"
          icon={Download}
          label={t('import.load')}
          disabled={status.kind === 'loading'}
          onPress={() => void load()}
        />
        <ThemedText variant="caption" tone="textMuted">
          {t('import.privacy')}
        </ThemedText>
      </PanelCard>

      {status.kind === 'loading' ? (
        <ActivityIndicator color={theme.colors.accent} />
      ) : status.kind === 'error' ? (
        <PanelCard tone="danger">
          <ThemedText>{t(`import.error.${status.code}`)}</ThemedText>
        </PanelCard>
      ) : status.kind === 'done' ? (
        <>
          <PanelCard tone={groups.length ? undefined : 'success'}>
            <ThemedText>
              {t('import.summary', { total: status.total, ours: status.ours })}
            </ThemedText>
            <ThemedText tone="textMuted">
              {groups.length
                ? t('import.found', { count: status.deviations.length })
                : status.ours
                  ? t('import.clean')
                  : t('import.noSide')}
            </ThemedText>
          </PanelCard>
          {groups.length ? <SectionHeader title={t('import.deviations')} /> : null}
          {groups.map((g) => {
            const lineId = index.linesByPosition.get(g.key)?.[0];
            const first = g.games[0]!;
            return (
              <PanelCard key={`${g.key}|${g.played}`}>
                <ThemedText variant="heading">
                  {moveLabel(g.ply, g.played)}{' '}
                  <ThemedText tone="textMuted">
                    {t('import.insteadOf', { move: moveLabel(g.ply, g.expected) })}
                  </ThemedText>
                </ThemedText>
                <ThemedText variant="caption" tone="textMuted">
                  {t('import.games', { count: g.games.length })}
                  {lineId ? ` · ${index.lines.get(lineId)?.line.title.ru ?? ''}` : ''}
                </ThemedText>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: theme.spacing.sm }}>
                  {lineId ? (
                    <Button
                      compact
                      variant="primary"
                      label={t('progress.train')}
                      onPress={() => router.push(`/line/${meta.id}/${lineId}`)}
                    />
                  ) : null}
                  <Button
                    compact
                    icon={Repeat}
                    disabled={queued.has(g.key)}
                    label={queued.has(g.key) ? t('import.queued') : t('import.toReview')}
                    onPress={() => queue(g)}
                  />
                  {first.game.url ? (
                    <PressableScale
                      accessibilityRole="link"
                      accessibilityLabel={t('import.openGame')}
                      onPress={() => void Linking.openURL(first.game.url)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 4,
                        paddingHorizontal: theme.spacing.sm,
                        paddingVertical: theme.spacing.xs,
                      }}>
                      <ExternalLink color={theme.colors.accent} size={16} />
                      <ThemedText variant="label" tone="accent">
                        {t('import.openGame')}
                      </ThemedText>
                    </PressableScale>
                  ) : null}
                </View>
              </PanelCard>
            );
          })}
        </>
      ) : null}
    </Screen>
  );
}
