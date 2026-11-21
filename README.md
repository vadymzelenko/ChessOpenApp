# Chess Open

A free chess opening trainer for Android and the web, built from one TypeScript codebase with Expo (React Native). The first course teaches the London System for White.

Web version: https://vadymzelenko.github.io/ChessOpenApp/
Latest Android build: [chess-open.apk](https://github.com/vadymzelenko/ChessOpenApp/releases/latest/download/chess-open.apk)

## Features

- **London System course:** 6 chapters, 53 levels of unique lines of about ten moves, plus 18 transposition lines
- **Learning modes:** step-by-step study with large explanations, highlighted moves and squares and arrows; training where the opponent replies automatically and hints come in three stages; spaced repetition; chapter exams without hints, with a medal at 85%
- **Spaced repetition:** FSRS-5 scheduling, graded by mistakes, hints and response time; progress is stored by position, so it survives course updates
- **Variation tree:** the whole course as one tree; for any opponent move the app shows the recommended reply with an arrow and an explanation
- **Traps:** traps to set for the opponent and traps to avoid
- **Evaluation bar:** every move in all 379 course positions is pre-evaluated with Stockfish
- **Board:** SVG board with drag-and-drop and tap-tap input, move dots, promotion dialog, animations, sounds and haptics, classic Lichess piece sets
- **Platforms:** phone, tablet and desktop layouts, keyboard shortcuts, offline PWA; interface in English, Polish, Ukrainian and Russian

## Data pipeline

Opening packs are built from data rather than typed by hand:

- PGN to pack converter for Lichess studies (variations, comments, arrows and highlights)
- Lichess opening explorer statistics for 629 positions in three rating groups
- Move evaluations from the Lichess cloud and Stockfish, with a time budget and resume support
- Coverage report that lists gaps in the repertoire
- Engine check: all 290 White moves of the course verified by Stockfish at depth 18

The pipelines run in GitHub Actions (`data-pipeline.yml`).

## Repository structure

| Path              | Contents                                                                                                    |
| ----------------- | ----------------------------------------------------------------------------------------------------------- |
| `apps/mobile`     | Expo app (Android and web), routes in `src/app` (Expo Router)                                               |
| `packages/core`   | Pure TypeScript logic without UI: chess model, opening tree, spaced repetition, move selection. Unit-tested |
| `packages/ui`     | Design tokens, themes, board and shared components                                                          |
| `packs/`          | Opening sources (PGN and metadata) and the pack JSON schema                                                 |
| `tools/pipeline/` | Pack generation from Lichess data                                                                           |
| `docs/`           | Roadmap and store materials                                                                                 |

## Development

```bash
npm install          # npm workspaces
npm run web          # dev server in the browser
npm run android      # dev server for an emulator or device
npm test             # unit tests for packages/*
npm run typecheck    # TypeScript across all packages
npm run lint         # ESLint
npm run format       # Prettier
```

Add app dependencies with `npx expo install <package>` from `apps/mobile`, so versions match the Expo SDK.

## Builds and release signing

GitHub Actions (`.github/workflows/build.yml`) runs tests, publishes the web version to the `gh-pages` branch and builds an APK and AAB on every push.

To sign builds for Google Play:

1. Create a key and keep a backup. Losing it means the app can no longer be updated.

   ```bash
   keytool -genkeypair -v -keystore chess-open.keystore -alias chess-open -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add repository secrets: `ANDROID_KEYSTORE_BASE64` (output of `base64 -w0 chess-open.keystore`), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`.
3. The next build signs the APK and AAB with this key. Enable Play App Signing in the Play Console.

## Status

See [docs/ROADMAP.md](docs/ROADMAP.md).

## License

[GPL-3.0-or-later](LICENSE) © Vadym Zelenko. Piece sets and fonts keep their own licenses, listed in the app on the Licenses screen.
