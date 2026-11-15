import { ChessGame, type Idea } from '@chess-open/core';
import { Board, Button, ThemedText, boardThemes, useTheme } from '@chess-open/ui';
import { Lightbulb, X } from 'lucide-react-native';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { useSettings } from '@/store/settings';

interface IdeaSheetProps {
  idea: Idea | null;
  onClose: () => void;
}

/** Idea card (ТЗ §8 «Идея / план»): title, explanation and a diagram. */
export function IdeaSheet({ idea, onClose }: IdeaSheetProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const settings = useSettings();
  const diagram = useMemo(() => (idea?.diagram ? new ChessGame(idea.diagram.fen) : null), [idea]);

  return (
    <Modal visible={!!idea} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="close"
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: theme.colors.overlay,
          justifyContent: 'center',
          padding: theme.spacing.lg,
        }}>
        <Pressable
          onPress={() => undefined}
          style={{
            alignSelf: 'center',
            width: '100%',
            maxWidth: 460,
            maxHeight: '90%',
            borderRadius: theme.radii.xl,
            backgroundColor: theme.colors.surface,
            borderWidth: 1,
            borderColor: theme.colors.border,
            overflow: 'hidden',
          }}>
          <ScrollView contentContainerStyle={{ padding: theme.spacing.lg, gap: theme.spacing.md }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: theme.spacing.sm }}>
              <Lightbulb color={theme.colors.verified} size={22} />
              <ThemedText
                variant="caption"
                tone="textMuted"
                style={{ flex: 1, textTransform: 'uppercase', letterSpacing: 1 }}>
                {t('line.idea')}
              </ThemedText>
              <Button
                compact
                variant="ghost"
                icon={X}
                accessibilityLabel="close"
                onPress={onClose}
              />
            </View>
            {idea ? (
              <>
                <ThemedText variant="heading">{idea.title.ru}</ThemedText>
                {diagram && idea.diagram ? (
                  <View
                    style={{
                      width: '100%',
                      maxWidth: 320,
                      alignSelf: 'center',
                      borderRadius: theme.radii.md,
                      overflow: 'hidden',
                    }}>
                    <Board
                      pieces={diagram.pieces()}
                      arrows={idea.diagram.arrows ?? []}
                      highlights={idea.diagram.highlights ?? []}
                      showCoordinates={false}
                      boardTheme={boardThemes[settings.boardTheme]}
                      pieceSet={settings.pieceSet}
                      disabled
                    />
                  </View>
                ) : null}
                <ThemedText style={{ lineHeight: 24 }}>{idea.text.ru}</ThemedText>
                {idea.status !== 'reviewed' ? (
                  <ThemedText variant="caption" tone="generated">
                    ⚙ draft
                  </ThemedText>
                ) : null}
              </>
            ) : null}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
