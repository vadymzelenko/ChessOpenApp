# Chess Open — бесплатный тренажёр шахматных дебютов

Один код для Android (APK/AAB) и Web: Expo (React Native) + TypeScript.

## Как проверить

- **Сайт:** https://vadymzelenko.github.io/ChessOpenApp/ — обновляется после каждого пуша.
  Один раз нужно включить GitHub Pages: _Settings → Pages → Source: Deploy from a branch →
  `gh-pages` / `(root)` → Save_.
- **APK для телефона (последняя сборка):**
  https://github.com/vadymzelenko/ChessOpenApp/releases/latest/download/chess-open.apk
  — открыть ссылку на Android, разрешить установку из браузера.
- **AAB для Google Play:** в той же
  [последней сборке](https://github.com/vadymzelenko/ChessOpenApp/releases/latest). Пока подписан
  debug-ключом — для загрузки в Play нужен свой ключ (модуль 31).

### Подпись для Google Play (один раз)

1. Создать ключ (хранить в надёжном месте с резервной копией — потеря ключа = нельзя обновлять приложение):

   ```bash
   keytool -genkeypair -v -keystore chess-open.keystore -alias chess-open -keyalg RSA -keysize 2048 -validity 10000
   ```

2. В GitHub: _Settings → Secrets and variables → Actions → New repository secret_:
   `ANDROID_KEYSTORE_BASE64` (вывод `base64 -w0 chess-open.keystore`), `ANDROID_KEYSTORE_PASSWORD`,
   `ANDROID_KEY_ALIAS` (`chess-open`), `ANDROID_KEY_PASSWORD`.
3. Следующая сборка подпишет APK и AAB этим ключом. В Play Console включить Play App Signing.

Сборки делает GitHub Actions (`.github/workflows/build.yml`): тесты → сайт → APK + AAB (~10–15 мин).

## Структура

| Путь              | Что внутри                                                          |
| ----------------- | ------------------------------------------------------------------- |
| `apps/mobile`     | Expo-приложение (Android + Web), роуты в `src/app` (Expo Router)    |
| `packages/core`   | Чистая TS-логика без UI (дерево дебюта, SRS, выбор хода). С тестами |
| `packages/ui`     | Дизайн-токены, темы, доска, общие компоненты                        |
| `packs/`          | Исходники дебютов (PGN + метаданные)                                |
| `tools/pipeline/` | Сборка пакетов из данных Lichess                                    |
| `docs/`           | Роадмап по модулям ТЗ                                               |

## Команды

```bash
npm install          # установить всё (npm workspaces)
npm run web          # dev-сервер в браузере
npm run android      # dev-сервер + Android (эмулятор / устройство)
npm test             # юнит-тесты packages/*
npm run typecheck    # TypeScript во всех пакетах
npm run lint         # ESLint
npm run format       # Prettier
```

Новые зависимости в приложение ставить через `npx expo install <pkg>` из `apps/mobile`
(подбирает версии под SDK).

## Статус

См. [docs/ROADMAP.md](docs/ROADMAP.md).
