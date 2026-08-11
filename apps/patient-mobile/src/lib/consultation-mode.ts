import type { ConsultationMode } from '@teleconsult/shared-types';
import { consultationModeLabel, parseConsultationMode } from '@teleconsult/shared-types';

export { consultationModeLabel, parseConsultationMode };
export type { ConsultationMode };

export function consultationModeSubtitle(mode: ConsultationMode): string {
  return mode === 'offline'
    ? 'Visit the clinic in person'
    : 'Chat with your doctor from home';
}

export function consultationModeSpecialtyLabel(mode: ConsultationMode): string {
  return mode === 'offline' ? 'In-clinic visit' : 'Online consult';
}
