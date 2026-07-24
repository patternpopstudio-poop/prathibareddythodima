import { Router } from 'express';
import { z } from 'zod';

import { getSupabaseAdmin } from '../lib/supabase.js';

const bootstrapSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  fullName: z.string().min(1).max(200),
  secret: z.string().optional(),
});

/**
 * One-time first admin bootstrap when no admin users exist yet.
 * Optionally require BOOTSTRAP_SECRET env var.
 */
export const bootstrapRouter = Router();

bootstrapRouter.post('/admin', async (req, res) => {
  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const expectedSecret = process.env.BOOTSTRAP_SECRET;
  if (expectedSecret && parsed.data.secret !== expectedSecret) {
    res.status(403).json({ error: 'Invalid bootstrap secret.' });
    return;
  }

  const admin = getSupabaseAdmin();
  if (!admin) {
    res.status(503).json({ error: 'Supabase admin client not configured.' });
    return;
  }

  const { data: list, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) {
    res.status(500).json({ error: listError.message });
    return;
  }

  const hasAdmin = (list.users ?? []).some(
    (u) => (u.app_metadata as { role?: string } | undefined)?.role === 'admin'
  );
  if (hasAdmin) {
    res.status(409).json({ error: 'An admin already exists. Bootstrap is disabled.' });
    return;
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: parsed.data.email.trim().toLowerCase(),
    password: parsed.data.password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: {
      role: 'admin',
      full_name: parsed.data.fullName.trim(),
    },
  });

  if (createError || !created.user) {
    res.status(400).json({ error: createError?.message ?? 'Failed to create admin.' });
    return;
  }

  res.status(201).json({
    userId: created.user.id,
    email: created.user.email,
    role: 'admin',
  });
});
