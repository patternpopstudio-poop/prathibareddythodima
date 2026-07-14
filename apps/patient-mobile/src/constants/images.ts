/**
 * Bundled clinic imagery (WebP). Keep this list lean — only what screens import.
 */
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
