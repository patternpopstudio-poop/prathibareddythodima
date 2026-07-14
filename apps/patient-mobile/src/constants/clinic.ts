import type { AppIconName } from '@/components/ui/icon';
import { ClinicImages } from '@/constants/images';

/** Clinic content aligned with https://prathibareddythodima.com/ */

export const CLINIC = {
  doctorName: 'Dr. Prathiba Reddy',
  specialty: 'ENT, Allergy & Vertigo Specialist',
  experienceYears: 10,
  rating: 5.0,
  reviewCount: 24,
  clinicName: 'Care Hospitals, Banjara Hills',
  tagline: 'Expert ENT, Allergy & Vertigo care. Personalized for every patient.',
  about:
    'Consultant ENT Surgeon with over 10 years of experience in ear, nose, and throat care, with a special interest in allergy and vertigo.',
  languages: ['English', 'Telugu', 'Hindi', 'Kannada'],
  photo: ClinicImages.doctor,
} as const;

export const CLINICIAN_META: { icon: AppIconName; text: string; strong?: boolean }[] = [
  { icon: 'hospital', text: CLINIC.clinicName, strong: true },
  { icon: 'hearing', text: `Languages: ${CLINIC.languages.join(', ')}` },
  { icon: 'star', text: `${CLINIC.experienceYears}+ years experience` },
];

export const QUICK_ACTIONS = [
  {
    id: 'profile',
    title: 'Profile',
    subtitle: 'Details & health history',
    icon: 'person' as const,
    href: '/(app)/profile' as const,
  },
  {
    id: 'prescriptions',
    title: 'Rx',
    subtitle: 'Prescription history',
    icon: 'medication' as const,
    href: '/(app)/prescriptions' as const,
  },
  {
    id: 'labs',
    title: 'Labs',
    subtitle: 'Reports & uploads',
    icon: 'lab' as const,
    href: '/(app)/lab-reports' as const,
  },
] as const;

export const CARE_SERVICES = [
  {
    id: 'ear',
    title: 'Ear care',
    description: 'Infections, hearing loss, tinnitus, wax removal, vertigo & balance',
    icon: 'ear' as const,
    image: ClinicImages.services.ear,
  },
  {
    id: 'nose',
    title: 'Nose & sinus',
    description: 'Sinusitis, allergic rhinitis, congestion, nosebleeds, septum',
    icon: 'nose' as const,
    image: ClinicImages.services.nose,
  },
  {
    id: 'throat',
    title: 'Throat & voice',
    description: 'Tonsillitis, swallowing, voice disorders, sleep issues',
    icon: 'throat' as const,
    image: ClinicImages.services.throat,
  },
  {
    id: 'specialized',
    title: 'Specialized care',
    description: 'Allergy, immunotherapy, thyroid, head & neck concerns',
    icon: 'specialty' as const,
    image: ClinicImages.services.specialized,
  },
  {
    id: 'pediatric',
    title: 'Pediatric ENT',
    description: 'Children’s ear infections, tonsils, hearing, breathing',
    icon: 'pediatric' as const,
    image: ClinicImages.services.pediatric,
  },
] as const;
