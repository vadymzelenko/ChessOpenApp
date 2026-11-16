import { getLocales } from 'expo-localization';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { Platform } from 'react-native';

import en from './locales/en.json';
import pl from './locales/pl.json';
import ru from './locales/ru.json';
import uk from './locales/uk.json';

/** RU is the source language; UA, PL, EN follow (ТЗ §2, §8). */
export const SUPPORTED_LANGUAGES = ['ru', 'uk', 'pl', 'en'] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export function detectLanguage(): Language {
  const code = getLocales()[0]?.languageCode ?? 'ru';
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(code) ? (code as Language) : 'ru';
}

void i18n.use(initReactI18next).init({
  resources: {
    ru: { translation: ru },
    uk: { translation: uk },
    pl: { translation: pl },
    en: { translation: en },
  },
  // Web pages are pre-rendered statically in the source language; the device
  // language is applied after hydration (see applyDeviceLanguage) so the
  // client markup matches the server markup.
  lng: Platform.OS === 'web' ? 'ru' : detectLanguage(),
  fallbackLng: 'ru',
  interpolation: { escapeValue: false },
  returnNull: false,
});

/** Apply the language setting ('auto' = device language). Call after the first client render. */
export function applyLanguage(setting: Language | 'auto'): void {
  const lang = setting === 'auto' ? detectLanguage() : setting;
  if (i18n.language !== lang) void i18n.changeLanguage(lang);
}

export default i18n;
