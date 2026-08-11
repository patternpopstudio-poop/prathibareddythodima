/**
 * Seed 6 demo patients (Auth users + completed patient profiles).
 *
 * Usage (from apps/backend):
 *   npm run seed:patients
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env
 * Default password for all seed patients: PatientSeed123!
 */
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config();

const SEED_PASSWORD = process.env.SEED_PATIENT_PASSWORD ?? 'PatientSeed123!';

const SEED_PATIENTS = [
  {
    fullName: 'Rahul Sharma',
    email: 'rahul.sharma@demo.teleconsult.local',
    mobile: '+919876550001',
    dateOfBirth: '1990-03-15',
    gender: 'male' as const,
    city: 'Hyderabad',
    heightCm: 175,
    weightKg: 78,
    bloodGroup: 'B+' as const,
    allergies: 'Penicillin',
    chronicAilments: null,
    pastSurgeries: null,
    familyHistory: 'Father: hypertension',
    currentMedications: null,
  },
  {
    fullName: 'Sneha Patel',
    email: 'sneha.patel@demo.teleconsult.local',
    mobile: '+919876550002',
    dateOfBirth: '1995-07-22',
    gender: 'female' as const,
    city: 'Bengaluru',
    heightCm: 162,
    weightKg: 58,
    bloodGroup: 'O+' as const,
    allergies: null,
    chronicAilments: 'Mild asthma',
    pastSurgeries: null,
    familyHistory: null,
    currentMedications: 'Inhaler as needed',
  },
  {
    fullName: 'Karthik Reddy',
    email: 'karthik.reddy@demo.teleconsult.local',
    mobile: '+919876550003',
    dateOfBirth: '1988-11-08',
    gender: 'male' as const,
    city: 'Chennai',
    heightCm: 180,
    weightKg: 85,
    bloodGroup: 'A+' as const,
    allergies: 'Dust mites',
    chronicAilments: 'Type 2 diabetes',
    pastSurgeries: 'Appendectomy (2015)',
    familyHistory: 'Mother: diabetes',
    currentMedications: 'Metformin 500mg',
  },
  {
    fullName: 'Anjali Menon',
    email: 'anjali.menon@demo.teleconsult.local',
    mobile: '+919876550004',
    dateOfBirth: '1992-01-30',
    gender: 'female' as const,
    city: 'Kochi',
    heightCm: 158,
    weightKg: 54,
    bloodGroup: 'AB+' as const,
    allergies: null,
    chronicAilments: null,
    pastSurgeries: null,
    familyHistory: null,
    currentMedications: null,
  },
  {
    fullName: 'Vikash Gupta',
    email: 'vikash.gupta@demo.teleconsult.local',
    mobile: '+919876550005',
    dateOfBirth: '1985-09-12',
    gender: 'male' as const,
    city: 'Mumbai',
    heightCm: 170,
    weightKg: 72,
    bloodGroup: 'O-' as const,
    allergies: 'Sulfa drugs',
    chronicAilments: 'Hypertension',
    pastSurgeries: null,
    familyHistory: 'Both parents: hypertension',
    currentMedications: 'Amlodipine 5mg',
  },
  {
    fullName: 'Divya Krishnan',
    email: 'divya.krishnan@demo.teleconsult.local',
    mobile: '+919876550006',
    dateOfBirth: '1998-05-04',
    gender: 'female' as const,
    city: 'Pune',
    heightCm: 165,
    weightKg: 60,
    bloodGroup: 'B-' as const,
    allergies: 'Peanuts',
    chronicAilments: null,
    pastSurgeries: 'Wisdom tooth extraction (2021)',
    familyHistory: null,
    currentMedications: null,
  },
] as const;

async function findUserIdByEmail(
  admin: ReturnType<typeof createClient>,
  email: string
): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (error) throw error;
  const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

async function ensurePatientUser(
  admin: ReturnType<typeof createClient>,
  patient: (typeof SEED_PATIENTS)[number]
): Promise<string> {
  const email = patient.email.toLowerCase();
  const existingId = await findUserIdByEmail(admin, email);

  const userMetadata = {
    role: 'patient',
    full_name: patient.fullName,
    mobile: patient.mobile,
    account_source: 'b2c',
    date_of_birth: patient.dateOfBirth,
    gender: patient.gender,
  };

  if (existingId) {
    const { error } = await admin.auth.admin.updateUserById(existingId, {
      password: SEED_PASSWORD,
      email_confirm: true,
      app_metadata: { role: 'patient' },
      user_metadata: userMetadata,
    });
    if (error) throw error;
    return existingId;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: SEED_PASSWORD,
    email_confirm: true,
    app_metadata: { role: 'patient' },
    user_metadata: userMetadata,
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? `Failed to create ${email}`);
  }
  return data.user.id;
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

  console.log(`Seeding ${SEED_PATIENTS.length} patients → ${url}`);

  for (const patient of SEED_PATIENTS) {
    process.stdout.write(`• ${patient.fullName} … `);
    const userId = await ensurePatientUser(admin, patient);

    // Drop accidental doctor row if a prior seed mis-assigned role.
    await admin.from('doctors').delete().eq('id', userId);

    const { error: upsertError } = await admin.from('patients').upsert(
      {
        id: userId,
        full_name: patient.fullName,
        email: patient.email.toLowerCase(),
        mobile: patient.mobile,
        date_of_birth: patient.dateOfBirth,
        gender: patient.gender,
        city: patient.city,
        account_source: 'b2c',
        employer_id: null,
        profile_completed: true,
        height_cm: patient.heightCm,
        weight_kg: patient.weightKg,
        blood_group: patient.bloodGroup,
        allergies: patient.allergies,
        chronic_ailments: patient.chronicAilments,
        past_surgeries: patient.pastSurgeries,
        family_history: patient.familyHistory,
        current_medications: patient.currentMedications,
      },
      { onConflict: 'id' }
    );
    if (upsertError) throw upsertError;

    console.log(`ok (${userId})`);
  }

  console.log('\nDone. Login password for all seed patients:', SEED_PASSWORD);
  console.log('Emails:');
  for (const p of SEED_PATIENTS) {
    console.log(`  ${p.email}`);
  }
}

main().catch((err) => {
  console.error('\nSeed failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
