import express from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFINED_SERVICE_URL = process.env.DEFINED_SERVICE_URL || 'http://localhost:8000';
// Primary model is cheap-paid (DeepSeek); free models are fallback only — OpenRouter's
// free pool is heavily rate-limited (429s on longer prompts) and unreliable.
const MODELS = ['deepseek/deepseek-v3.2', 'google/gemma-4-31b-it:free', 'nvidia/nemotron-3-ultra-550b-a55b:free'];

const POSITION_SIDE = {
  '正方一辩': '正方', '正方二辩': '正方', '正方三辩': '正方', '正方四辩': '正方',
  '反方一辩': '反方', '反方二辩': '反方', '反方三辩': '反方', '反方四辩': '反方',
};

// Patterns that indicate a chairperson is calling on a specific speaker
const CHAIR_TRANSITION_RE = /(?:接下来有请|下面有请|有请|请)(.{2,8}?)(?:发言|进行陈词|陈词|质询|总结)/;

// Patterns that open a free-debate / cross-examination section
const FREE_DEBATE_RE = /自由辩论|质询环节|开放辩论|交叉质询/;

// Patterns that indicate a speaker label prefix inside free debate
// e.g. "正方：", "反方二辩：", "正方一辩:"
function makeSpeakerPrefixRE(position, side) {
  const escaped = [position, side].map(s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^(${escaped.join('|')})[：:]\\s*`);
}

export function isolateSpeaker(text, position) {
  if (!text || !text.trim()) return text;

  const side = POSITION_SIDE[position] || '';
  const lines = text.split('\n');
  const speakerPrefixRE = makeSpeakerPrefixRE(position, side);
  // Opposite side prefix — used to skip lines in free debate
  const oppSide = side === '正方' ? '反方' : side === '反方' ? '正方' : null;
  const oppPrefixRE = oppSide ? new RegExp(`^${oppSide}[：:]`) : null;

  const extractedBlocks = [];
  let inTargetBlock = false;
  let inFreeDebate = false;
  let currentBlock = [];

  const flushBlock = () => {
    if (currentBlock.length > 0) {
      extractedBlocks.push(currentBlock.join('\n'));
      currentBlock = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect free-debate section opening
    if (FREE_DEBATE_RE.test(trimmed)) {
      flushBlock();
      inTargetBlock = false;
      inFreeDebate = true;
      continue;
    }

    // Detect chairperson transition
    const chairMatch = trimmed.match(CHAIR_TRANSITION_RE);
    if (chairMatch) {
      flushBlock();
      inFreeDebate = false;
      const calledSpeaker = chairMatch[1];
      inTargetBlock =
        calledSpeaker.includes(position) ||
        calledSpeaker.replace(/\s/g, '') === position.replace(/\s/g, '');
      continue;
    }

    if (inFreeDebate) {
      // Lines explicitly labelled with the target speaker
      if (speakerPrefixRE.test(trimmed)) {
        currentBlock.push(trimmed.replace(speakerPrefixRE, '').trim());
        continue;
      }
      // Lines explicitly labelled as the opponent — skip
      if (oppPrefixRE && oppPrefixRE.test(trimmed)) continue;
      // Unlabelled continuation inside a block we've started — include
      if (currentBlock.length > 0) currentBlock.push(trimmed);
      continue;
    }

    if (inTargetBlock) {
      currentBlock.push(trimmed);
    }
  }

  flushBlock();

  // Fallback: no markers found at all — return full text unchanged
  if (extractedBlocks.length === 0) return text;
  return extractedBlocks.join('\n\n---\n\n');
}

function buildPrompt(extractedText, position, motion, context) {
  const contextSection = context
    ? `\n\n【用户提问/指令】（必须在 feedback_summary 中直接回答）：${context}`
    : '';
  return `你是一位专业辩论赛评委，请严格按照以下评分标准对辩手发言进行评估。评分必须严格依据发言中的具体内容，每个维度的理由必须明确引用发言中的具体行为，说明为什么得这个分，以及具体在哪里可以进步。

辩题：${motion}
辩手位置：${position}${contextSection}

发言内容：
${extractedText}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
评分标准（DEFINED 辩论创造力评估框架，每项1–10分，可用小数）
分为三组：发散思维（流畅性/原创性/灵活性）、聚合思维（针对性/逻辑性/有效性）、表达（清晰度/吸引力）
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

【流畅性 fluency】发散思维——在给定时间与信息约束下，产出相关论点/拆解要点的数量
9–10：论点与拆解要点密集且全部相关，多线并进，信息利用充分无浪费。
7–8：论点数量充足，多数相关，偶有单薄段落。
5–6：论点数量一般，部分段落仅重复同一要点。
3–4：论点稀少，大量篇幅空转或重复。
1–2：几乎没有可辨识的独立论点。

【原创性 originality】发散思维——论述、类比或论证路径的独特性，能在立论基础上延伸或转化
9–10：提出独特的论证路径、新颖类比或反直觉视角，且在己方立论基础上有机延伸而非另起炉灶。
7–8：有若干新意的表达或角度，多数论证仍属常见路径。
5–6：基本沿用常见论证套路，偶有个人化表达。
3–4：内容高度模板化，可预测性强。
1–2：完全照搬俗套论证，无任何个人贡献。

【灵活性 flexibility】发散思维——跨领域或多策略思考能力，宏观/微观、多角度与正反视角切换
9–10：自如切换宏观/微观、正反视角，引入跨领域（经济、心理、历史等）视角且切换自然服务论证。
7–8：有明显的视角切换或跨领域引用，切换基本顺畅。
5–6：视角较为单一，偶有切换但生硬。
3–4：全程单一视角单一策略。
1–2：思维僵化，无法应对任何视角变化。

【针对性 targetedness】聚合思维——是否聚焦双方立论与上一轮对方发言的核心争点与关键漏洞
9–10：精准锁定核心争点，直击对方关键漏洞与对己方的攻击，明确指名"对方说X……"，确定核心分歧。
7–8：多数回应有针对性，能识别对方弱点，偶尔偏离核心争点。
5–6：有回应但多为泛泛否定，常以重申己方立场代替针对性回应。
3–4：几乎无针对性，忽视对方核心论证，可能攻击稻草人。
1–2：完全无视对方论点与争议焦点。

【逻辑性 logicality】聚合思维——是否建立清晰完整推理链，结构合理，避免逻辑跳跃与证据不当
9–10：论证链完整无断层，因果关系明确，零自相矛盾，证据使用得当，听众无需自行补充推断。
7–8：整体逻辑清晰，偶有跳跃但不损核心论证，罕见矛盾可自行纠正。
5–6：逻辑框架可辨但有明显漏洞或不一致，部分推断需听众自行填补。
3–4：推理混乱，存在因果倒置或循环论证，多处矛盾未处理。
1–2：无可辨逻辑结构，仅为不相关断言的堆砌。

【有效性 effectiveness】聚合思维——是否有效回应问题并推进论证，驳斥对方或强化己方立场
9–10：每次回应都实质推进论证：驳倒对方论点或显著强化己方立场，被追问时能深化论证而不漂移。
7–8：多数回应有效，立场清晰，偶有游离但能回归。
5–6：回应流于表面，论证原地踏步，被对方带偏。
3–4：回应无效，立场模糊或游移，质询下无法维持论证，可能无意中让步。
1–2：无有效回应，内容与己方矛盾或与辩题无关。

【清晰度 clarity】表达——语言简练明确，组织得当，易于追踪核心意思
9–10：措辞精准无歧义，段落结构清晰（如"首先……其次……因此……"），信息密度高而不冗余。
7–8：表达总体清晰，结构可辨但偶缺衔接，少量口头禅不影响理解。
5–6：可理解但措辞模糊或冗余，结构松散，听众需主动整理信息。
3–4：措辞不准确，几乎无结构，难以提炼要点。
1–2：表达混乱，听众无法提取有意义内容。

【吸引力 appeal】表达——引入情感元素与叙事增强说服力，且与论点紧密结合
9–10：情感元素与叙事运用娴熟（个人故事、具象场景、排比反问等），与论点紧密结合，显著增强说服力。
7–8：有情感或叙事成分，与论证结合基本自然。
5–6：偶有情感表达但与论点结合松散，或全程平铺直叙。
3–4：语言干瘪，无任何感染力设计，或情感泛滥与论证脱节。
1–2：表达令人失去倾听意愿。

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
发言者识别逻辑
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
用户已声明其辩位为：${position}
- 若有主席词（"有请[辩位]发言"/"请[辩位]"等），仅提取该发言者的内容进行评分
- 质询环节：根据问答模式判断谁问谁答
- 自由辩论：根据发言模式和自我标识线索判断
- 仅分析目标发言者的内容

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
输出格式
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
严格按照以下JSON格式返回，不得输出任何其他内容：

{
  "fluency": 0.0,
  "originality": 0.0,
  "flexibility": 0.0,
  "targetedness": 0.0,
  "logicality": 0.0,
  "effectiveness": 0.0,
  "clarity": 0.0,
  "appeal": 0.0,
  "overall": 0.0,
  "feedback_summary": "若用户有提问/指令则先直接回答，再用2–3句总体评价说明最突出的优点和最需改进处",
  "feedback_fluency": ["针对流畅性的具体观察", "第二点"],
  "feedback_originality": ["针对原创性的具体观察", "第二点"],
  "feedback_flexibility": ["针对灵活性的具体观察", "第二点"],
  "feedback_targetedness": ["针对针对性的具体观察", "第二点"],
  "feedback_logicality": ["针对逻辑性的具体观察", "第二点"],
  "feedback_effectiveness": ["针对有效性的具体观察", "第二点"],
  "feedback_clarity": ["针对清晰度的具体观察", "第二点"],
  "feedback_appeal": ["针对吸引力的具体观察", "第二点"],
  "highlight_moment": "发言中最亮眼的一个具体时刻，引用原文",
  "biggest_improvement": "最需要改进的一件事，非常具体，引用原文",
  "match_summary": "用3-5段对整场比赛进行中文总结：正方的主要论点与策略、反方的主要论点与策略、双方交锋的核心焦点、评委点评要点（若逐字稿中有评委发言则提炼，若无则省略此段）、整体改进建议。语气客观，像一份赛后分析报告。"
}

评分要求——每个维度的分数必须严格基于发言中的具体行为，不能笼统估计：
- 给出分数时，必须说明该维度具体扣分的原因（例如："第二段重复论点X两次，浪费时间"），以及具体如何可以提升（例如："应在Y处直接攻击对方Z论点而非回避"）
- 禁止泛泛评价如"论证较弱"、"建议加强逻辑"，必须指明具体位置和具体问题
- 若某维度表现优秀，也需说明为何优秀（引用具体行为，不引用原文段落）

feedback_fluency至feedback_appeal必须为字符串数组，每维度2–3条，每条必须是具体的分析性判断，而非摘要或引用：
- 说明该维度得分的具体依据，引用发言中的具体行为（而非引用原文段落）
- 指出具体哪里可以进步，给出可操作的改进建议（"应该怎么做"而非"建议加强某方面"）
- 若有对方论点被忽略/回避、逻辑矛盾或立场漂移，必须点出
禁止：直接引用原文段落、泛泛说"建议加强"、重复描述已发生的事情、复述稿子内容。
feedback_summary、highlight_moment、biggest_improvement为普通字符串，同样遵循以上分析性原则。
所有内容必须用中文。`;
}

const MOCK_RESULT = {
  fluency: 7.5, originality: 6.8, flexibility: 7.2, targetedness: 6.9,
  logicality: 7.4, effectiveness: 7.0, clarity: 8.0, appeal: 6.5,
  overall: 7.16,
  feedback_summary: '（模拟）整体表达清晰，逻辑框架完整，是本次发言最突出的优点。',
  feedback_fluency: ['（模拟）论点产出数量充足，多线并进。', '（模拟）部分段落重复同一要点，可精简后补充新论点。'],
  feedback_originality: ['（模拟）出现了较新颖的类比论证。', '（模拟）多数论证仍属常见路径，可尝试反直觉视角。'],
  feedback_flexibility: ['（模拟）有宏观/微观视角切换。', '（模拟）跨领域引用较少，可引入经济或心理学视角。'],
  feedback_targetedness: ['（模拟）对对方主要论点有所回应，但深度不足。', '（模拟）建议先复述对方具体论点，再逐点驳斥。'],
  feedback_logicality: ['（模拟）论证结构清晰，因果关系基本完整。', '（模拟）部分环节缺乏严密的因果链，建议明确说明"因为A，所以B"。'],
  feedback_effectiveness: ['（模拟）基本坚守己方立场，回应有推进。', '（模拟）偶有偏离，被追问时建议回归核心命题。'],
  feedback_clarity: ['（模拟）语言流畅，结构标识清晰。', '（模拟）可进一步减少冗余表达，提高信息密度。'],
  feedback_appeal: ['（模拟）有一定叙事成分，结合基本自然。', '（模拟）可在关键论点处加入具象场景增强感染力。'],
  highlight_moment: '（模拟）"因此我方认为……"处的总结归纳层次分明，逻辑收束有力。',
  biggest_improvement: '（模拟）反驳时应先复述对方具体论点再驳斥，目前多为泛泛否定，缺乏针对性。',
  match_summary: '（模拟）正方围绕"技术进步带来整体效益"立论，援引经济增长数据支撑核心论点。反方则聚焦分配不均与就业冲击，指出增长红利未能惠及底层群体。双方交锋集中于"利"的衡量标准——正方以总量论，反方以公平论，核心焦点始终未获正面交锋。建议双方在下一场明确界定"利大于弊"的判断标准，并在自由辩论中主动回应对方的核心论证，而非反复强化己方论点。',
  mock: true,
};

// ── 异步任务：进度按真实阶段推进 ─────────────────────────────
// stage 与 progress 由管道各阶段实际完成时更新，前端轮询 /analyze/status/:id
const jobs = new Map();
const JOB_TTL_MS = 30 * 60 * 1000;

function cleanupJobs() {
  const now = Date.now();
  for (const [id, job] of jobs) {
    if (now - job.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

async function runAnalysisPipeline({ position, motion, text, context }, update) {
  update(3, '提取你的发言…');
  const extractedText = isolateSpeaker(text.trim(), position);
  const extractedPreview = extractedText.slice(0, 300);
  update(8, '发言提取完成');

  if (!OPENROUTER_API_KEY) {
    update(95, '模拟模式');
    return { ...MOCK_RESULT, extracted_preview: extractedPreview };
  }

  const prompt = buildPrompt(extractedText, position, motion, context);
  update(12, '正在生成评价与建议…');

  let raw = null;
  for (const model of MODELS) {
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://pieamie.app',
        'X-Title': 'PieAmie',
      },
      body: JSON.stringify({
        model,
        max_tokens: 6000,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      console.error(`OpenRouter error (${model}):`, response.status, (await response.text()).slice(0, 300));
      continue;
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content;
    if (!content) {
      console.error(`Empty AI content (${model}). finish_reason:`, choice?.finish_reason);
      continue;
    }
    if (choice?.finish_reason === 'length') {
      console.error(`Truncated AI content (${model}), trying next model`);
      continue;
    }
    raw = content;
    break;
  }

  if (!raw) {
    const err = new Error('AI 服务暂时不可用，请稍后重试');
    err.status = 502;
    throw err;
  }

  update(55, '评价与建议已生成');

  // Strip markdown code fences (```json ... ```) the model sometimes wraps around JSON
  let cleaned = raw.trim();
  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  let result;
  try {
    result = JSON.parse(cleaned);
  } catch {
    // Fallback: extract the outermost {...} block
    const braceMatch = cleaned.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        result = JSON.parse(braceMatch[0]);
      } catch {
        console.error('JSON parse failed:', raw.slice(0, 500));
        const err = new Error('AI 分析结果解析失败，请重试');
        err.status = 500;
        throw err;
      }
    } else {
      console.error('JSON parse failed:', raw.slice(0, 500));
      const err = new Error('AI 分析结果解析失败，请重试');
      err.status = 500;
      throw err;
    }
  }

  // Models sometimes return scores as quoted strings — coerce so the client can
  // insert them into float columns and call .toFixed() safely
  const DIMS = ['fluency', 'originality', 'flexibility', 'targetedness', 'logicality', 'effectiveness', 'clarity', 'appeal'];
  for (const k of [...DIMS, 'overall']) {
    if (result[k] != null) {
      const n = Number(result[k]);
      result[k] = Number.isFinite(n) ? n : null;
    }
  }

  update(62, '专业评分中（本地推理较慢，约需几分钟）…');

  // Prefer scores from the local DEFINED reward model (trained on real judge
  // annotations); LLM scores above are the fallback when it's offline.
  result.scored_by = 'claude';
  try {
    const dr = await fetch(`${DEFINED_SERVICE_URL}/score`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        motion,
        stance: position,
        // 打分服务输入上限 2048 token（约 3000 汉字），超长白传
        statement: extractedText.slice(0, 3000),
      }),
      signal: AbortSignal.timeout(600000),
    });
    if (!dr.ok) throw new Error(`status ${dr.status}`);
    const defined = await dr.json();
    for (const k of DIMS) {
      if (defined.scores?.[k] != null) result[k] = defined.scores[k];
    }
    if (defined.overall != null) result.overall = defined.overall;
    result.scored_by = 'defined';
    console.log('DEFINED scores applied, overall =', result.overall);
    update(92, '评分完成');
  } catch (err) {
    console.error('DEFINED scoring failed:', err.message);
    update(92, '评分完成（使用备用评分）');
  }

  // Ensure overall is computed if model didn't include it
  if (!result.overall) {
    const vals = DIMS.map(k => result[k] ?? 0).filter(v => v > 0);
    if (vals.length > 0) result.overall = Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 100) / 100;
  }

  update(97, '整理报告…');
  return { ...result, extracted_preview: extractedPreview };
}

function validateAnalyzeBody(body) {
  const { position, motion, text } = body || {};
  if (!position) return '请选择辩手位置';
  if (!motion || !motion.trim()) return '请输入辩题';
  if (!text || !text.trim()) return '请输入发言内容';
  return null;
}

// 同步接口（保留兼容）
router.post('/analyze', authMiddleware, async (req, res) => {
  const invalid = validateAnalyzeBody(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  try {
    const result = await runAnalysisPipeline(req.body, () => {});
    res.json(result);
  } catch (err) {
    console.error('Review analyze error:', err);
    res.status(err.status || 500).json({ error: err.message || '分析失败，请重试' });
  }
});

// 启动异步分析任务，立即返回 jobId
router.post('/analyze/start', authMiddleware, (req, res) => {
  const invalid = validateAnalyzeBody(req.body);
  if (invalid) return res.status(400).json({ error: invalid });
  cleanupJobs();

  const id = crypto.randomUUID();
  const job = {
    id,
    userId: req.user.id,
    status: 'running',       // running | done | error
    progress: 0,
    stage: '任务已创建…',
    result: null,
    error: null,
    createdAt: Date.now(),
  };
  jobs.set(id, job);

  const update = (progress, stage) => {
    job.progress = progress;
    job.stage = stage;
  };

  runAnalysisPipeline(req.body, update)
    .then(result => {
      job.result = result;
      job.progress = 100;
      job.stage = '分析完成';
      job.status = 'done';
    })
    .catch(err => {
      console.error('Review analyze job error:', err);
      job.error = err.message || '分析失败，请重试';
      job.status = 'error';
    });

  res.json({ jobId: id });
});

// 轮询任务进度/结果
router.get('/analyze/status/:id', authMiddleware, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job || job.userId !== req.user.id) {
    return res.status(404).json({ error: '任务不存在或已过期' });
  }
  res.json({
    status: job.status,
    progress: job.progress,
    stage: job.stage,
    result: job.status === 'done' ? job.result : null,
    error: job.error,
  });
});

export default router;
