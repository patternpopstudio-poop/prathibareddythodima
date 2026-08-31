'use client';

import type { SoapNote } from '@teleconsult/shared-types';
import {
  SOAP_FIELD_MAX_LENGTH,
  isSoapAmendmentOpen,
} from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { saveSoapNoteDraft } from '@/lib/soap';
import { createClient } from '@/lib/supabase/client';

type Props = {
  consultationId: string;
  initialNote: SoapNote | null;
};

const FIELDS = [
  {
    key: 'subjective' as const,
    letter: 'S',
    label: 'Subjective',
    hint: 'What the patient reports — symptoms, history in their words.',
  },
  {
    key: 'objective' as const,
    letter: 'O',
    label: 'Objective',
    hint: 'Findings, vitals, and files you reviewed.',
  },
  {
    key: 'assessment' as const,
    letter: 'A',
    label: 'Assessment',
    hint: 'Working diagnosis. This is what patients will see on a prescription.',
  },
  {
    key: 'plan' as const,
    letter: 'P',
    label: 'Plan',
    hint: 'Advice, tests, and follow-up. Not shown in full to the patient.',
  },
];

export function SoapNoteForm({ consultationId, initialNote }: Props) {
  const router = useRouter();
  const locked = !isSoapAmendmentOpen(initialNote?.amendmentDeadline);
  const [subjective, setSubjective] = useState(initialNote?.subjective ?? '');
  const [objective, setObjective] = useState(initialNote?.objective ?? '');
  const [assessment, setAssessment] = useState(initialNote?.assessment ?? '');
  const [plan, setPlan] = useState(initialNote?.plan ?? '');
  const [followUp, setFollowUp] = useState(initialNote?.followUp ?? false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  const values = { subjective, objective, assessment, plan };
  const setters = {
    subjective: setSubjective,
    objective: setObjective,
    assessment: setAssessment,
    plan: setPlan,
  };

  async function handleSave(event: React.FormEvent) {
    event.preventDefault();
    if (locked) return;
    setError(null);
    setSaved(false);
    setLoading(true);
    try {
      const supabase = createClient();
      await saveSoapNoteDraft(supabase, consultationId, {
        subjective,
        objective,
        assessment,
        plan,
        followUp,
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save SOAP notes.');
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
        <h2 className="text-xl font-semibold tracking-tight text-foreground">SOAP notes</h2>
        <p className="text-sm text-muted">
          Clinical record for this visit. Patients do not see this full note — they receive
          diagnosis and medicines on the prescription.
        </p>
      </div>

      {locked ? (
        <p className="rounded-2xl bg-primary-soft px-4 py-3 text-sm text-foreground">
          The 24-hour amendment window has ended. These notes are locked.
        </p>
      ) : (
        <p className="rounded-2xl bg-primary-soft px-4 py-3 text-sm text-foreground">
          Drafts can be saved at any time. Completing the case will require all four
          sections.
        </p>
      )}

      {FIELDS.map((field) => (
        <div key={field.key} className="space-y-2">
          <label htmlFor={`soap-${field.key}`} className="text-sm font-semibold text-foreground">
            <span className="mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary">
              {field.letter}
            </span>
            {field.label}
          </label>
          <p className="text-xs text-muted">{field.hint}</p>
          <textarea
            id={`soap-${field.key}`}
            value={values[field.key]}
            onChange={(e) => setters[field.key](e.target.value)}
            maxLength={SOAP_FIELD_MAX_LENGTH}
            rows={4}
            disabled={locked || loading}
            className="w-full resize-y rounded-2xl border border-border bg-background px-4 py-3 text-sm leading-6 outline-none focus:border-primary disabled:opacity-60"
          />
          <p className="text-right text-xs text-muted">
            {values[field.key].length.toLocaleString('en-IN')} / {SOAP_FIELD_MAX_LENGTH}
          </p>
        </div>
      ))}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-foreground">
        <input
          type="checkbox"
          checked={followUp}
          onChange={(e) => setFollowUp(e.target.checked)}
          disabled={locked || loading}
          className="mt-1 h-4 w-4 rounded border-border text-primary accent-primary"
        />
        <span>
          <span className="font-semibold">Follow-up recommended</span>
          <span className="mt-0.5 block text-muted">
            Flag that this patient should return or continue care.
          </span>
        </span>
      </label>

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}
      {saved && !error ? (
        <p className="text-sm font-medium text-primary">Draft saved.</p>
      ) : null}

      <button
        type="submit"
        disabled={locked || loading}
        className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
      >
        {loading ? 'Saving…' : 'Save draft'}
      </button>
    </form>
  );
}
