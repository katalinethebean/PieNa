import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

router.get('/:id', authMiddleware, async (req, res) => {
  const { data: session, error } = await adminSupabase
    .from('sessions')
    .select('*')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();

  if (error || !session) return res.status(404).json({ error: '找不到该分析记录' });
  res.json(session);
});

export default router;
