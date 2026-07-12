import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get('/', authMiddleware, async (req, res) => {
  const { search, format, region, minScore } = req.query;

  let query = adminSupabase
    .from('profiles')
    .select('id, name, school, region, formats, avg_score, is_public')
    .eq('is_public', true)
    .order('avg_score', { ascending: false });

  if (search) {
    const safeSearch = String(search).replace(/[%(),]/g, '').trim();
    if (safeSearch) {
      query = query.or(`name.ilike.%${safeSearch}%,school.ilike.%${safeSearch}%`);
    }
  }
  if (region && region !== '全部') {
    query = query.eq('region', region);
  }
  if (minScore && minScore !== '不限') {
    query = query.gte('avg_score', parseFloat(minScore));
  }

  const { data: profiles, error } = await query;
  if (error) return res.status(500).json({ error: '搜索失败，请重试' });

  // Get session counts
  const userIds = (profiles || []).map((p) => p.id);
  let sessionCounts = {};
  if (userIds.length > 0) {
    const { data: counts } = await adminSupabase
      .from('sessions')
      .select('user_id')
      .in('user_id', userIds);
    (counts || []).forEach((s) => {
      sessionCounts[s.user_id] = (sessionCounts[s.user_id] || 0) + 1;
    });
  }

  const result = (profiles || [])
    .filter((p) => {
      if (!format) return true;
      return p.formats?.includes(format);
    })
    .map((p) => ({
      ...p,
      session_count: sessionCounts[p.id] || 0,
    }));

  res.json(result);
});

export default router;
