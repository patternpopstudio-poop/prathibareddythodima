import 'dotenv/config';

import cors from 'cors';
import express from 'express';

import { bootstrapRouter } from './routes/bootstrap.js';
import { healthRouter } from './routes/health.js';
import { invitesRouter } from './routes/invites.js';
import { handleRazorpayWebhook, paymentsRouter } from './routes/payments.js';

const app = express();
const port = Number(process.env.PORT ?? 4000);

const origins = (
  process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://127.0.0.1:3000'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: origins,
  })
);

// Razorpay webhooks need the raw body for HMAC verification
app.post(
  '/payments/webhook',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    void handleRazorpayWebhook(req, res);
  }
);

app.use(express.json());

app.get('/', (_req, res) => {
  res.json({ message: 'Teleconsult backend — use GET /health' });
});

app.use('/health', healthRouter);
app.use('/invites', invitesRouter);
app.use('/bootstrap', bootstrapRouter);
app.use('/payments', paymentsRouter);

app.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
