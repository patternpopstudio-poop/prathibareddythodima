import type { AppIconName } from '@/components/ui/icon';
import { BrandImages, ClinicImages } from '@/constants/images';

/** Clinic content aligned with https://prathibareddythodima.com/ */

export const CLINIC = {
  doctorName: 'Dr. Prathiba Reddy',
  specialty: 'ENT, Allergy & Vertigo Specialist',
  /** Compact label for home appointment card */
  specialtyShort: 'ENT Specialist',
  experienceYears: 10,
  rating: 5.0,
  reviewCount: 24,
  clinicName: 'Care Hospitals, Banjara Hills',
  tagline: 'Connect with top specialists from the comfort of your home.',
  about:
    'Consultant ENT Surgeon with over 10 years of experience in ear, nose, and throat care, with a special interest in allergy and vertigo.',
  languages: ['English', 'Hindi', 'Tamil', 'Telugu'],
  photo: ClinicImages.doctor,
  /** Shown when patient tries to cancel inside the free-cancel cutoff window. */
  cancelContactMessage:
    'Please contact Care Hospitals, Banjara Hills to cancel or reschedule this appointment.',
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
    subtitle: 'Health details & history',
    image: BrandImages.quickAccess.profile,
    href: '/(app)/profile' as const,
  },
  {
    id: 'prescriptions',
    title: 'Prescriptions',
    subtitle: 'View your prescriptions',
    image: BrandImages.quickAccess.prescriptions,
    href: '/(app)/prescriptions' as const,
  },
  {
    id: 'labs',
    title: 'Labs',
    subtitle: 'Reports & uploads',
    image: BrandImages.quickAccess.labs,
    href: '/(app)/lab-reports' as const,
  },
  {
    id: 'insurance',
    title: 'Insurance',
    subtitle: 'Policy & claims',
    image: BrandImages.quickAccess.insurance,
    href: '/(app)/profile' as const,
  },
] as const;

/** Explore care cards on home (mockup specialties). */
export const EXPLORE_CARE = [
  {
    id: 'ent',
    title: 'ENT Care',
    description: 'Ear, nose & throat',
    image: BrandImages.exploreCare.ent,
  },
  {
    id: 'cardiology',
    title: 'Cardiology',
    description: 'Heart & circulation',
    image: BrandImages.exploreCare.cardiology,
  },
  {
    id: 'dermatology',
    title: 'Dermatology',
    description: 'Skin & hair care',
    image: BrandImages.exploreCare.dermatology,
  },
  {
    id: 'gastro',
    title: 'Gastroenterology',
    description: 'Digestion & care',
    image: BrandImages.exploreCare.gastro,
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
