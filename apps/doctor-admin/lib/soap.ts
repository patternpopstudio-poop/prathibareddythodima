import type {
  SoapNote,
  SoapNoteRow,
} from '@teleconsult/shared-types';
import {
  SOAP_FIELD_MAX_LENGTH,
  mapSoapNoteRow,
} from '@teleconsult/shared-types';

import type { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { createClient } from '@/lib/supabase/server';

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type BrowserSupabase = ReturnType<typeof createBrowserClient>;

export type SoapNoteDraftInput = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  followUp: boolean;
};

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertFieldLength(label: string, value: string): void {
  if (value.length > SOAP_FIELD_MAX_LENGTH) {
    throw new Error(`${label} must be ${SOAP_FIELD_MAX_LENGTH} characters or fewer.`);
  }
}

export async function fetchSoapNote(
  supabase: ServerSupabase | BrowserSupabase,
  consultationId: string
): Promise<SoapNote | null> {
  const { data, error } = await supabase
    .from('soap_notes')
    .select('*')
    .eq('consultation_id', consultationId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return mapSoapNoteRow(data as SoapNoteRow);
}

export async function saveSoapNoteDraft(
  supabase: BrowserSupabase,
  consultationId: string,
  draft: SoapNoteDraftInput
): Promise<SoapNote> {
  assertFieldLength('Subjective', draft.subjective);
  assertFieldLength('Objective', draft.objective);
  assertFieldLength('Assessment', draft.assessment);
  assertFieldLength('Plan', draft.plan);

  const { data, error } = await supabase
    .from('soap_notes')
    .upsert(
      {
        consultation_id: consultationId,
        subjective: emptyToNull(draft.subjective),
        objective: emptyToNull(draft.objective),
        assessment: emptyToNull(draft.assessment),
        plan: emptyToNull(draft.plan),
        follow_up: draft.followUp,
      },
      { onConflict: 'consultation_id' }
    )
    .select('*')
    .single();

  if (error) throw error;
  if (!data) throw new Error('Could not save SOAP notes.');
  return mapSoapNoteRow(data as SoapNoteRow);
}

/** Copy patient-visible diagnosis into SOAP Assessment without wiping other SOAP fields. */
export async function syncSoapAssessment(
  supabase: BrowserSupabase,
  consultationId: string,
  assessment: string
): Promise<void> {
  assertFieldLength('Assessment', assessment);
  const trimmed = emptyToNull(assessment);
  if (!trimmed) {
    throw new Error('Diagnosis is required.');
  }

  const { error } = await supabase.from('soap_notes').upsert(
    {
      consultation_id: consultationId,
      assessment: trimmed,
    },
    { onConflict: 'consultation_id' }
  );

  if (error) throw error;
}
