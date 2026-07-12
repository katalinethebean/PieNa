import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import uploadRouter from './routes/upload.js';
import sessionsRouter from './routes/sessions.js';
import profileRouter from './routes/profile.js';
import exploreRouter from './routes/explore.js';
import reviewRouter from './routes/review.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5183', 'http://localhost:4173'] }));
app.use(express.json());

app.use('/api/upload', uploadRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/profile', profileRouter);
app.use('/api/explore', exploreRouter);
app.use('/api/review', reviewRouter);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mockMode: !process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY,
  });
});

app.listen(PORT, () => {
  const mock = !process.env.OPENAI_API_KEY || !process.env.ANTHROPIC_API_KEY;
  console.log(`服务器运行在 http://localhost:${PORT}`);
  if (mock) console.log('⚠️  模拟模式：API 密钥未配置，将返回模拟数据');
});
