import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get own profile + sessions + credits
router.get('/', authMiddleware, async (req, res) => {
  const [profileRes, sessionsRes, creditsRes] = await Promise.all([
    adminSupabase.from('profiles').select('*').eq('id', req.user.id).single(),
    adminSupabase.from('sessions').select('*').eq('user_id', req.user.id).order('date', { ascending: false }),
    adminSupabase.from('credits').select('balance').eq('user_id', req.user.id).single(),
  ]);

  res.json({
    profile: profileRes.data,
    sessions: sessionsRes.data || [],
    credits: creditsRes.data?.balance ?? 0,
  });
});

// Update own profile
router.put('/', authMiddleware, async (req, res) => {
  const { name, school, region, formats, is_public } = req.body;

  const { data, error } = await adminSupabase
    .from('profiles')
    .update({ name, school, region, formats, is_public })
    .eq('id', req.user.id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: '更新失败，请重试' });
  res.json(data);
});

// Get another user's public profile
router.get('/:userId', authMiddleware, async (req, res) => {
  const { data: profile, error } = await adminSupabase
    .from('profiles')
    .select('*')
    .eq('id', req.params.userId)
    .single();

  if (error || !profile) return res.status(404).json({ error: '找不到该用户' });

  // Check friendship
  const { data: friendRow } = await adminSupabase
    .from('friend_requests')
    .select('id')
    .eq('status', 'accepted')
    .or(`and(sender_id.eq.${req.user.id},receiver_id.eq.${req.params.userId}),and(sender_id.eq.${req.params.userId},receiver_id.eq.${req.user.id})`)
    .maybeSingle();
  const isFriend = !!friendRow;

  // Private account — return limited fields unless friend
  if (!profile.is_public && profile.id !== req.user.id && !isFriend) {
    return res.json({
      profile: {
        id: profile.id,
        username: profile.username,
        name: profile.name,
        avatar_url: profile.avatar_url,
        team: profile.team,
        bio: profile.bio,
        is_public: false,
      },
      sessions: [],
      limited: true,
    });
  }

  // 比赛记录仅本人可见，不对外返回
  res.json({ profile, sessions: [], limited: false });
});

// Delete own account
router.delete('/', authMiddleware, async (req, res) => {
  const { error } = await adminSupabase.auth.admin.deleteUser(req.user.id);
  if (error) return res.status(500).json({ error: '删除账户失败，请重试' });
  res.json({ success: true });
});

export default router;
