export * from './model';
export * from './schemas';
export { default as ru } from './i18n/ru.json';
export { default as en } from './i18n/en.json';

import { initReactI18next } from 'react-i18next';
import i18next from 'i18next';
import ruDict from './i18n/ru.json';
import enDict from './i18n/en.json';

/** Единый i18n-слой (NFR §9): без хардкода строк, форматирование — Intl на вызовах. */
export function initI18n(lng: 'ru' | 'en' = 'ru') {
  if (!i18next.isInitialized) {
    i18next.use(initReactI18next).init({
      resources: { ru: { translation: ruDict }, en: { translation: enDict } },
      lng,
      fallbackLng: 'ru',
      interpolation: { escapeValue: false },
      returnNull: false,
    });
  } else if (i18next.language !== lng) {
    void i18next.changeLanguage(lng);
  }
  return i18next;
}

/** Проброс форматтеров Intl (кэшируются i18next Intl API не нужен — прямые Intl). */
export const fmt = {
  date: (ts: number, locale: string, tz?: string) =>
    new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: tz }).format(new Date(ts)),
  time: (ts: number, locale: string, tz?: string) =>
    new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(ts)),
  dist: (meters: number, units: 'metric' | 'imperial') =>
    units === 'metric'
      ? new Intl.NumberFormat('ru', { maximumFractionDigits: 0 }).format(meters)
      : new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(Math.round(meters * 1.09361)),
};

/** Формат "to par": E, +2, −1 (знак минус типографский). */
export function toParLabel(v: number): string {
  if (v === 0) return 'E';
  return v > 0 ? `+${v}` : `−${Math.abs(v)}`;
}
