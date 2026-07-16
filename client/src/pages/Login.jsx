import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase, isConfigured } from '../lib/supabase';
import { useLanguage } from '../contexts/LanguageContext';
import TurnstileWidget, { TURNSTILE_SITE_KEY } from '../components/TurnstileWidget';

export default function Login() {
  const navigate = useNavigate();
  const { t, lang, setLang } = useLanguage();
  const accent = lang === 'en' ? '#8aa0c8' : '#a4b9b5';
  const accentSoft = lang === 'en' ? 'rgba(138,160,200,0.15)' : 'rgba(164,185,181,0.15)';
  const [mode, setMode] = useState('login');
  const [loginMethod, setLoginMethod] = useState('email');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [form, setForm] = useState({ name: '', username: '', email: '', loginUsername: '', password: '' });
  const [captchaToken, setCaptchaToken] = useState('');
  const [captchaResetKey, setCaptchaResetKey] = useState(0);
  const [showPwd, setShowPwd] = useState(false);

  // token 单次有效，验证失败后重置小组件让用户重新验证
  function resetCaptcha() {
    setCaptchaToken('');
    setCaptchaResetKey(k => k + 1);
  }

  function setField(k, v) {
    setForm(f => ({ ...f, [k]: v }));
    setError('');
    setSuccess('');
  }

  function switchMode(m) {
    setMode(m);
    setError('');
    setSuccess('');
  }

  function switchLoginMethod(m) {
    setLoginMethod(m);
    setError('');
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoading(true);
    setError('');
    if (!isConfigured) { navigate('/discover'); return; }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setError(t('login.err_captcha')); setLoading(false); return; }

    let email = form.email;

    if (loginMethod === 'username') {
      if (!form.loginUsername.trim()) { setError(t('login.err_username_required')); setLoading(false); return; }
      const { data: foundEmail, error: lookupError } = await supabase
        .rpc('get_email_by_username', { p_username: form.loginUsername.toLowerCase() });

      if (lookupError || !foundEmail) {
        setError(t('login.err_username_not_found'));
        setLoading(false);
        return;
      }
      email = foundEmail;
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: form.password,
      options: { captchaToken: captchaToken || undefined },
    });
    if (signInError) {
      setError(t('login.err_credentials'));
      resetCaptcha();
      setLoading(false);
      return;
    }
    navigate('/discover');
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!form.name.trim()) { setError(t('login.err_nickname_required')); return; }
    if (!form.username.trim()) { setError(t('login.err_username_required')); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(form.username)) { setError(t('login.err_username_chars')); return; }
    if (!form.email.trim()) { setError(t('login.err_email_required')); return; }
    if (form.password.length < 6) { setError(t('login.err_password_len')); return; }
    if (TURNSTILE_SITE_KEY && !captchaToken) { setError(t('login.err_captcha')); return; }

    setLoading(true);
    setError('');

    if (!isConfigured) {
      navigate('/discover');
      return;
    }

    const { data: available } = await supabase.rpc('is_username_available', { p_username: form.username });
    if (!available) {
      setError(t('login.err_username_taken'));
      setLoading(false);
      return;
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        captchaToken: captchaToken || undefined,
        // Passed to the handle_new_user() DB trigger, which creates the
        // profile row server-side. Needed because with email confirmation on,
        // signUp returns no session and a client-side insert would be blocked by RLS.
        data: {
          username: form.username.toLowerCase(),
          name: form.name.trim(),
        },
      },
    });

    if (signUpError) {
      resetCaptcha();
      const msg = signUpError.message || '';
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError(t('login.err_email_taken'));
      } else {
        setError(msg || t('login.err_register_failed'));
      }
      setLoading(false);
      return;
    }

    // The profile row is created by the handle_new_user() DB trigger from the
    // metadata above. When a session exists (email confirmation disabled), we
    // still upsert client-side to fill in any extra fields immediately.
    if (data.user && data.session) {
      await supabase.from('profiles').upsert({
        id: data.user.id,
        username: form.username.toLowerCase(),
        name: form.name.trim(),
        email: form.email.toLowerCase(),
        school: '',
        region: '',
        bio: '',
        team: '',
        honors: [],
        is_public: true,
        avg_score: 0,
        credits: 3,
      });
    }

    if (data.session) {
      navigate('/discover');
    } else {
      setSuccess(t('login.register_success'));
      setLoading(false);
      setMode('login');
    }
  }

  const inputStyle = {
    width: '100%', padding: '10px 14px',
    border: '1px solid rgba(200,184,154,0.6)',
    fontSize: '14px', color: '#2C3025',
    backgroundColor: 'rgba(255,255,255,0.5)',
    outline: 'none', borderRadius: '8px',
    fontFamily: 'inherit', letterSpacing: '0.02em',
    transition: 'border-color 0.15s, background-color 0.15s',
  };

  const labelStyle = {
    display: 'block', fontSize: '11px', fontWeight: 700,
    color: '#9a8570', marginBottom: '6px', letterSpacing: '0.1em',
    textTransform: 'uppercase',
  };

  return (
    <div style={{
      minHeight: '100dvh',
      backgroundColor: '#E8E4DC',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Language toggle */}
      <button type="button" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}
        title={lang === 'zh' ? 'Switch to English' : '切换中文'}
        style={{
          position: 'absolute', top: '20px', right: '20px', zIndex: 2,
          background: 'rgba(44,48,37,0.06)', border: '1px solid rgba(44,48,37,0.12)',
          borderRadius: '14px', padding: '4px 12px', cursor: 'pointer',
          fontSize: '11px', fontWeight: 700, color: '#6b5c45',
          fontFamily: 'inherit', letterSpacing: '0.06em',
          display: 'flex', alignItems: 'center', gap: '4px', lineHeight: 1.4,
        }}>
        <span style={{ opacity: lang === 'zh' ? 1 : 0.4 }}>中</span>
        <span style={{ opacity: 0.3, fontSize: '9px' }}>|</span>
        <span style={{ opacity: lang === 'en' ? 1 : 0.4 }}>EN</span>
      </button>

      {/* Background watermark */}
      <div style={{
        position: 'absolute', left: '50%', top: '50%',
        transform: 'translate(-50%, -50%)',
        fontSize: '380px', fontWeight: 900,
        color: 'rgba(44,48,37,0.04)', filter: 'blur(2px)',
        lineHeight: 1, userSelect: 'none', pointerEvents: 'none',
        letterSpacing: '-0.05em',
      }}>{lang === 'en' ? 'D' : '辩'}</div>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ width: '100%', maxWidth: '420px', position: 'relative' }}
      >
        {/* App name */}
        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <h1 style={{
            color: '#2C3025', fontSize: '40px', fontWeight: 900,
            marginBottom: '8px', letterSpacing: '0.18em',
            textShadow: '0 2px 12px rgba(44,48,37,0.08)',
          }}>
            撇捺
          </h1>
          <div style={{ width: '32px', height: '2px', backgroundColor: accent, margin: '0 auto 12px' }} />
          <p style={{ color: '#9a8570', fontSize: '12px', letterSpacing: '0.1em', fontWeight: 600 }}>
            {t('login.subtitle')}
          </p>
        </div>

        {/* Card */}
        <div className="glass-card" style={{ padding: '32px' }}>
          {/* Mode toggle */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(200,184,154,0.4)', marginBottom: '24px' }}>
            {['login', 'register'].map(m => (
              <button key={m} type="button" onClick={() => switchMode(m)}
                style={{
                  flex: 1, padding: '10px', border: 'none', cursor: 'pointer',
                  fontSize: '13px', fontWeight: mode === m ? 700 : 400,
                  fontFamily: 'inherit', letterSpacing: '0.06em',
                  backgroundColor: 'transparent',
                  color: mode === m ? '#2C3025' : '#9a8570',
                  borderBottom: mode === m ? `2px solid ${accent}` : '2px solid transparent',
                  marginBottom: '-1px', transition: 'all 0.15s',
                }}
              >
                {m === 'login' ? t('login.login') : t('login.register')}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            <motion.form
              key={mode}
              initial={{ opacity: 0, x: mode === 'login' ? -12 : 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onSubmit={mode === 'login' ? handleLogin : handleRegister}
            >
              {mode === 'login' && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '20px' }}>
                  {['email', 'username'].map(m => (
                    <button key={m} type="button" onClick={() => switchLoginMethod(m)}
                      style={{
                        flex: 1, padding: '7px', borderRadius: '8px',
                        border: `1px solid ${loginMethod === m ? accent : 'rgba(200,184,154,0.5)'}`,
                        cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit', letterSpacing: '0.05em',
                        fontWeight: loginMethod === m ? 700 : 400,
                        backgroundColor: loginMethod === m ? accentSoft : 'transparent',
                        color: loginMethod === m ? '#2C3025' : '#9a8570',
                        transition: 'all 0.15s',
                      }}
                    >
                      {m === 'email' ? t('login.email') : t('login.username')}
                    </button>
                  ))}
                </div>
              )}

              {mode === 'register' && (
                <>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>{t('login.nickname')} <span style={{ color: '#a03030' }}>*</span></label>
                    <input style={inputStyle} placeholder={t('login.ph_nickname')} value={form.name}
                      onChange={e => setField('name', e.target.value)} required />
                  </div>
                  <div style={{ marginBottom: '16px' }}>
                    <label style={labelStyle}>{t('login.username')} <span style={{ color: '#a03030' }}>*</span></label>
                    <input style={inputStyle} placeholder={t('login.ph_username')} value={form.username}
                      onChange={e => setField('username', e.target.value)} required autoComplete="username" />
                  </div>
                </>
              )}

              {mode === 'login' && loginMethod === 'username' && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t('login.username')} <span style={{ color: '#a03030' }}>*</span></label>
                  <input style={inputStyle} placeholder={t('login.ph_login_username')} value={form.loginUsername}
                    onChange={e => setField('loginUsername', e.target.value)} required autoComplete="username" />
                </div>
              )}

              {(mode === 'register' || (mode === 'login' && loginMethod === 'email')) && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={labelStyle}>{t('login.email')} <span style={{ color: '#a03030' }}>*</span></label>
                  <input style={inputStyle} type="email" placeholder="your@email.com" value={form.email}
                    onChange={e => setField('email', e.target.value)} required autoComplete="email" />
                </div>
              )}

              <div style={{ marginBottom: '24px' }}>
                <label style={labelStyle}>{t('login.password')} <span style={{ color: '#a03030' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input style={{ ...inputStyle, paddingRight: '42px' }} type={showPwd ? 'text' : 'password'}
                    placeholder={mode === 'register' ? t('login.ph_password_register') : t('login.ph_password_login')}
                    value={form.password} onChange={e => setField('password', e.target.value)}
                    required autoComplete={mode === 'register' ? 'new-password' : 'current-password'} />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9a8570', padding: '4px', display: 'flex', alignItems: 'center' }}>
                    {showPwd
                      ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                      : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    }
                  </button>
                </div>
              </div>

              <TurnstileWidget onToken={setCaptchaToken} resetKey={captchaResetKey} />

              {error && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid rgba(160,48,48,0.2)',
                  color: '#a03030', fontSize: '13px', marginBottom: '16px',
                  backgroundColor: 'rgba(160,48,48,0.06)',
                }}>{error}</div>
              )}

              {success && (
                <div style={{
                  padding: '10px 14px', borderRadius: '8px',
                  border: '1px solid rgba(90,143,122,0.2)',
                  color: '#5a8f7a', fontSize: '13px', marginBottom: '16px',
                  backgroundColor: 'rgba(90,143,122,0.06)',
                }}>{success}</div>
              )}

              <motion.button
                type="submit" disabled={loading}
                className="btn-shimmer"
                whileHover={loading ? {} : { scale: 1.01 }}
                whileTap={loading ? {} : { scale: 0.98 }}
                style={{
                  width: '100%', padding: '13px',
                  backgroundColor: loading ? '#9a8570' : '#2C3025',
                  color: '#E8E4DC', border: 'none', borderRadius: '10px',
                  fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', letterSpacing: '0.12em',
                  transition: 'background-color 0.15s',
                }}
              >
                {loading
                  ? (mode === 'login' ? t('login.logging_in') : t('login.registering'))
                  : mode === 'login' ? t('login.login') : t('login.register')}
              </motion.button>
            </motion.form>
          </AnimatePresence>
        </div>

        <p style={{ textAlign: 'center', marginTop: '20px', fontSize: '11px', color: '#9a8570', letterSpacing: '0.04em' }}>
          {t('login.email_footer')}
        </p>
      </motion.div>
    </div>
  );
}
