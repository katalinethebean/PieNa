import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useUser } from '../contexts/UserContext';
import { supabase, isConfigured } from '../lib/supabase';

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

export default function OnboardingModal() {
  const user = useUser();
  const fileInputRef = useRef(null);

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

  // Only show when profile is loaded and name is still empty
  if (!user.profileLoaded || !user.id || user.name) return null;

  function handleAvatarChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = () => setAvatarPreview(reader.result);
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!name.trim()) { setError('请输入你的姓名'); return; }
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
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      backgroundColor: 'rgba(44,48,37,0.6)',
      backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '24px',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        style={{
          width: '100%', maxWidth: '480px',
          background: '#F2EDE4', borderRadius: '20px',
          padding: '36px 32px', maxHeight: '90vh', overflowY: 'auto',
          display: 'flex', flexDirection: 'column', gap: '20px',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '4px' }}>
          <h1 style={{ fontSize: '26px', fontWeight: 900, color: '#2C3025', letterSpacing: '0.12em', marginBottom: '8px' }}>
            撇捺
          </h1>
          <p style={{ fontSize: '14px', color: '#6b5c45', fontWeight: 500 }}>完善你的辩手档案</p>
          <div style={{ width: '32px', height: '2px', background: '#a4b9b5', margin: '12px auto 0' }} />
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
            <div style={{
              position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              opacity: 0, transition: 'opacity 0.2s', borderRadius: '50%',
            }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            </div>
          </div>
          <span style={{ fontSize: '11px', color: '#a4b9b5' }}>点击上传头像（可选）</span>
          <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarChange} />
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>昵称 <span style={{ color: '#a03030' }}>*</span></label>
          <input style={inputStyle} placeholder="请输入你的昵称" value={name} onChange={e => { setName(e.target.value); setError(''); }} />
        </div>

        {/* Team */}
        <div>
          <label style={labelStyle}>主队</label>
          <input style={inputStyle} placeholder="学校 / 俱乐部 / 机构" value={team} onChange={e => setTeam(e.target.value)} />
        </div>

        {/* Bio */}
        <div>
          <label style={labelStyle}>个人简介</label>
          <textarea
            style={{ ...inputStyle, resize: 'none', height: '88px', lineHeight: 1.6 }}
            placeholder="介绍一下自己…"
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
            {[...bio].length}/100 · {bio.split('\n').length}/4行
          </div>
        </div>

        {/* Honors */}
        <div>
          <label style={labelStyle}>荣誉（最多 5 项）</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {honors.map((h, i) => (
              <input key={i} style={{ ...inputStyle, fontSize: '13px' }}
                placeholder={`荣誉 ${i + 1}`} value={h}
                onChange={e => { const n = [...honors]; n[i] = e.target.value; setHonors(n); }} />
            ))}
          </div>
        </div>

        {/* WeChat */}
        <div>
          <label style={labelStyle}>微信号 <span style={{ color: '#a4b9b5', fontWeight: 400 }}>（仅好友可见）</span></label>
          <input style={inputStyle} placeholder="你的微信号" value={wechat} onChange={e => setWechat(e.target.value)} />
        </div>

        {/* Public / Private */}
        <div>
          <label style={labelStyle}>档案可见性</label>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[{ val: true, label: '公开', desc: '可被搜索到' }, { val: false, label: '私密', desc: '仅好友可见详情' }].map(({ val, label, desc }) => (
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

        <motion.button
          whileTap={{ scale: 0.98 }} onClick={handleSave} disabled={saving}
          style={{
            width: '100%', padding: '13px',
            background: saving ? '#9a8570' : '#2C3025',
            color: '#E8E4DC', border: 'none', borderRadius: '12px',
            fontSize: '14px', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit', letterSpacing: '0.1em',
          }}
        >
          {saving ? '保存中…' : '完成，进入撇捺'}
        </motion.button>
      </motion.div>
    </div>
  );
}
