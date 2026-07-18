import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
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

  // Full-screen sweep played when the language changes.
  const [sweep, setSweep] = useState(null); // target lang while animating, else null
  const sweepTimers = useRef([]);

  const setLang = async (l) => {
    if (l === lang) return;
    // clear any in-flight sweep timers so rapid toggles don't collide
    sweepTimers.current.forEach(clearTimeout);
    sweepTimers.current = [];
    setSweep(l);
    // swap the actual language once the panel fully covers the screen
    sweepTimers.current.push(setTimeout(() => setLangState(l), SWEEP_MS * 0.45));
    // remove the overlay after it wipes away
    sweepTimers.current.push(setTimeout(() => setSweep(null), SWEEP_MS));
    if (isConfigured && authUser) {
      await supabase.from('profiles').update({ language: l }).eq('id', authUser.id);
    }
  };

  const t = (key, vars) => resolve(lang, key, vars);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
      <LanguageSweep target={sweep} />
    </LanguageContext.Provider>
  );
}

const SWEEP_MS = 900;

const SWEEP_THEME = {
  en: { grad: 'linear-gradient(135deg, #3d5a8a 0%, #6d8ac2 55%, #8aa0c8 100%)', glyph: 'EN', label: 'English' },
  zh: { grad: 'linear-gradient(135deg, #2f5248 0%, #5a8f7a 55%, #7d9b96 100%)', glyph: '辩', label: '中文' },
};

function LanguageSweep({ target }) {
  const theme = target ? SWEEP_THEME[target] : null;
  return (
    <AnimatePresence>
      {theme && (
        <motion.div
          key={target}
          initial={{ x: '101%' }}
          animate={{ x: ['101%', '0%', '0%', '-101%'] }}
          exit={{ opacity: 0 }}
          transition={{ duration: SWEEP_MS / 1000, times: [0, 0.42, 0.5, 1], ease: [0.76, 0, 0.24, 1] }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: theme.grad, pointerEvents: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '18px', color: 'rgba(255,255,255,0.96)',
          }}
        >
          <motion.span
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: [0.6, 1, 1, 0.85], opacity: [0, 1, 1, 0] }}
            transition={{ duration: SWEEP_MS / 1000, times: [0, 0.42, 0.62, 1], ease: 'easeOut' }}
            style={{ fontSize: '96px', fontWeight: 900, lineHeight: 1, letterSpacing: '0.04em', textShadow: '0 4px 30px rgba(0,0,0,0.25)' }}
          >
            {theme.glyph}
          </motion.span>
          <motion.span
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: [0, 1, 1, 0], y: [10, 0, 0, -6] }}
            transition={{ duration: SWEEP_MS / 1000, times: [0, 0.45, 0.62, 1], ease: 'easeOut' }}
            style={{ fontSize: '22px', fontWeight: 700, letterSpacing: '0.18em' }}
          >
            {theme.label}
          </motion.span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export const useLanguage = () => useContext(LanguageContext);
