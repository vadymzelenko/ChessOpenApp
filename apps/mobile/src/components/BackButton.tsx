import { PressableScale, useTheme } from '@chess-open/ui';
import { router } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';

/** Round «back» button; falls back to `href` when there is no history (deep link). */
export function BackButton({ href = '/' }: { href?: string }) {
  const theme = useTheme();
  const { t } = useTranslation();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('course.back')}
      onPress={() => (router.canGoBack() ? router.back() : router.replace(href as never))}
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: theme.colors.surface,
      }}>
      <ChevronLeft color={theme.colors.text} size={24} />
    </PressableScale>
  );
}
