import 'dotenv/config';

import cors from 'cors';
import express from 'express';

import { bootstrapRouter } from './routes/bootstrap.js';
import { healthRouter } from './routes/health.js';
import { invitesRouter } from './routes/invites.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

const origins = (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins,
  })
);
app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Teleconsult backend — use GET /health' });
});

app.use('/health', healthRouter);
app.use('/invites', invitesRouter);
app.use('/bootstrap', bootstrapRouter);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
