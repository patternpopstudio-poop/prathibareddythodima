/**
 * Bundled clinic imagery (WebP). Keep this list lean — only what screens import.
 */

/** Brand / redesign mockup art */
export const BrandImages = {
  /** Generated high-res splash matching TeleConsult redesign */
  splash: require('@/assets/images/brand/splash-screen.png'),
  /** Login hero — doctor phone + plant illustration */
  loginHero: require('@/assets/images/brand/login-hero.png'),
  /** Basic details onboarding — clipboard + plant + shield */
  basicDetailsHero: require('@/assets/images/brand/basic-details-hero.png'),
  /** Home book-consultation card — calendar + stethoscope */
  bookConsultHero: require('@/assets/images/brand/book-consult-hero.png'),
  googleLogo: require('@/assets/images/brand/google-logo.png'),
  appleLogo: require('@/assets/images/brand/apple-logo.png'),
  quickAccess: {
    profile: require('@/assets/images/brand/home/quick-profile.png'),
    prescriptions: require('@/assets/images/brand/home/quick-prescriptions.png'),
    labs: require('@/assets/images/brand/home/quick-labs.png'),
    insurance: require('@/assets/images/brand/home/quick-insurance.png'),
  },
  exploreCare: {
    ent: require('@/assets/images/brand/home/explore-ent.png'),
    cardiology: require('@/assets/images/brand/home/explore-cardiology.png'),
    dermatology: require('@/assets/images/brand/home/explore-dermatology.png'),
    gastro: require('@/assets/images/brand/home/explore-gastro.png'),
  },
} as const;

export const ClinicImages = {
  welcome: require('@/assets/images/clinic/welcome.webp'),
  hero: require('@/assets/images/clinic/hero.webp'),
  care: require('@/assets/images/clinic/care.webp'),
  doctor: require('@/assets/images/clinic/doctor.webp'),
  services: {
    ear: require('@/assets/images/clinic/service-ear.webp'),
    nose: require('@/assets/images/clinic/service-nose.webp'),
    throat: require('@/assets/images/clinic/service-throat.webp'),
    specialized: require('@/assets/images/clinic/service-specialty.webp'),
    pediatric: require('@/assets/images/clinic/service-pediatric.webp'),
  },
} as const;
