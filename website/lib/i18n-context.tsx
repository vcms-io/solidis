'use client';

import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';

import en from '@/i18n/messages/en.json';
import ko from '@/i18n/messages/ko.json';

type Locale = 'en' | 'ko';
type Messages = typeof en;

interface I18nContextType {
  locale: Locale;
  messages: Messages;
  setLocale: (locale: Locale) => void;
  t: (key: string, values?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

const translations: Record<Locale, Messages> = {
  en,
  ko,
};

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('locale');

      if (saved === 'en' || saved === 'ko') {
        setLocaleState(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (newLocale: Locale) => {
    setLocaleState(newLocale);

    try {
      localStorage.setItem('locale', newLocale);
    } catch {}
  };

  const t = (key: string, values?: Record<string, string | number>): string => {
    const keys = key.split('.');
    let value: unknown = translations[locale];

    for (const segment of keys) {
      if (value && typeof value === 'object' && segment in value) {
        value = (value as Record<string, unknown>)[segment];
      } else {
        return key; // Return key if not found
      }
    }

    return typeof value === 'string'
      ? value.replace(/\{(\w+)\}/g, (placeholder, name: string) =>
          String(values?.[name] ?? placeholder),
        )
      : key;
  };

  return (
    <I18nContext.Provider
      value={{ locale, messages: translations[locale], setLocale, t }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
