import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { supabase, isConfigured } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';

// Fire this event (e.g. from the navbar "?" button) to replay the tutorial.
export const OPEN_ONBOARDING_EVENT = 'open-onboarding';

const inputStyle = {
  width: '100%', padding: '9px 13px',
  border: '1px solid rgba(200,184,154,0.5)',
  fontSize: '14px', color: '#2C3025',
  backgroundColor: 'rgba(255,255,255,0.6)',
  outline: 'none', fontFamily: 'inherit',
  borderRadius: '8px', boxSizing: 'border-box',
};

const labelStyle = {
  display: 'block', fontSize: '11px', fontWeight: 700,
  color: '#9a8570', marginBottom: '5px', letterSpacing: '0.08em',
};

// Feature walkthrough pages (between the welcome page and the profile page)
const FEATURES = [
  {
    key: 'review',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
        <path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" y1="19" x2="12" y2="22" />
      </svg>
    ),
    titleKey: 'onboard.feature_review_title',
    descKey: 'onboard.feature_review_desc',
  },
  {
    key: 'leaderboard',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" /><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
        <path d="M4 22h16" /><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" /><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
      </svg>
    ),
    titleKey: 'onboard.feature_leaderboard_title',
    descKey: 'onboard.feature_leaderboard_desc',
  },
  {
    key: 'discover',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
      </svg>
    ),
    titleKey: 'onboard.feature_discover_title',
    descKey: 'onboard.feature_discover_desc',
  },
  {
    key: 'social',
    icon: (
      <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
    titleKey: 'onboard.feature_social_title',
    descKey: 'onboard.feature_social_desc',
  },
];

