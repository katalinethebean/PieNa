import { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { supabase, isConfigured } from '../lib/supabase';
import { API_URL, sendMatchInvites } from '../lib/utils';
import { useUser } from './UserContext';
import { useLanguage } from './LanguageContext';

// 分析任务的全局状态：任务在后端跑，前端轮询进度。
// 两种任务共用一套进度界面与悬浮卡片：
//   kind='review' — 复盘分析（结果展示在 /review 页，手动保存）
//   kind='match'  — 比赛分析（完成后自动存为比赛记录并跳转 /report/:id）
// 支持多任务并行；activeJobId 表示当前全屏查看的任务。
const ReviewJobContext = createContext(null);

async function authHeaders() {
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

// 比赛分析结果 → sessions 表的插入 payload
function buildSessionPayload(matchPayload, result) {
  return {
    ...matchPayload,
    fluency_score: result.fluency ?? null,
    originality_score: result.originality ?? null,
    flexibility_score: result.flexibility ?? null,
    targetedness_score: result.targetedness ?? null,
    logicality_score: result.logicality ?? null,
    effectiveness_score: result.effectiveness ?? null,
    clarity_score: result.clarity ?? null,
    appeal_score: result.appeal ?? null,
    avg_score: result.overall ?? null,
    feedback: result.feedback_summary ?? null,
    justification: {
      feedback_fluency: result.feedback_fluency ?? null,
      feedback_originality: result.feedback_originality ?? null,
      feedback_flexibility: result.feedback_flexibility ?? null,
      feedback_targetedness: result.feedback_targetedness ?? null,
      feedback_logicality: result.feedback_logicality ?? null,
      feedback_effectiveness: result.feedback_effectiveness ?? null,
      feedback_clarity: result.feedback_clarity ?? null,
      feedback_appeal: result.feedback_appeal ?? null,
      highlight_moment: result.highlight_moment ?? null,
      biggest_improvement: result.biggest_improvement ?? null,
      match_summary: result.match_summary ?? null,
      scored_by: result.scored_by ?? null,
    },
  };
}

export function ReviewJobProvider({ children }) {
  const { id: selfId, username: selfUsername, addSession } = useUser();
  const { lang } = useLanguage();
  const [jobs, setJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);
  const jobsRef = useRef(jobs);
  jobsRef.current = jobs;
  const savingRef = useRef(new Set());

  // 单个轮询循环，覆盖所有 running 任务
  useEffect(() => {
    const anyRunning = jobs.some(j => j.status === 'running' && j.id);
    if (!anyRunning) return;

    const timer = setInterval(async () => {
      const running = jobsRef.current.filter(j => j.status === 'running' && j.id);
      if (running.length === 0) return;
      const headers = await authHeaders();
      await Promise.all(running.map(async job => {
        try {
          const res = await fetch(`${API_URL}/api/review/analyze/status/${job.id}`, { headers });
          const json = await res.json();
          if (!res.ok) throw new Error(json.error || '查询任务状态失败');
          setJobs(js => js.map(j => j.id === job.id ? {
            ...j,
            status: json.status,
            progress: json.progress,
            stage: json.stage,
            result: json.result ?? j.result,
            error: json.error,
          } : j));
        } catch (e) {
          setJobs(js => js.map(j => j.id === job.id ? { ...j, status: 'error', error: e.message } : j));
        }
      }));
    }, 1200);

    return () => clearInterval(timer);
  }, [jobs]);

  // 比赛分析完成 → 自动保存为比赛记录
  useEffect(() => {
    const pending = jobs.filter(j =>
      j.kind === 'match' && j.status === 'done' && j.result && !j.reportId && !savingRef.current.has(j.id)
    );
    if (pending.length === 0) return;

    pending.forEach(async job => {
      savingRef.current.add(job.id);
      try {
        const payload = buildSessionPayload(job.matchPayload, job.result);
        let reportId;
        if (isConfigured && selfId) {
          const { data, error } = await supabase
            .from('sessions').insert({ ...payload, user_id: selfId, language: lang }).select().single();
          if (error) throw new Error('保存分析结果失败：' + error.message);
          reportId = data.id;
          addSession(data);
          await sendMatchInvites(supabase, data.id, job.matchPayload.debaters, selfId, selfUsername);
        } else {
          reportId = `analysis-${Date.now()}`;
          addSession({ id: reportId, ...payload });
        }
        setJobs(js => js.map(j => j.id === job.id ? { ...j, reportId } : j));
      } catch (e) {
        setJobs(js => js.map(j => j.id === job.id ? { ...j, status: 'error', error: e.message } : j));
      } finally {
        savingRef.current.delete(job.id);
      }
    });
  }, [jobs, selfId, selfUsername, addSession]);

  const startJob = useCallback(async ({ kind = 'review', position, motion, text, context, matchPayload = null }) => {
    const headers = await authHeaders();
    let jobId;
    try {
      const res = await fetch(`${API_URL}/api/review/analyze/start`, {
        method: 'POST', headers,
        body: JSON.stringify({ position, motion, text, context }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || '分析启动失败');
      jobId = json.jobId;
    } catch (e) {
      return { error: e.message || '网络错误，请重试' };
    }

    setJobs(js => [...js, {
      id: jobId, kind, status: 'running', progress: 0, stage: '任务已创建…',
      result: null, error: null, meta: { position, motion },
      matchPayload, reportId: null, savedId: null,
    }]);
    setActiveJobId(jobId);
    return { jobId };
  }, []);

  const removeJob = useCallback((id) => {
    setJobs(js => js.filter(j => j.id !== id));
    setActiveJobId(a => (a === id ? null : a));
  }, []);

  const updateJob = useCallback((id, patch) => {
    setJobs(js => js.map(j => j.id === id ? { ...j, ...patch } : j));
  }, []);

  return (
    <ReviewJobContext.Provider value={{ jobs, activeJobId, setActiveJobId, startJob, removeJob, updateJob }}>
      {children}
    </ReviewJobContext.Provider>
  );
}

export function useReviewJob() {
  const ctx = useContext(ReviewJobContext);
  if (!ctx) throw new Error('useReviewJob must be used within ReviewJobProvider');
  return ctx;
}
