import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import profileRouter from './routes/profile.js';
import reviewRouter from './routes/review.js';

const app = express();
const PORT = process.env.PORT || 3001;

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:5183',
  'http://localhost:4173',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];
app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json());

app.use('/api/profile', profileRouter);
app.use('/api/review', reviewRouter);

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    mockMode: !process.env.OPENROUTER_API_KEY,
  });
});

app.listen(PORT, () => {
  const mock = !process.env.OPENROUTER_API_KEY;
  console.log(`服务器运行在 http://localhost:${PORT}`);
  if (mock) console.log('⚠️  模拟模式：API 密钥未配置，将返回模拟数据');
});
