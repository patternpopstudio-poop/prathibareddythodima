-- Phase 2: doctor specialty + degrees (ENT clinic profiles)

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS specialty text NOT NULL DEFAULT 'ENT Specialist';

ALTER TABLE public.doctors
  ADD COLUMN IF NOT EXISTS degrees text NOT NULL DEFAULT 'MBBS, MS (ENT)';

COMMENT ON COLUMN public.doctors.specialty IS
  'Clinical specialty shown to patients (clinic is ENT-focused).';

COMMENT ON COLUMN public.doctors.degrees IS
  'Qualification string shown to patients, e.g. MBBS, MS (ENT).';

-- Assign varied ENT specialty / degree combos to existing doctors
WITH ranked AS (
  SELECT
    id,
    (row_number() OVER (ORDER BY created_at, id) - 1) AS idx
  FROM public.doctors
),
picks AS (
  SELECT
    id,
    (ARRAY[
      'ENT Specialist',
      'ENT, Allergy & Vertigo Specialist',
      'Otolaryngologist (ENT)',
      'Otology & Neurotology',
      'Rhinology & Sinus Specialist',
      'Head & Neck / ENT Specialist'
    ])[1 + (idx % 6)] AS specialty,
    (ARRAY[
      'MBBS, MS (ENT)',
      'MBBS, DLO, MS (ENT)',
      'MBBS, MS (ORL)',
      'MBBS, MS (ENT), DNB (ENT)',
      'MBBS, Diploma in Otorhinolaryngology',
      'MBBS, MS (ENT), Fellowship in Rhinology'
    ])[1 + (idx % 6)] AS degrees
  FROM ranked
)
UPDATE public.doctors d
SET
  specialty = picks.specialty,
  degrees = picks.degrees
FROM picks
WHERE d.id = picks.id;
