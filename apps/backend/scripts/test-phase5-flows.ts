/**
 * Manual E2E smoke tests for Phase 5 flows (report-only — does not "fix" failures).
 *
 *   npx tsx scripts/test-phase5-flows.ts
 *
 * Requires apps/backend/.env (service role) + apps/doctor-admin/.env.local (anon key).
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: join(__dirname, '../.env') });

type ResultStatus = 'PASS' | 'FAIL' | 'INFO';
type Result = { name: string; status: ResultStatus; detail: string };

const results: Result[] = [];

function record(name: string, status: ResultStatus, detail: string) {
  results.push({ name, status, detail });
  const mark = status === 'PASS' ? '✓' : status === 'FAIL' ? '✗' : '·';
  console.log(`${mark} ${name}: ${detail}`);
}

function loadEnvLocal(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path, 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq < 0) continue;
      const key = trimmed.slice(0, eq).trim();
      let val = trimmed.slice(eq + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      out[key] = val;
    }
    return out;
  } catch {
    return {};
  }
}

function errMsg(err: unknown): string {
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

function clientFor(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

async function signIn(
  url: string,
  anonKey: string,
  email: string,
  password: string
): Promise<SupabaseClient> {
  const client = clientFor(url, anonKey);
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Sign-in failed for ${email}: ${error?.message ?? 'no session'}`);
  }
  return client;
}

async function ensureAdmin(
  admin: SupabaseClient,
  email: string,
  password: string
): Promise<void> {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;
  const existing = listed.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (existing) {
    const { error } = await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      app_metadata: { role: 'admin' },
      user_metadata: { role: 'admin', full_name: 'Flow Test Admin' },
    });
    if (error) throw error;
    await admin.from('patients').delete().eq('id', existing.id);
    await admin.from('doctors').delete().eq('id', existing.id);
    return;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: 'admin' },
    user_metadata: { role: 'admin', full_name: 'Flow Test Admin' },
  });
  if (error || !data.user) throw new Error(error?.message ?? 'admin create failed');
  await admin.from('patients').delete().eq('id', data.user.id);
  await admin.from('doctors').delete().eq('id', data.user.id);
}

/** Half-open overlap helper (mirrors doctor-admin generate-slots). */
function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return new Date(aStart).getTime() < new Date(bEnd).getTime() &&
    new Date(bStart).getTime() < new Date(aEnd).getTime();
}

