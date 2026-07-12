import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { supabase, isConfigured } from '../lib/supabase';

// Combobox for 主队: pick an existing team or type a new one (created on save).
export default function TeamPicker({ value, onChange, style, placeholder }) {
  const [focused, setFocused] = useState(false);
  const [teams, setTeams] = useState([]);

  useEffect(() => {
    if (!isConfigured) return;
    supabase.from('teams').select('name').order('name').then(({ data }) => {
      setTeams((data || []).map(t => t.name));
    });
  }, []);

  const query = value || '';
  const suggestions = query.length > 0
    ? teams.filter(t => t.includes(query) && t !== query).slice(0, 6)
    : [];

  return (
    <div style={{ position: 'relative' }}>
      <input
        style={style}
        value={value}
        onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        autoComplete="off"
      />
      <AnimatePresence>
        {focused && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0,
              background: 'rgba(248,244,238,0.98)',
              border: '1px solid rgba(200,184,154,0.5)',
              borderRadius: '10px', zIndex: 50, overflow: 'hidden',
              boxShadow: '0 8px 24px rgba(44,48,37,0.12)',
            }}
          >
            {suggestions.map(t => (
              <div key={t}
                onMouseDown={() => { onChange(t); setFocused(false); }}
                style={{ padding: '9px 14px', cursor: 'pointer', fontSize: '13px', color: '#2C3025', borderBottom: '1px solid rgba(200,184,154,0.15)' }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(200,184,154,0.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              >
                {t}
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
