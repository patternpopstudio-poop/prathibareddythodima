import { Router } from 'express';

import { checkSupabaseConnection } from '../lib/supabase.js';

export const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const supabase = await checkSupabaseConnection();
  res.json({
    status: 'ok',
    service: 'teleconsult-backend',
    timestamp: new Date().toISOString(),
    supabase,
  });
});