export default function OnboardingModal() {
  const { t } = useLanguage();
  const user = useUser();
  const fileInputRef = useRef(null);

  // Wizard step: 0 = welcome, 1..FEATURES.length = features, last = profile form
  const PROFILE_STEP = FEATURES.length + 1;
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState(1);

  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [bio, setBio] = useState('');
  const [honors, setHonors] = useState(['', '', '', '', '']);
  const [wechat, setWechat] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [avatarPreview, setAvatarPreview] = useState(null);
  const [avatarFile, setAvatarFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Replay mode: opened manually via the navbar "?" button (profile already done)
  const [forceOpen, setForceOpen] = useState(false);
  useEffect(() => {
    const handler = () => { setStep(0); setDir(1); setForceOpen(true); };
    window.addEventListener(OPEN_ONBOARDING_EVENT, handler);
    return () => window.removeEventListener(OPEN_ONBOARDING_EVENT, handler);
  }, []);

  if (!user.profileLoaded || !user.id) return null;
  // Auto-show for brand-new users (no name yet); otherwise only when replayed.
  if (user.name && !forceOpen) return null;

  // First-time users finish on the profile-completion step; replays end on the
  // last feature page (no need to re-enter their profile).
  const firstTime = !user.name;
  const lastStep = firstTime ? PROFILE_STEP : FEATURES.length;

  function close() { setForceOpen(false); setStep(0); }

  function goNext() { setDir(1); setStep(s => Math.min(s + 1, lastStep)); }
  function goBack() { setDir(-1); setStep(s => Math.max(s - 1, 0)); }

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('onboard.name_required')); return; }
    setSaving(true);
    setError('');

    let avatarUrl = null;
    if (avatarFile && isConfigured && user.id) {
      const ext = avatarFile.name.split('.').pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('avatars').upload(path, avatarFile, { upsert: true });
      if (!uploadErr) {
        const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path);
        avatarUrl = publicUrl;
      }
    }

    const updates = {
      name: name.trim(),
      team: team.trim(),
      bio: bio.trim(),
      honors: honors.filter(h => h.trim()),
      user_wechat: wechat.trim(),
      is_public: isPublic,
      ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
    };

    if (isConfigured && user.id) {
      await supabase.from('profiles').update(updates).eq('id', user.id);
    }

    user.setName(name.trim());
    user.setTeam(team.trim());
    user.setBio(bio.trim());
    user.setHonors(honors.filter(h => h.trim()).concat(['', '', '', '', '']).slice(0, 5));
    user.setWechat(wechat.trim());
    user.setIsPublic(isPublic);
    if (avatarUrl) user.setAvatarUrl(avatarUrl);

    setSaving(false);
    // Modal unmounts automatically once user.name is set
  }

  const totalSteps = lastStep + 1;

  return (
    <div
      onClick={forceOpen ? close : undefined}
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        backgroundColor: 'rgba(44,48,37,0.6)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '24px',
      }}
    >
      <motion.div
        onClick={e => e.stopPropagation()}
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        style={{
          width: '100%', maxWidth: '480px',
          background: '#F2EDE4', borderRadius: '20px',
          padding: '36px 32px', maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '20px',
          position: 'relative',
        }}
      >
        {/* Close button — only in replay mode (first-time users must finish) */}
        {forceOpen && (
          <button
            onClick={close}
            aria-label={t('onboard.close')}
            style={{
              position: 'absolute', top: '16px', right: '16px',
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: '#9a8570', padding: '4px', lineHeight: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        )}

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{
              width: i === step ? '20px' : '6px', height: '6px', borderRadius: '3px',
              background: i === step ? '#2C3025' : 'rgba(154,133,112,0.35)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>

        <AnimatePresence mode="wait" custom={dir}>
          {/* ---------- WELCOME ---------- */}
          {step === 0 && (
            <motion.div key="welcome"
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '18px', textAlign: 'center' }}
            >
              <div>
                <h1 style={{ fontSize: '30px', fontWeight: 900, color: '#2C3025', letterSpacing: '0.14em', marginBottom: '10px' }}>
                  {t('onboard.welcome')}
                </h1>
                <div style={{ width: '32px', height: '2px', background: '#a4b9b5', margin: '0 auto' }} />
              </div>
              <p style={{ fontSize: '14px', color: '#6b5c45', lineHeight: 1.7, margin: 0 }}>
                {t('onboard.welcome_sub_1')}<br />
                {t('onboard.welcome_sub_2')}
              </p>
            </motion.div>
          )}

          {/* ---------- FEATURE PAGES ---------- */}
          {step >= 1 && step <= FEATURES.length && (() => {
            const f = FEATURES[step - 1];
            return (
              <motion.div key={f.key}
                custom={dir}
                initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }}
                transition={{ duration: 0.25 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '18px', textAlign: 'center', padding: '8px 0' }}
              >
                <div style={{
                  width: '68px', height: '68px', borderRadius: '18px',
                  background: '#2C3025', color: '#E8E4DC',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {f.icon}
                </div>
                <h2 style={{ fontSize: '21px', fontWeight: 800, color: '#2C3025', margin: 0, letterSpacing: '0.04em' }}>
                  {t(f.titleKey)}
                </h2>
                <p style={{ fontSize: '14px', color: '#6b5c45', lineHeight: 1.75, margin: 0, maxWidth: '340px' }}>
                  {t(f.descKey)}
                </p>
              </motion.div>
            );
          })()}

          {/* ---------- PROFILE FORM ---------- */}
          {step === PROFILE_STEP && (
            <motion.div key="profile"
              custom={dir}
              initial={{ opacity: 0, x: dir * 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: dir * -40 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}
            >
              <div style={{ textAlign: 'center' }}>
                <h2 style={{ fontSize: '20px', fontWeight: 800, color: '#2C3025', margin: '0 0 6px' }}>
                  {t('onboard.profile_step_title')}
                </h2>
                <p style={{ fontSize: '13px', color: '#9a8570', margin: 0 }}>{t('onboard.profile_step_sub')}</p>
              </div>

              {/* Avatar */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    background: '#2C3025', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#E8E4DC', fontSize: '28px', fontWeight: 700,
                    border: '3px solid rgba(164,185,181,0.5)', cursor: 'pointer',
                    overflow: 'hidden', position: 'relative',
                  }}
                >
                  {avatarPreview
                    ? <img src={avatarPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                    : <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="rgba(232,228,220,0.6)" strokeWidth="1.5" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  }
                </div>
                <span style={{ fontSize: '11px', color: '#a4b9b5' }}>{t('onboard.avatar_hint')}</span>
                <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
              </div>

              {/* Name */}
              <div>
                <label style={labelStyle}>{t('onboard.nickname')} <span style={{ color: '#a03030' }}>*</span></label>
                <input style={inputStyle} placeholder={t('onboard.nickname_placeholder')} value={name} onChange={e => { setName(e.target.value); setError(''); }} />
              </div>

              {/* Team */}
              <div>
                <label style={labelStyle}>{t('onboard.team')}</label>
                <input style={inputStyle} placeholder={t('onboard.team_placeholder')} value={team} onChange={e => setTeam(e.target.value)} />
              </div>

              {/* Bio */}
              <div>
                <label style={labelStyle}>{t('onboard.bio')}</label>
                <textarea
                  style={{ ...inputStyle, resize: 'none', height: '88px', lineHeight: 1.6 }}
                  placeholder={t('onboard.bio_placeholder')}
                  value={bio}
                  onChange={e => {
                    const lines = e.target.value.split('\n');
                    if (lines.length > 4) return;
                    if ([...e.target.value].length > 100) return;
                    setBio(e.target.value);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      if (bio.split('\n').length >= 4) e.preventDefault();
                    }
                  }}
                />
                <div style={{ fontSize: '11px', color: '#a4b9b5', textAlign: 'right', marginTop: '3px' }}>
                  {t('onboard.char_count', { len: [...bio].length, lines: bio.split('\n').length })}
                </div>
              </div>

              {/* Honors */}
              <div>
                <label style={labelStyle}>{t('onboard.honors')}</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {honors.map((h, i) => (
                    <input key={i} style={{ ...inputStyle, fontSize: '13px' }}
                      placeholder={t('onboard.honor_placeholder', { n: i + 1 })} value={h}
                      onChange={e => { const n = [...honors]; n[i] = e.target.value; setHonors(n); }} />
                  ))}
                </div>
              </div>

              {/* WeChat */}
              <div>
                <label style={labelStyle}>{t('onboard.wechat')} <span style={{ color: '#a4b9b5', fontWeight: 400 }}>{t('onboard.wechat_hint')}</span></label>
                <input style={inputStyle} placeholder={t('onboard.wechat_placeholder')} value={wechat} onChange={e => setWechat(e.target.value)} />
              </div>

              {/* Public / Private */}
              <div>
                <label style={labelStyle}>{t('onboard.visibility')}</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[{ val: true, label: t('onboard.public_label'), desc: t('onboard.public_desc') }, { val: false, label: t('onboard.private_label'), desc: t('onboard.private_desc') }].map(({ val, label, desc }) => (
                    <motion.div key={String(val)} whileTap={{ scale: 0.97 }} onClick={() => setIsPublic(val)}
                      style={{
                        flex: 1, padding: '10px 14px', borderRadius: '10px', cursor: 'pointer',
                        border: `1px solid ${isPublic === val ? '#a4b9b5' : 'rgba(200,184,154,0.4)'}`,
                        background: isPublic === val ? 'rgba(164,185,181,0.12)' : 'rgba(255,255,255,0.3)',
                      }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#2C3025', margin: '0 0 2px' }}>{label}</p>
                      <p style={{ fontSize: '11px', color: '#9a8570', margin: 0 }}>{desc}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {error && (
                <p style={{ fontSize: '13px', color: '#a03030', background: 'rgba(160,48,48,0.06)', border: '1px solid rgba(160,48,48,0.2)', borderRadius: '8px', padding: '10px 14px', margin: 0 }}>
                  {error}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ---------- NAV BUTTONS ---------- */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '4px' }}>
          {step > 0 && (
            <motion.button
              whileTap={{ scale: 0.98 }} onClick={goBack}
              style={{
                padding: '13px 22px', background: 'transparent',
                color: '#6b5c45', border: '1px solid rgba(200,184,154,0.6)',
                borderRadius: '12px', fontSize: '14px', fontWeight: 600,
                cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0,
              }}
            >
              {t('onboard.back')}
            </motion.button>
          )}
          {step < lastStep ? (
            <motion.button
              whileTap={{ scale: 0.98 }} onClick={goNext}
              style={{
                flex: 1, padding: '13px', background: '#2C3025',
                color: '#E8E4DC', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.1em',
              }}
            >
              {step === 0 ? t('onboard.begin') : t('onboard.next')}
            </motion.button>
          ) : firstTime ? (
            <motion.button
              whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
              style={{
                flex: 1, padding: '13px',
                background: saving ? '#9a8570' : '#2C3025',
                color: '#E8E4DC', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.1em',
              }}
            >
              {saving ? t('onboard.saving') : t('onboard.finish')}
            </motion.button>
          ) : (
            <motion.button
              whileTap={{ scale: 0.98 }} onClick={close}
              style={{
                flex: 1, padding: '13px', background: '#2C3025',
                color: '#E8E4DC', border: 'none', borderRadius: '12px',
                fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                fontFamily: 'inherit', letterSpacing: '0.1em',
              }}
            >
              {t('onboard.finish_replay')}
            </motion.button>
          )}
        </div>

        {/* Skip walkthrough link — first-time users only (jumps to profile) */}
        {firstTime && step >= 1 && step < PROFILE_STEP && (
          <button
            onClick={() => { setDir(1); setStep(PROFILE_STEP); }}
            style={{
              background: 'transparent', border: 'none', color: '#a4b9b5',
              fontSize: '12px', fontFamily: 'inherit', cursor: 'pointer',
              marginTop: '-8px',
            }}
          >
            {t('onboard.skip_to_profile')}
          </button>
        )}
      </motion.div>
    </div>
  );
}
