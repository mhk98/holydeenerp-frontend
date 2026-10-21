import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/locales/en/common.json';
import bn from '@/locales/bn/common.json';
import { useSettingsStore } from '@/stores/settings-store';

export const LANGUAGES = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'bn', label: 'বাংলা', short: 'বাং' },
] as const;

const initialLanguage = useSettingsStore.getState().language;

i18n.use(initReactI18next).init({
  resources: { en: { common: en }, bn: { common: bn } },
  lng: initialLanguage,
  fallbackLng: 'en',
  defaultNS: 'common',
  interpolation: { escapeValue: false },
});

function syncDocumentLang(lng: string) {
  document.documentElement.lang = lng;
}
syncDocumentLang(initialLanguage);

// Keep i18next and <html lang> in sync with the persisted language setting.
useSettingsStore.subscribe((state, prev) => {
  if (state.language !== prev.language) {
    i18n.changeLanguage(state.language);
    syncDocumentLang(state.language);
  }
});

export default i18n;
