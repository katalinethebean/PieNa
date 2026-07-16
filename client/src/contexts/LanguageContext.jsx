import { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { useAuth } from './AuthContext';
import zh from '../i18n/zh';
import en from '../i18n/en';

const LanguageContext = createContext(null);
const STORAGE_KEY = 'piena_lang';

function resolve(lang, key, vars = {}) {
  const dict = lang === 'en' ? en : zh;
  let str = dict[key] ?? zh[key] ?? key;
  Object.entries(vars).forEach(([k, v]) => { str = str.replace(`{${k}}`, v); });
  return str;
}

export function LanguageProvider({ children }) {
  const { user: authUser } = useAuth();
  const [lang, setLangState] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'en' ? 'en' : 'zh';
  });

  // Apply data-universe attribute on html element for CSS theming
  useEffect(() => {
    document.documentElement.setAttribute('data-universe', lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, [lang]);

  // Sync from profile on login
  useEffect(() => {
    if (!isConfigured || !authUser) return;
    supabase.from('profiles').select('language').eq('id', authUser.id).single()
      .then(({ data }) => {
        if (data?.language && data.language !== lang) {
          setLangState(data.language);
        }
      });
  }, [authUser]);

  const setLang = async (l) => {
    setLangState(l);
    if (isConfigured && authUser) {
      await supabase.from('profiles').update({ language: l }).eq('id', authUser.id);
    }
  };

  const t = (key, vars) => resolve(lang, key, vars);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
