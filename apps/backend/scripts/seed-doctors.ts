/**
 * Seed 6 demo doctors (Auth users + doctors rows + photos).
 *
 * Usage (from apps/backend):
 *   npm run seed:doctors
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * Default password for all seed doctors: DoctorSeed123!
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

config();

const DOCTOR_PHOTOS_BUCKET = 'doctor-photos';
const SEED_PASSWORD = process.env.SEED_DOCTOR_PASSWORD ?? 'DoctorSeed123!';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, 'assets', 'doctors');

const SEED_DOCTORS = [
  {
    fullName: 'Dr. Arjun Mehta',
    email: 'arjun.mehta@demo.teleconsult.local',
    mobile: '+919876540001',
    photoFile: 'doctor-1-arjun-mehta.png',
    consultationFeePaise: 50000, // ₹500
  },
  {
    fullName: 'Dr. Priya Nair',
    email: 'priya.nair@demo.teleconsult.local',
    mobile: '+919876540002',
    photoFile: 'doctor-2-priya-nair.png',
    consultationFeePaise: 60000, // ₹600
  },
  {
    fullName: 'Dr. Vikram Rao',
    email: 'vikram.rao@demo.teleconsult.local',
    mobile: '+919876540003',
    photoFile: 'doctor-3-vikram-rao.png',
    consultationFeePaise: 70000, // ₹700
  },
  {
    fullName: 'Dr. Ananya Krishnan',
    email: 'ananya.krishnan@demo.teleconsult.local',
    mobile: '+919876540004',
    photoFile: 'doctor-4-ananya-krishnan.png',
    consultationFeePaise: 55000, // ₹550
  },
  {
    fullName: 'Dr. Suresh Iyer',
    email: 'suresh.iyer@demo.teleconsult.local',
    mobile: '+919876540005',
    photoFile: 'doctor-5-suresh-iyer.png',
    consultationFeePaise: 45000, // ₹450
  },
  {
    fullName: 'Dr. Meera Desai',
    email: 'meera.desai@demo.teleconsult.local',
    mobile: '+919876540006',
    photoFile: 'doctor-6-meera-desai.png',
    consultationFeePaise: 40000, // ₹400
  },
] as const;

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  // Paginate listUsers — small projects stay on page 1.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function ensureDoctorUser(
  admin: ReturnType<typeof createClient>,
  doctor: (typeof SEED_DOCTORS)[number]
): Promise<string> {
  const email = doctor.email.toLowerCase();
  const existingId = await findUserIdByEmail(admin, email);

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password: SEED_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'doctor' },
      user_metadata: {
        role: 'doctor',
        full_name: doctor.fullName,
        mobile: doctor.mobile,
      },
    });
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'doctor' },
    user_metadata: {
      role: 'doctor',
      full_name: doctor.fullName,
      mobile: doctor.mobile,
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create ${email}`);
  }
  return data.user.id;
}

async function uploadPhoto(
  admin: ReturnType<typeof createClient>,
  doctorId: string,
  photoFile: string
): Promise<string> {
  const path = `${doctorId}/avatar.png`;
  const filePath = join(assetsDir, photoFile);
  const bytes = readFileSync(filePath);

  const { error: uploadError } = await admin.storage
    .from(DOCTOR_PHOTOS_BUCKET)
    .upload(path, bytes, {
      contentType: 'image/png',
      upsert: true,
    });
  if (uploadError) throw uploadError;

  const { data } = admin.storage.from(DOCTOR_PHOTOS_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function main() {
  const url = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey || serviceRoleKey === 'your-service-role-key') {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  }

  const admin = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Seeding ${SEED_DOCTORS.length} doctors → ${url}`);

  for (const doctor of SEED_DOCTORS) {
    process.stdout.write(`• ${doctor.fullName} … `);
    const userId = await ensureDoctorUser(admin, doctor);

    // Clear accidental patient row from insert trigger race, then upsert doctor.
    await admin.from('patients').delete().eq('id', userId);

    const photoUrl = await uploadPhoto(admin, userId, doctor.photoFile);

    const { error: upsertError } = await admin.from('doctors').upsert(
      {
        id: userId,
        full_name: doctor.fullName,
        email: doctor.email.toLowerCase(),
        mobile: doctor.mobile,
        photo_url: photoUrl,
        is_active: true,
        consultation_fee_paise: doctor.consultationFeePaise,
      },
      { onConflict: 'id' }
    );
    if (upsertError) throw upsertError;

    console.log(`ok (${userId})`);
  }

  console.log('\nDone. Login password for all seed doctors:', SEED_PASSWORD);
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
