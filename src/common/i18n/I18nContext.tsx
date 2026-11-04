import React, { createContext, useContext, useState, useEffect } from 'react';
import { en } from '../../locales/en';
import { vi } from '../../locales/vi';
import { loadFromStorage, saveToStorage } from '../utils/storage';

export type Language = 'vi' | 'en';
export type TranslationKey = keyof typeof en;

interface I18nContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const I18nProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    return loadFromStorage<Language>('docqa_language', 'vi');
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveToStorage('docqa_language', lang);
  };

  const translations = language === 'vi' ? vi : en;

  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[key] || en[key] || (key as string);
    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }
    return text;
  };

  return (
    <I18nContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </I18nContext.Provider>
  );
};

const defaultI18n: I18nContextType = {
  language: 'vi',
  setLanguage: () => {},
  t: (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = vi[key] || en[key] || (key as string);
    if (params) {
      Object.entries(params).forEach(([paramKey, val]) => {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(val));
      });
    }
    return text;
  }
};

export const useI18n = () => {
  const context = useContext(I18nContext);
  if (!context) {
    console.warn('[DocQA I18n] Warning: useI18n was called outside an I18nProvider. Returning fallback Vietnamese dictionary.');
    return defaultI18n;
  }
  return context;
};
