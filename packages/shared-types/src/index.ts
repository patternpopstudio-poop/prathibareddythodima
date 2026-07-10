/**
 * Shared database interfaces and types for the teleconsult platform.
 * Import from @teleconsult/shared-types across apps and packages.
 */

export type UserRole = 'patient' | 'doctor' | 'admin';

export interface BaseEntity {
  id: string;
  createdAt: string;
  updatedAt: string;
}
