import {
  PIECE_SET_IDS,
  PieceIcon,
  Screen,
  SectionHeader,
  ThemedText,
  useTheme,
  pieceSets,
} from '@chess-open/ui';
import Constants from 'expo-constants';
import { Link } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { BackButton } from '@/components/BackButton';
import { PanelCard } from '@/components/SessionLayout';

const REPO = 'https://github.com/vadymzelenko/ChessOpenApp';

/** Third-party software and assets with their licences (ТЗ §12). */
const SOFTWARE: { name: string; license: string; url: string }[] = [
  { name: 'React Native / Expo', license: 'MIT', url: 'https://expo.dev' },
  { name: 'chess.js', license: 'BSD-2-Clause', url: 'https://github.com/jhlywa/chess.js' },
  { name: 'Manrope (font)', license: 'SIL OFL 1.1', url: 'https://github.com/sharanda/manrope' },
  { name: 'Lucide icons', license: 'ISC', url: 'https://lucide.dev' },
  { name: 'Zustand', license: 'MIT', url: 'https://github.com/pmndrs/zustand' },
  { name: 'i18next', license: 'MIT', url: 'https://www.i18next.com' },
  { name: 'zod', license: 'MIT', url: 'https://zod.dev' },
  { name: 'Stockfish (course check)', license: 'GPL-3.0', url: 'https://stockfishchess.org' },
];

const DATA: { name: string; license: string; url: string }[] = [
  {
    name: 'Lichess open database (games, puzzles, evaluations)',
    license: 'CC0',
    url: 'https://database.lichess.org',
  },
  {
    name: 'Lichess Opening Explorer',
    license: 'CC0',
    url: 'https://lichess.org/analysis#explorer',
  },
];

/** «Лицензии и благодарности» and the privacy policy (ТЗ §12, module 32). */
export default function LicensesScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const version = Constants.expoConfig?.version ?? '';

  const row = (name: string, license: string, url: string) => (
    <View
      key={name}
      style={{
        flexDirection: 'row',
        gap: theme.spacing.sm,
        paddingVertical: 4,
        alignItems: 'baseline',
      }}>
      <Link href={url as never} target="_blank" style={{ flex: 1 }}>
        <ThemedText>{name}</ThemedText>
      </Link>
      <ThemedText variant="caption" tone="textMuted">
        {license}
      </ThemedText>
    </View>
  );

  return (
    <Screen
      title={t('about.title')}
      subtitle={t('about.version', { version })}
      right={<BackButton href="/settings" />}>
      <PanelCard>
        <ThemedText>{t('about.appLicense')}</ThemedText>
        <Link href={REPO as never} target="_blank">
          <ThemedText tone="accent">{t('about.sourceCode')}</ThemedText>
        </Link>
      </PanelCard>

      <SectionHeader title={t('about.privacy')} />
      <PanelCard>
        <ThemedText style={{ lineHeight: 24 }}>{t('about.privacyText')}</ThemedText>
        <ThemedText variant="caption" tone="textMuted">
          {t('about.contact')}
        </ThemedText>
      </PanelCard>

      <SectionHeader title={t('about.licenses')} />
      <ThemedText variant="label" tone="textMuted">
        {t('about.pieces')}
      </ThemedText>
      <PanelCard>
        {PIECE_SET_IDS.map((id) => {
          const set = pieceSets[id];
          return (
            <View
              key={id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: theme.spacing.sm,
                paddingVertical: 2,
              }}>
              <PieceIcon set={id} color="w" kind="n" size={28} />
              <View style={{ flex: 1 }}>
                <Link href={set.url as never} target="_blank">
                  <ThemedText>{set.name}</ThemedText>
                </Link>
                <ThemedText variant="caption" tone="textMuted">
                  {set.author}
                </ThemedText>
              </View>
              <ThemedText variant="caption" tone="textMuted">
                {set.license}
              </ThemedText>
            </View>
          );
        })}
      </PanelCard>
      <ThemedText variant="label" tone="textMuted">
        {t('about.software')}
      </ThemedText>
      <PanelCard>{SOFTWARE.map((s) => row(s.name, s.license, s.url))}</PanelCard>
      <ThemedText variant="label" tone="textMuted">
        {t('about.data')}
      </ThemedText>
      <PanelCard>{DATA.map((s) => row(s.name, s.license, s.url))}</PanelCard>
      <ThemedText
        variant="caption"
        tone="textMuted"
        style={{ textAlign: 'center', marginTop: theme.spacing.sm }}>
        {t('about.thanks')}
      </ThemedText>
    </Screen>
  );
}
