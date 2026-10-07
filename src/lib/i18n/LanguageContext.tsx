'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, dictionaries, languages, Translations } from './translations';

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: Translations;
  dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType>({
  lang: 'en',
  setLang: () => {},
  t: dictionaries.en,
  dir: 'ltr',
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Language>('en');

  // Load language preference from localStorage if available
  useEffect(() => {
    const saved = localStorage.getItem('wifi_app_lang') as Language;
    if (saved && languages[saved]) {
      setLangState(saved);
    }
  }, []);

  const setLang = (newLang: Language) => {
    setLangState(newLang);
    localStorage.setItem('wifi_app_lang', newLang);
  };

  const dir = languages[lang].dir;

  return (
    <LanguageContext.Provider value={{ lang, setLang, t: dictionaries[lang], dir }}>
      <div dir={dir} className={dir === 'rtl' ? 'font-sans rtl' : 'font-sans'}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
