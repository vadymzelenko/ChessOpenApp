import { Card, Screen, ThemedText, useTheme } from '@chess-open/ui';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

export default function HomeScreen() {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <Screen>
      <View style={{ gap: theme.spacing.xs }}>
        <ThemedText variant="title">{t('app.name')}</ThemedText>
        <ThemedText tone="textMuted">{t('app.tagline')}</ThemedText>
      </View>

      <Card>
        <ThemedText variant="heading">{t('home.comingSoonTitle')}</ThemedText>
        <ThemedText tone="textMuted">{t('home.comingSoonBody')}</ThemedText>
      </Card>

      <Card>
        <ThemedText variant="label" tone="textMuted">
          {t('home.legendTitle')}
        </ThemedText>
        <ThemedText>
          <ThemedText tone="verified">★ </ThemedText>
          {t('home.legendVerified')}
        </ThemedText>
        <ThemedText>
          <ThemedText tone="generated">⚙ </ThemedText>
          {t('home.legendGenerated')}
        </ThemedText>
      </Card>
    </Screen>
  );
}
