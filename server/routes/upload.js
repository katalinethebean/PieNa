import express from 'express';
import multer from 'multer';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { authMiddleware } from '../middleware/auth.js';
import { toFile } from 'openai/uploads';

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 150 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['audio/mpeg', 'audio/mp4', 'audio/wav', 'audio/x-m4a', 'video/mp4', 'audio/mp3'];
    const ext = file.originalname.split('.').pop().toLowerCase();
    const allowedExt = ['mp3', 'mp4', 'm4a', 'wav'];
    if (allowedExt.includes(ext)) return cb(null, true);
    cb(new Error('文件格式不支持，请上传 mp4/mp3/m4a/wav 格式'));
  },
});

const adminSupabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const MOCK_MODE = !process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY;

const MOCK_SCORES = {
  argument: 7.5,
  delivery: 6.8,
  rebuttal: 8.0,
  structure: 7.2,
  evidence: 6.5,
  fluency: 7.8,
  feedback:
    '你的论证框架搭建得相当完整，逻辑链条清晰，但在驳论环节可以更加主动出击，针对对方核心立场进行精准回应。建议在陈词结构上加入更多例证支撑，提升整体说服力。',
};

router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const { motion, format, role } = req.body;
  const file = req.file;
  let uploadedFileName = null;

  if (!file) return res.status(400).json({ error: '请上传音频或视频文件' });

  try {
    // Check credits
    const { data: credits, error: creditsError } = await adminSupabase
      .from('credits')
      .select('balance')
      .eq('user_id', req.user.id)
      .single();

    if (creditsError || !credits) {
      return res.status(402).json({ error: '点数不足，请充值后再试' });
    }
    if (credits.balance < 1) {
      return res.status(402).json({ error: '点数不足，请充值后再试' });
    }

    let transcript, scores;

    if (MOCK_MODE) {
      // Simulate processing delay
      await new Promise((r) => setTimeout(r, 1500));
      transcript =
        '【模拟转录】感谢主席，各位评委好。今天我方认为，辩题所指向的核心问题在于……（模拟转录文本，API 密钥未配置）';
      scores = { ...MOCK_SCORES };
    } else {
      // Upload to Supabase Storage temporarily
      uploadedFileName = `${req.user.id}/${Date.now()}-${file.originalname}`;
      await adminSupabase.storage.from('recordings').upload(uploadedFileName, file.buffer, {
        contentType: file.mimetype,
        upsert: false,
      });

      // Transcribe with Whisper
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const audioFile = await toFile(file.buffer, file.originalname, { type: file.mimetype });
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: 'zh',
      });
      transcript = transcription.text;

      // Analyze with Claude
      const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: `你是一位专业辩论教练，擅长中文辩论赛的点评与指导。
请分析以下辩论发言记录，从六个维度对选手进行评分：
论点质量、表达与语气、驳论能力、结构清晰度、论据使用、流利度与节奏。
每个维度评分为1到10分。
请只返回以下JSON格式，不要包含任何其他文字：
{
  "argument": 7.5,
  "delivery": 6.8,
  "rebuttal": 8.0,
  "structure": 7.2,
  "evidence": 6.5,
  "fluency": 7.8,
  "feedback": "2到3句具体的、可操作的中文反馈"
}`,
        messages: [
          {
            role: 'user',
            content: `辩论赛制：${format}\n选手角色：${role}\n辩题：${motion || '未提供'}\n\n发言内容：\n${transcript}`,
          },
        ],
      });

      const raw = message.content[0].text.trim();
      scores = JSON.parse(raw);
    }

    const avg_score =
      (scores.argument + scores.delivery + scores.rebuttal + scores.structure + scores.evidence + scores.fluency) / 6;

    // Save session
    const { data: session, error: sessionError } = await adminSupabase
      .from('sessions')
      .insert({
        user_id: req.user.id,
        motion: motion || null,
        format,
        role,
        date: new Date().toISOString(),
        argument_score: scores.argument,
        delivery_score: scores.delivery,
        rebuttal_score: scores.rebuttal,
        structure_score: scores.structure,
        evidence_score: scores.evidence,
        fluency_score: scores.fluency,
        avg_score: Math.round(avg_score * 10) / 10,
        feedback: scores.feedback,
        transcript,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // Deduct 1 credit only if the balance has not changed since the initial check.
    const { data: deductedCredit, error: deductError } = await adminSupabase
      .from('credits')
      .update({ balance: credits.balance - 1 })
      .eq('user_id', req.user.id)
      .eq('balance', credits.balance)
      .select('balance')
      .single();

    if (deductError || !deductedCredit) {
      await adminSupabase.from('sessions').delete().eq('id', session.id);
      return res.status(402).json({ error: '点数余额已变化，请刷新后重试' });
    }

    // Recalculate profile avg_score
    const { data: allSessions } = await adminSupabase
      .from('sessions')
      .select('avg_score')
      .eq('user_id', req.user.id);
    if (allSessions?.length) {
      const newAvg = allSessions.reduce((sum, s) => sum + (s.avg_score || 0), 0) / allSessions.length;
      await adminSupabase
        .from('profiles')
        .update({ avg_score: Math.round(newAvg * 10) / 10 })
        .eq('id', req.user.id);
    }

    res.json({ sessionId: session.id, mockMode: MOCK_MODE });
  } catch (err) {
    console.error('Upload error:', err);
    if (err.message?.includes('JSON')) {
      return res.status(500).json({ error: 'AI 分析结果解析失败，请重试' });
    }
    res.status(500).json({ error: err.message || '上传失败，请重试' });
  } finally {
    if (uploadedFileName) {
      const { error: cleanupError } = await adminSupabase.storage.from('recordings').remove([uploadedFileName]);
      if (cleanupError) console.error('Storage cleanup error:', cleanupError);
    }
  }
});

export default router;
