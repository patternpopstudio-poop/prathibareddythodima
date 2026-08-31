import type {
  Prescription,
  PrescriptionItem,
  PrescriptionItemRow,
  PrescriptionRow,
} from '@teleconsult/shared-types';
import {
  PATIENT_DIAGNOSIS_MAX_LENGTH,
  PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH,
  PRESCRIPTION_ITEM_FIELD_MAX_LENGTH,
  mapPrescriptionItemRow,
  mapPrescriptionRow,
} from '@teleconsult/shared-types';

import type { createClient as createBrowserClient } from '@/lib/supabase/client';
import type { createClient } from '@/lib/supabase/server';
import { syncSoapAssessment } from '@/lib/soap';

type ServerSupabase = Awaited<ReturnType<typeof createClient>>;
type BrowserSupabase = ReturnType<typeof createBrowserClient>;

export type IssuedPrescription = {
  prescription: Prescription;
  items: PrescriptionItem[];
};

export type PrescriptionItemInput = {
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type PrescriptionJoinRow = PrescriptionRow & {
  prescription_items?: PrescriptionItemRow[] | PrescriptionItemRow | null;
};

function firstList<T>(value: T | T[] | null | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function assertLen(label: string, value: string, max: number): void {
  if (value.length > max) {
    throw new Error(`${label} must be ${max} characters or fewer.`);
  }
}

function normalizeItems(items: PrescriptionItemInput[]): PrescriptionItemInput[] {
  const complete: PrescriptionItemInput[] = [];
  for (const item of items) {
    const drugName = item.drugName.trim();
    const dosage = item.dosage.trim();
    const frequency = item.frequency.trim();
    const duration = item.duration.trim();
    const instructions = item.instructions.trim();
    const anyFilled = Boolean(drugName || dosage || frequency || duration || instructions);
    if (!anyFilled) continue;
    if (!drugName || !dosage || !frequency || !duration) {
      throw new Error(
        'Each medicine needs a name, dosage, frequency, and duration. Remove empty extra rows.'
      );
    }
    assertLen('Medicine name', drugName, PRESCRIPTION_ITEM_FIELD_MAX_LENGTH);
    assertLen('Dosage', dosage, PRESCRIPTION_ITEM_FIELD_MAX_LENGTH);
    assertLen('Frequency', frequency, PRESCRIPTION_ITEM_FIELD_MAX_LENGTH);
    assertLen('Duration', duration, PRESCRIPTION_ITEM_FIELD_MAX_LENGTH);
    assertLen('Instructions', instructions, PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH);
    complete.push({
      drugName,
      dosage,
      frequency,
      duration,
      instructions,
    });
  }
  if (complete.length === 0) {
    throw new Error('Add at least one medicine.');
  }
  return complete;
}

export async function fetchIssuedPrescription(
  supabase: ServerSupabase | BrowserSupabase,
  consultationId: string
): Promise<IssuedPrescription | null> {
  const { data, error } = await supabase
    .from('prescriptions')
    .select('*, prescription_items (*)')
    .eq('consultation_id', consultationId)
    .eq('status', 'issued')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const row = data as PrescriptionJoinRow;
  const items = firstList(row.prescription_items)
    .map(mapPrescriptionItemRow)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    prescription: mapPrescriptionRow(row),
    items,
  };
}

export async function saveIssuedPrescription(
  supabase: BrowserSupabase,
  consultationId: string,
  diagnosis: string,
  items: PrescriptionItemInput[]
): Promise<IssuedPrescription> {
  const patientDiagnosis = diagnosis.trim();
  if (!patientDiagnosis) {
    throw new Error('Diagnosis is required on the prescription.');
  }
  assertLen('Diagnosis', patientDiagnosis, PATIENT_DIAGNOSIS_MAX_LENGTH);
  const normalized = normalizeItems(items);

  await syncSoapAssessment(supabase, consultationId, patientDiagnosis);

  const existing = await fetchIssuedPrescription(supabase, consultationId);

  let prescriptionId: string;
  if (existing) {
    const { error } = await supabase
      .from('prescriptions')
      .update({ patient_diagnosis: patientDiagnosis })
      .eq('id', existing.prescription.id);
    if (error) throw error;
    prescriptionId = existing.prescription.id;

    const { error: deleteError } = await supabase
      .from('prescription_items')
      .delete()
      .eq('prescription_id', prescriptionId);
    if (deleteError) throw deleteError;
  } else {
    const { data, error } = await supabase
      .from('prescriptions')
      .insert({
        consultation_id: consultationId,
        version: 1,
        status: 'issued',
        patient_diagnosis: patientDiagnosis,
      })
      .select('*')
      .single();
    if (error) throw error;
    if (!data) throw new Error('Could not save prescription.');
    prescriptionId = (data as PrescriptionRow).id;
  }

  const { error: insertError } = await supabase.from('prescription_items').insert(
    normalized.map((item, index) => ({
      prescription_id: prescriptionId,
      sort_order: index,
      drug_name: item.drugName,
      dosage: item.dosage,
      frequency: item.frequency,
      duration: item.duration,
      instructions: emptyToNull(item.instructions),
    }))
  );
  if (insertError) throw insertError;

  const saved = await fetchIssuedPrescription(supabase, consultationId);
  if (!saved) throw new Error('Could not load the saved prescription.');
  return saved;
}