function findOverlap(
  draft: { startsAt: string; endsAt: string; mode: string },
  existing: { startsAt: string; endsAt: string; mode: string }[]
) {
  const draftStart = new Date(draft.startsAt).getTime();
  for (const slot of existing) {
    const sameStart = new Date(slot.startsAt).getTime() === draftStart;
    if (sameStart && slot.mode === draft.mode) continue;
    if (rangesOverlap(draft.startsAt, draft.endsAt, slot.startsAt, slot.endsAt)) {
      return slot;
    }
  }
  return null;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const doctorAdminEnv = loadEnvLocal(
    join(__dirname, '../../doctor-admin/.env.local')
  );
  const anonKey =
    doctorAdminEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY;

  if (!url || !serviceRoleKey || !anonKey) {
    throw new Error('Missing SUPABASE_URL / SERVICE_ROLE_KEY / ANON_KEY');
  }

  const service = clientFor(url, serviceRoleKey);

  const DOCTOR_EMAIL = 'arjun.mehta@demo.teleconsult.local';
  const DOCTOR_PASSWORD = 'DoctorSeed123!';
  const PATIENT_A = 'rahul.sharma@demo.teleconsult.local';
  const PATIENT_B = 'sneha.patel@demo.teleconsult.local';
  const PATIENT_C = 'karthik.reddy@demo.teleconsult.local';
  const PATIENT_D = 'anjali.menon@demo.teleconsult.local';
  const PATIENT_PASSWORD = 'PatientSeed123!';
  const ADMIN_EMAIL = 'flow.test.admin@demo.teleconsult.local';
  const ADMIN_PASSWORD = 'AdminSeed123!';

  console.log(`\n=== Phase 5 flow tests → ${url} ===\n`);

  // Resolve doctor
  const { data: doctorRow, error: doctorErr } = await service
    .from('doctors')
    .select('id, full_name, email')
    .eq('email', DOCTOR_EMAIL)
    .single();
  if (doctorErr || !doctorRow) throw new Error(`Doctor not found: ${doctorErr?.message}`);
  const doctorId = doctorRow.id as string;
  record('Setup: doctor', 'INFO', `${doctorRow.full_name} (${doctorId})`);

  await ensureAdmin(service, ADMIN_EMAIL, ADMIN_PASSWORD);
  record('Setup: test admin', 'INFO', ADMIN_EMAIL);

  // --------------------------------------------------------------------------
  // 1) Overlap flag — client helper + DB exclusion
  // --------------------------------------------------------------------------
  const { data: openOnline, error: onlineFetchErr } = await service
    .from('appointment_slots')
    .select('id, starts_at, ends_at, mode, status')
    .eq('doctor_id', doctorId)
    .eq('mode', 'online')
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString())
    .order('starts_at', { ascending: true })
    .limit(5);

  if (onlineFetchErr || !openOnline?.length) {
    record(
      'Overlap: fetch online slots',
      'FAIL',
      onlineFetchErr?.message ?? 'No open online slots for doctor'
    );
  } else {
    const target = openOnline[0]!;
    const existing = openOnline.map((s) => ({
      startsAt: s.starts_at as string,
      endsAt: s.ends_at as string,
      mode: s.mode as string,
    }));

    const clientConflict = findOverlap(
      {
        startsAt: target.starts_at as string,
        endsAt: target.ends_at as string,
        mode: 'offline',
      },
      existing
    );

    if (clientConflict) {
      record(
        'Overlap: client findOverlappingSlot',
        'PASS',
        `Flagged offline draft vs online ${target.starts_at}–${target.ends_at}`
      );
    } else {
      record(
        'Overlap: client findOverlappingSlot',
        'FAIL',
        'Did not flag same-window online/offline overlap'
      );
    }

    // Doctor UI inserts as the doctor user
    const doctorClient = await signIn(url, anonKey, DOCTOR_EMAIL, DOCTOR_PASSWORD);
    const { error: overlapInsertErr } = await doctorClient.from('appointment_slots').insert({
      doctor_id: doctorId,
      starts_at: target.starts_at,
      ends_at: target.ends_at,
      status: 'open',
      mode: 'offline',
    });

    if (overlapInsertErr) {
      const msg = overlapInsertErr.message;
      // Exact same starts_at hits unique index first; partial overlaps hit GiST.
      // Doctor UI maps both via formatSlotInsertError.
      const looksLikeOverlap =
        msg.includes('appointment_slots_no_overlap') ||
        msg.includes('appointment_slots_doctor_starts_unique') ||
        msg.includes('exclusion') ||
        msg.includes('duplicate key') ||
        msg.includes('23P01') ||
        msg.includes('23505') ||
        msg.toLowerCase().includes('overlap');
      record(
        'Overlap: DB reject cross-mode insert',
        looksLikeOverlap ? 'PASS' : 'FAIL',
        looksLikeOverlap
          ? `Blocked as expected: ${msg}`
          : `Unexpected error (not overlap constraint): ${msg}`
      );

      // Mirror doctor-admin formatSlotInsertError mapping for unique-start collisions.
      const friendly =
        msg.includes('appointment_slots_no_overlap') ||
        msg.includes('appointment_slots_doctor_starts_unique') ||
        msg.includes('exclusion') ||
        msg.includes('duplicate key') ||
        msg.includes('23P01') ||
        msg.includes('23505')
          ? 'That time overlaps another online or offline slot. Choose a free window.'
          : msg;
      record(
        'Overlap: doctor UI error mapping',
        friendly.startsWith('That time overlaps') ? 'PASS' : 'FAIL',
        friendly
      );
    } else {
      record(
        'Overlap: DB reject cross-mode insert',
        'FAIL',
        'Insert succeeded — overlap constraint did not block same-window online/offline slots'
      );
      // Clean up accidental insert
      await service
        .from('appointment_slots')
        .delete()
        .eq('doctor_id', doctorId)
        .eq('mode', 'offline')
        .eq('starts_at', target.starts_at)
        .eq('ends_at', target.ends_at);
    }
  }

  // --------------------------------------------------------------------------
  // Prep: create non-overlapping offline slots in a free evening window
  // --------------------------------------------------------------------------
  const day = new Date();
  day.setUTCDate(day.getUTCDate() + 3);
  day.setUTCHours(14, 0, 0, 0);

  const offlineWindows = [0, 30, 60, 90].map((offsetMin) => {
    const starts = new Date(day.getTime() + offsetMin * 60_000);
    const ends = new Date(starts.getTime() + 15 * 60_000);
    return { startsAt: starts.toISOString(), endsAt: ends.toISOString() };
  });

  // Ensure clean slate for those windows
  for (const w of offlineWindows) {
    await service
      .from('appointment_slots')
      .delete()
      .eq('doctor_id', doctorId)
      .eq('starts_at', w.startsAt)
      .eq('ends_at', w.endsAt);
  }

  const doctorClient = await signIn(url, anonKey, DOCTOR_EMAIL, DOCTOR_PASSWORD);
  const offlineSlotIds: string[] = [];

  for (const w of offlineWindows) {
    const { data: inserted, error: insertErr } = await doctorClient
      .from('appointment_slots')
      .insert({
        doctor_id: doctorId,
        starts_at: w.startsAt,
        ends_at: w.endsAt,
        status: 'open',
        mode: 'offline',
      })
      .select('id')
      .single();

    if (insertErr || !inserted) {
      record(
        `Prep: create offline slot ${w.startsAt}`,
        'FAIL',
        insertErr?.message ?? 'no row'
      );
    } else {
      offlineSlotIds.push(inserted.id as string);
    }
  }

  if (offlineSlotIds.length === offlineWindows.length) {
    record(
      'Prep: offline slots in free window',
      'PASS',
      `Created ${offlineSlotIds.length} offline open slots`
    );
  }

  // --------------------------------------------------------------------------
  // 2) Online booking
  // --------------------------------------------------------------------------
  {
    const patient = await signIn(url, anonKey, PATIENT_A, PATIENT_PASSWORD);
    const { data: slot, error: slotErr } = await service
      .from('appointment_slots')
      .select('id, starts_at, mode, status')
      .eq('doctor_id', doctorId)
      .eq('mode', 'online')
      .eq('status', 'open')
      .gt('starts_at', new Date(Date.now() + 60 * 60_000).toISOString())
      .order('starts_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (slotErr || !slot) {
      record('Online book: find slot', 'FAIL', slotErr?.message ?? 'No open online slot');
    } else {
      const { data: booking, error: bookErr } = await patient.rpc('book_appointment_slot', {
        p_slot_id: slot.id,
        p_mode: 'online',
        p_payment_method: 'online',
      });

      if (bookErr || !booking) {
        record('Online book: book_appointment_slot', 'FAIL', bookErr?.message ?? 'no booking');
      } else {
        const status = (booking as { status?: string }).status;
        const mode = (booking as { mode?: string }).mode;
        const paymentMethod = (booking as { payment_method?: string }).payment_method;
        const ok =
          status === 'pending_payment' && mode === 'online' && paymentMethod === 'online';
        record(
          'Online book: book_appointment_slot',
          ok ? 'PASS' : 'FAIL',
          `status=${status} mode=${mode} payment_method=${paymentMethod} id=${(booking as { id: string }).id}`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // 3) Offline booking — pay at clinic
  // --------------------------------------------------------------------------
  {
    const patient = await signIn(url, anonKey, PATIENT_B, PATIENT_PASSWORD);
    const slotId = offlineSlotIds[0];
    if (!slotId) {
      record('Offline clinic book', 'FAIL', 'No offline slot prepared');
    } else {
      const { data: booking, error: bookErr } = await patient.rpc('book_appointment_slot', {
        p_slot_id: slotId,
        p_mode: 'offline',
        p_payment_method: 'clinic',
      });

      if (bookErr || !booking) {
        record('Offline clinic book', 'FAIL', bookErr?.message ?? 'no booking');
      } else {
        const b = booking as {
          id: string;
          status?: string;
          mode?: string;
          payment_method?: string;
          payment_status?: string;
        };
        const ok =
          b.status === 'confirmed' &&
          b.mode === 'offline' &&
          b.payment_method === 'clinic' &&
          b.payment_status === 'unpaid';
        record(
          'Offline clinic book',
          ok ? 'PASS' : 'FAIL',
          `status=${b.status} mode=${b.mode} payment_method=${b.payment_method} payment_status=${b.payment_status} id=${b.id}`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // 4) Offline booking — pay online
  // --------------------------------------------------------------------------
  {
    const patient = await signIn(url, anonKey, PATIENT_C, PATIENT_PASSWORD);
    const slotId = offlineSlotIds[1];
    if (!slotId) {
      record('Offline online-pay book', 'FAIL', 'No offline slot prepared');
    } else {
      const { data: booking, error: bookErr } = await patient.rpc('book_appointment_slot', {
        p_slot_id: slotId,
        p_mode: 'offline',
        p_payment_method: 'online',
      });

      if (bookErr || !booking) {
        record('Offline online-pay book', 'FAIL', bookErr?.message ?? 'no booking');
      } else {
        const b = booking as {
          id: string;
          status?: string;
          mode?: string;
          payment_method?: string;
        };
        const ok =
          b.status === 'pending_payment' &&
          b.mode === 'offline' &&
          b.payment_method === 'online';
        record(
          'Offline online-pay book',
          ok ? 'PASS' : 'FAIL',
          `status=${b.status} mode=${b.mode} payment_method=${b.payment_method} id=${b.id}`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // 5) Overflow — blocked while open offline slots remain
  // --------------------------------------------------------------------------
  {
    const patient = await signIn(url, anonKey, PATIENT_D, PATIENT_PASSWORD);
    const starts = new Date(Date.now() + 4 * 24 * 60 * 60_000);
    starts.setUTCHours(10, 0, 0, 0);
    const ends = new Date(starts.getTime() + 2 * 60 * 60_000);

    const { error: overflowWhileOpenErr } = await patient.rpc(
      'request_offline_overflow_booking',
      {
        p_doctor_id: doctorId,
        p_preferred_starts_at: starts.toISOString(),
        p_preferred_ends_at: ends.toISOString(),
        p_preferred_note: 'should be blocked — slots still open',
        p_payment_method: 'clinic',
      }
    );

    if (overflowWhileOpenErr) {
      const msg = overflowWhileOpenErr.message;
      const expected = msg.toLowerCase().includes('open offline slots are available');
      record(
        'Overflow: blocked when offline slots open',
        expected ? 'PASS' : 'FAIL',
        expected ? `Blocked as expected: ${msg}` : `Unexpected: ${msg}`
      );
    } else {
      record(
        'Overflow: blocked when offline slots open',
        'FAIL',
        'Request succeeded even though open offline slots exist'
      );
    }
  }

  // Remove remaining open offline slots so overflow path unlocks
  const remainingOpen = offlineSlotIds.slice(2);
  if (remainingOpen.length) {
    const { error: delErr } = await service
      .from('appointment_slots')
      .delete()
      .in('id', remainingOpen)
      .eq('status', 'open');
    if (delErr) {
      record('Prep: clear remaining offline opens', 'FAIL', delErr.message);
    } else {
      record(
        'Prep: clear remaining offline opens',
        'PASS',
        `Deleted ${remainingOpen.length} open offline slots`
      );
    }
  }

  // Also cancel any other open offline for this doctor (safety)
  await service
    .from('appointment_slots')
    .update({ status: 'cancelled' })
    .eq('doctor_id', doctorId)
    .eq('mode', 'offline')
    .eq('status', 'open')
    .gt('starts_at', new Date().toISOString());

  // --------------------------------------------------------------------------
  // 6) Overflow request (clinic) + admin accept (new window)
  // --------------------------------------------------------------------------
  let overflowAcceptId: string | null = null;
  {
    const patient = await signIn(url, anonKey, PATIENT_D, PATIENT_PASSWORD);
    const starts = new Date(Date.now() + 5 * 24 * 60 * 60_000);
    starts.setUTCHours(11, 0, 0, 0);
    const ends = new Date(starts.getTime() + 2 * 60 * 60_000);

    const { data: booking, error: reqErr } = await patient.rpc(
      'request_offline_overflow_booking',
      {
        p_doctor_id: doctorId,
        p_preferred_starts_at: starts.toISOString(),
        p_preferred_ends_at: ends.toISOString(),
        p_preferred_note: 'Flow test — please assign',
        p_payment_method: 'clinic',
      }
    );

    if (reqErr || !booking) {
      record('Overflow: request (clinic)', 'FAIL', reqErr?.message ?? 'no booking');
    } else {
      const b = booking as {
        id: string;
        status?: string;
        mode?: string;
        slot_id?: string | null;
        payment_method?: string;
      };
      const ok =
        b.status === 'pending_admin' &&
        b.mode === 'offline' &&
        b.slot_id == null &&
        b.payment_method === 'clinic';
      overflowAcceptId = b.id;
      record(
        'Overflow: request (clinic)',
        ok ? 'PASS' : 'FAIL',
        `status=${b.status} mode=${b.mode} slot_id=${b.slot_id} payment_method=${b.payment_method} id=${b.id}`
      );
    }
  }

  {
    const adminClient = await signIn(url, anonKey, ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!overflowAcceptId) {
      record('Overflow: admin accept', 'FAIL', 'No pending booking to accept');
    } else {
      const assignStart = new Date(Date.now() + 5 * 24 * 60 * 60_000);
      assignStart.setUTCHours(15, 0, 0, 0);
      const assignEnd = new Date(assignStart.getTime() + 30 * 60_000);

      const { data: accepted, error: acceptErr } = await adminClient.rpc(
        'accept_overflow_booking',
        {
          p_booking_id: overflowAcceptId,
          p_slot_id: null,
          p_starts_at: assignStart.toISOString(),
          p_ends_at: assignEnd.toISOString(),
        }
      );

      if (acceptErr || !accepted) {
        record('Overflow: admin accept', 'FAIL', acceptErr?.message ?? 'no booking');
      } else {
        const b = accepted as {
          id: string;
          status?: string;
          slot_id?: string | null;
          mode?: string;
        };
        const ok = b.status === 'confirmed' && b.slot_id != null && b.mode === 'offline';
        record(
          'Overflow: admin accept',
          ok ? 'PASS' : 'FAIL',
          `status=${b.status} slot_id=${b.slot_id} mode=${b.mode} id=${b.id}`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // 7) Overflow request (online pay) + admin reject
  // --------------------------------------------------------------------------
  let overflowRejectId: string | null = null;
  {
    const patient = await signIn(url, anonKey, PATIENT_A, PATIENT_PASSWORD);
    // Clear any leftover pending for this patient+doctor first
    await service
      .from('bookings')
      .update({
        status: 'rejected',
        reject_reason: 'Cleared by flow test setup',
      })
      .eq('patient_id', (await service.from('patients').select('id').eq('email', PATIENT_A).single()).data?.id)
      .eq('doctor_id', doctorId)
      .eq('status', 'pending_admin');

    const starts = new Date(Date.now() + 6 * 24 * 60 * 60_000);
    starts.setUTCHours(9, 0, 0, 0);
    const ends = new Date(starts.getTime() + 3 * 60 * 60_000);

    const { data: booking, error: reqErr } = await patient.rpc(
      'request_offline_overflow_booking',
      {
        p_doctor_id: doctorId,
        p_preferred_starts_at: starts.toISOString(),
        p_preferred_ends_at: ends.toISOString(),
        p_preferred_note: 'Flow test — reject me',
        p_payment_method: 'online',
      }
    );

    if (reqErr || !booking) {
      record('Overflow: request (online pay)', 'FAIL', reqErr?.message ?? 'no booking');
    } else {
      const b = booking as {
        id: string;
        status?: string;
        payment_method?: string;
      };
      overflowRejectId = b.id;
      const ok = b.status === 'pending_admin' && b.payment_method === 'online';
      record(
        'Overflow: request (online pay)',
        ok ? 'PASS' : 'FAIL',
        `status=${b.status} payment_method=${b.payment_method} id=${b.id}`
      );
    }
  }

  {
    const adminClient = await signIn(url, anonKey, ADMIN_EMAIL, ADMIN_PASSWORD);
    if (!overflowRejectId) {
      record('Overflow: admin reject', 'FAIL', 'No pending booking to reject');
    } else {
      const { data: rejected, error: rejectErr } = await adminClient.rpc(
        'reject_overflow_booking',
        {
          p_booking_id: overflowRejectId,
          p_reject_reason: 'No capacity this week (flow test)',
        }
      );

      if (rejectErr || !rejected) {
        record('Overflow: admin reject', 'FAIL', rejectErr?.message ?? 'no booking');
      } else {
        const b = rejected as {
          id: string;
          status?: string;
          reject_reason?: string | null;
        };
        const ok = b.status === 'rejected' && Boolean(b.reject_reason);
        record(
          'Overflow: admin reject',
          ok ? 'PASS' : 'FAIL',
          `status=${b.status} reject_reason=${b.reject_reason} id=${b.id}`
        );
      }
    }
  }

  // --------------------------------------------------------------------------
  // 8) Accept into overlapping window should fail
  // --------------------------------------------------------------------------
  {
    // Create a fresh pending_admin via patient C
    const patient = await signIn(url, anonKey, PATIENT_C, PATIENT_PASSWORD);
    await service
      .from('bookings')
      .update({
        status: 'rejected',
        reject_reason: 'Cleared by flow test setup',
      })
      .eq(
        'patient_id',
        (await service.from('patients').select('id').eq('email', PATIENT_C).single()).data?.id
      )
      .eq('doctor_id', doctorId)
      .eq('status', 'pending_admin');

    const prefStart = new Date(Date.now() + 7 * 24 * 60 * 60_000);
    prefStart.setUTCHours(10, 0, 0, 0);
    const prefEnd = new Date(prefStart.getTime() + 2 * 60 * 60_000);

    const { data: pending, error: pendingErr } = await patient.rpc(
      'request_offline_overflow_booking',
      {
        p_doctor_id: doctorId,
        p_preferred_starts_at: prefStart.toISOString(),
        p_preferred_ends_at: prefEnd.toISOString(),
        p_preferred_note: 'overlap accept test',
        p_payment_method: 'clinic',
      }
    );

    if (pendingErr || !pending) {
      record(
        'Overflow: request for overlap-accept test',
        'FAIL',
        pendingErr?.message ?? 'no booking'
      );
    } else {
      const pendingId = (pending as { id: string }).id;
      // Use an existing online slot window for this doctor
      const { data: onlineSlot } = await service
        .from('appointment_slots')
        .select('starts_at, ends_at')
        .eq('doctor_id', doctorId)
        .eq('mode', 'online')
        .neq('status', 'cancelled')
        .gt('starts_at', new Date().toISOString())
        .order('starts_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      const adminClient = await signIn(url, anonKey, ADMIN_EMAIL, ADMIN_PASSWORD);

      if (!onlineSlot) {
        record(
          'Overflow: accept into overlapping online window',
          'FAIL',
          'No online slot available to conflict with'
        );
      } else {
        const { error: acceptOverlapErr } = await adminClient.rpc('accept_overflow_booking', {
          p_booking_id: pendingId,
          p_slot_id: null,
          p_starts_at: onlineSlot.starts_at,
          p_ends_at: onlineSlot.ends_at,
        });

        if (acceptOverlapErr) {
          const msg = acceptOverlapErr.message;
          const expected = msg
            .toLowerCase()
            .includes('overlaps an existing slot for this doctor');
          record(
            'Overflow: accept into overlapping online window',
            expected ? 'PASS' : 'FAIL',
            expected ? `Blocked as expected: ${msg}` : `Unexpected: ${msg}`
          );
        } else {
          record(
            'Overflow: accept into overlapping online window',
            'FAIL',
            'Accept succeeded into a window that overlaps an existing online slot'
          );
        }

        // Cleanup leftover pending if still pending
        await service
          .from('bookings')
          .update({
            status: 'rejected',
            reject_reason: 'Cleanup after overlap accept test',
          })
          .eq('id', pendingId)
          .eq('status', 'pending_admin');
      }
    }
  }

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  console.log('\n=== Summary ===');
  const fails = results.filter((r) => r.status === 'FAIL');
  const passes = results.filter((r) => r.status === 'PASS');
  console.log(`PASS: ${passes.length}`);
  console.log(`FAIL: ${fails.length}`);
  if (fails.length) {
    console.log('\nErrors / failures (not fixed):');
    for (const f of fails) {
      console.log(`- [${f.name}] ${f.detail}`);
    }
  } else {
    console.log('\nNo failures observed.');
  }
}

main().catch((err) => {
  console.error('\nTest harness crashed:', errMsg(err));
  process.exit(1);
});
