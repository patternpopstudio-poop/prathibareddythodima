'use client';

import type { PrescriptionItem } from '@teleconsult/shared-types';
import {
  PATIENT_DIAGNOSIS_MAX_LENGTH,
  PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH,
  PRESCRIPTION_ITEM_FIELD_MAX_LENGTH,
} from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import type { IssuedPrescription } from '@/lib/prescriptions';
import { saveIssuedPrescription } from '@/lib/prescriptions';
import { createClient } from '@/lib/supabase/client';

type DraftItem = {
  key: string;
  drugName: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions: string;
};

type Props = {
  consultationId: string;
  initialDiagnosis: string;
  initialIssued: IssuedPrescription | null;
};

const inputClass =
  'w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary disabled:opacity-60';

function newItem(seed?: PrescriptionItem): DraftItem {
  return {
    key: seed?.id ?? crypto.randomUUID(),
    drugName: seed?.drugName ?? '',
    dosage: seed?.dosage ?? '',
    frequency: seed?.frequency ?? '',
    duration: seed?.duration ?? '',
    instructions: seed?.instructions ?? '',
  };
}

export function PrescriptionForm({
  consultationId,
  initialDiagnosis,
  initialIssued,
}: Props) {
  const router = useRouter();
  const [diagnosis, setDiagnosis] = useState(
    (initialIssued?.prescription.patientDiagnosis ?? initialDiagnosis).slice(
      0,
      PATIENT_DIAGNOSIS_MAX_LENGTH
    )
  );
  const [items, setItems] = useState<DraftItem[]>(
    initialIssued?.items.length
      ? initialIssued.items.map((item) => newItem(item))
      : [newItem()]
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  function updateItem(key: string, patch: Partial<DraftItem>) {
    setItems((current) =>
      current.map((item) => (item.key === key ? { ...item, ...patch } : item))
    );
  }

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const supabase = createClient();
      await saveIssuedPrescription(
        supabase,
        consultationId,
        diagnosis,
        items.map(({ drugName, dosage, frequency, duration, instructions }) => ({
          drugName,
          dosage,
          frequency,
          duration,
          instructions,
        }))
      );
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save prescription.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void handleSave(e)}
      className="space-y-5 rounded-3xl border border-border bg-surface p-6 shadow-sm"
    >
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">Prescription</h2>
        <p className="text-sm text-muted">
          Diagnosis and medicines the patient will receive. A PDF is not generated yet —
          this saves the record on the case.
        </p>
      </div>

      <p className="rounded-2xl bg-primary-soft px-4 py-3 text-sm text-foreground">
        Diagnosis is copied from SOAP Assessment when you save, and is what the patient
        will see. Full SOAP stays on this case only.
      </p>

      <div className="space-y-2">
        <label htmlFor="rx-diagnosis" className="text-sm font-semibold text-foreground">
          Diagnosis
        </label>
        <textarea
          id="rx-diagnosis"
          value={diagnosis}
          onChange={(e) => setDiagnosis(e.target.value)}
          maxLength={PATIENT_DIAGNOSIS_MAX_LENGTH}
          rows={3}
          required
          disabled={loading}
          className={inputClass}
        />
        <p className="text-right text-xs text-muted">
          {diagnosis.length.toLocaleString('en-IN')} / {PATIENT_DIAGNOSIS_MAX_LENGTH}
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-foreground">Medicines</h3>
        {items.map((item, index) => (
          <fieldset
            key={item.key}
            className="space-y-3 rounded-2xl border border-border p-4"
          >
            <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              Medicine {index + 1}
            </legend>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`rx-drug-${item.key}`} className="text-sm font-semibold">
                  Name
                </label>
                <input
                  id={`rx-drug-${item.key}`}
                  value={item.drugName}
                  onChange={(e) => updateItem(item.key, { drugName: e.target.value })}
                  maxLength={PRESCRIPTION_ITEM_FIELD_MAX_LENGTH}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`rx-dose-${item.key}`} className="text-sm font-semibold">
                  Dosage
                </label>
                <input
                  id={`rx-dose-${item.key}`}
                  value={item.dosage}
                  onChange={(e) => updateItem(item.key, { dosage: e.target.value })}
                  placeholder="e.g. 500 mg"
                  maxLength={PRESCRIPTION_ITEM_FIELD_MAX_LENGTH}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`rx-freq-${item.key}`} className="text-sm font-semibold">
                  Frequency
                </label>
                <input
                  id={`rx-freq-${item.key}`}
                  value={item.frequency}
                  onChange={(e) => updateItem(item.key, { frequency: e.target.value })}
                  placeholder="e.g. twice daily"
                  maxLength={PRESCRIPTION_ITEM_FIELD_MAX_LENGTH}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1">
                <label htmlFor={`rx-dur-${item.key}`} className="text-sm font-semibold">
                  Duration
                </label>
                <input
                  id={`rx-dur-${item.key}`}
                  value={item.duration}
                  onChange={(e) => updateItem(item.key, { duration: e.target.value })}
                  placeholder="e.g. 5 days"
                  maxLength={PRESCRIPTION_ITEM_FIELD_MAX_LENGTH}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label htmlFor={`rx-inst-${item.key}`} className="text-sm font-semibold">
                  Instructions{' '}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <input
                  id={`rx-inst-${item.key}`}
                  value={item.instructions}
                  onChange={(e) => updateItem(item.key, { instructions: e.target.value })}
                  placeholder="e.g. after food"
                  maxLength={PRESCRIPTION_INSTRUCTIONS_MAX_LENGTH}
                  disabled={loading}
                  className={inputClass}
                />
              </div>
            </div>
            {items.length > 1 ? (
              <button
                type="button"
                onClick={() => setItems((current) => current.filter((row) => row.key !== item.key))}
                disabled={loading}
                className="text-sm font-semibold text-danger hover:underline disabled:opacity-60"
              >
                Remove medicine
              </button>
            ) : null}
          </fieldset>
        ))}
        <button
          type="button"
          onClick={() => setItems((current) => [...current, newItem()])}
          disabled={loading}
          className="text-sm font-semibold text-primary hover:underline disabled:opacity-60"
        >
          Add another medicine
        </button>
      </div>

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      {saved && !error ? (
        <p className="text-sm font-medium text-primary">Prescription saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? 'Saving…' : initialIssued ? 'Update prescription' : 'Save prescription'}
      </button>
    </form>
  );
}
