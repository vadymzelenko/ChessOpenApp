import type { OpeningPackInput } from './schema';

/** Minimal valid pack used by tests (not real course content). */
export function samplePack(): OpeningPackInput {
  return {
    meta: {
      id: 'sample-london',
      format: 1,
      packVersion: 1,
      title: { ru: 'Пример: Лондон', en: 'Sample: London' },
      description: { ru: 'Тестовый пакет' },
      side: 'w',
      eco: ['D02'],
      style: 'solid',
      difficulty: 2,
      accentColor: '#5B8CFF',
      sources: ['test fixture'],
    },
    ideas: [
      {
        id: 'bf4-before-e3',
        title: { ru: 'Слон f4 до e3' },
        text: { ru: 'Выводим слона до хода e3, иначе пешка запрёт его.' },
        diagram: { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P1B2/8/PPP1PPPP/RN1QKBNR b KQkq - 1 2' },
        status: 'reviewed',
      },
    ],
    course: {
      chapters: [
        {
          id: 'vs-d5',
          title: { ru: 'Против …d5' },
          lines: [
            {
              id: 'main',
              title: { ru: 'Главная' },
              level: 'base',
              moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3'],
              annotations: {
                '3': {
                  comment: { ru: 'Слон выходит раньше e3.' },
                  ideas: ['bf4-before-e3'],
                  arrows: [{ from: 'c1', to: 'f4', color: 'green' }],
                },
              },
              status: 'reviewed',
            },
            {
              id: 'c5',
              title: { ru: '…c5' },
              level: 'advanced',
              moves: ['d4', 'd5', 'Bf4', 'c5', 'e3'],
              status: 'draft',
            },
          ],
        },
      ],
    },
  };
}
