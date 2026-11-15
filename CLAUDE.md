# Project rules (Chess Open — opening trainer)

Spec: «ТЗ: бесплатный тренажёр дебютов (React Native + Web)». Progress per module: docs/ROADMAP.md.

- Monorepo, npm workspaces: `apps/mobile` (Expo + Expo Router), `packages/core`, `packages/ui`.
- One task = one module from the roadmap. Update docs/ROADMAP.md when a module is done.
- TypeScript strict, no `any`.
- `packages/core` is pure logic: no React / React Native / Expo imports; every function unit-tested.
- Colours, spacing, radii, fonts, animation durations come only from `@chess-open/ui` tokens
  (`useTheme()`); never hard-code them in screens. Durations via `theme.durations` (respects
  animation speed + OS reduce motion).
- Animations only on transform/opacity via Reanimated.
- Every UI string goes through i18n keys (`apps/mobile/src/i18n/locales/*.json`), RU is the source.
- Must work on Android and in the browser (static web export).
- Add app deps with `npx expo install` in `apps/mobile` (offline env: `EXPO_OFFLINE=1`).
- Before committing: `npm test && npm run typecheck && npm run lint && npm run format:check`.
- Licences (ТЗ §12): no chessground, no Stockfish inside the app without GPL review, no copied
  Chessable/Chessigma content, OFL fonts only.
