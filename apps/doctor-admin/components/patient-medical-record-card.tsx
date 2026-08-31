import type { Gender, Patient } from '@teleconsult/shared-types';

type Props = {
  patient: Patient;
};

type RecordField = {
  label: string;
  value: string;
};

function displayOrDash(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed || '—';
}

function formatDate(value: string | null): string {
  if (!value) return '—';
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatGender(value: Gender | null): string {
  if (!value) return '—';
  if (value === 'prefer_not_to_say') return 'Prefer not to say';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function formatMetric(value: number | null, unit: string): string {
  return value == null ? '—' : `${value.toLocaleString('en-IN')} ${unit}`;
}

function RecordSection({
  title,
  fields,
  longText = false,
}: {
  title: string;
  fields: RecordField[];
  longText?: boolean;
}) {
  return (
    <section className="space-y-3">
      <h3 className="text-sm font-semibold text-foreground">
        {title}
      </h3>
      <dl
        className={
          longText ? 'grid gap-4 lg:grid-cols-2' : 'grid gap-4 sm:grid-cols-3'
        }
      >
        {fields.map((field) => (
          <div key={field.label} className="space-y-1">
            <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
              {field.label}
            </dt>
            <dd
              className={
                longText
                  ? 'whitespace-pre-wrap text-sm leading-6 text-foreground'
                  : 'text-sm text-foreground'
              }
            >
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function PatientMedicalRecordCard({ patient }: Props) {
  const demographics: RecordField[] = [
    { label: 'Date of birth', value: formatDate(patient.dateOfBirth) },
    { label: 'Gender', value: formatGender(patient.gender) },
  ];
  const contact: RecordField[] = [
    { label: 'Email', value: displayOrDash(patient.email) },
    { label: 'Mobile', value: displayOrDash(patient.mobile) },
    { label: 'City', value: displayOrDash(patient.city) },
  ];
  const biometrics: RecordField[] = [
    { label: 'Height', value: formatMetric(patient.heightCm, 'cm') },
    { label: 'Weight', value: formatMetric(patient.weightKg, 'kg') },
    { label: 'Blood group', value: patient.bloodGroup ?? '—' },
  ];
  const medicalHistory: RecordField[] = [
    { label: 'Allergies', value: displayOrDash(patient.allergies) },
    {
      label: 'Chronic ailments',
      value: displayOrDash(patient.chronicAilments),
    },
    {
      label: 'Current medications',
      value: displayOrDash(patient.currentMedications),
    },
    { label: 'Past surgeries', value: displayOrDash(patient.pastSurgeries) },
    { label: 'Family history', value: displayOrDash(patient.familyHistory) },
  ];

  return (
    <section className="space-y-5 rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground">
          Patient medical record
        </h2>
        <p className="text-sm text-muted">
          Read-only health information provided by the patient.
        </p>
      </div>

      {!patient.profileCompleted ? (
        <p className="rounded-2xl bg-primary-soft px-4 py-3 text-sm text-foreground">
          The patient has not completed their health profile. Missing information is
          shown as —.
        </p>
      ) : null}

      <RecordSection title="Demographics" fields={demographics} />
      <div className="border-t border-border" />
      <RecordSection title="Contact" fields={contact} />
      <div className="border-t border-border" />
      <RecordSection title="Biometrics" fields={biometrics} />
      <div className="border-t border-border" />
      <RecordSection title="Medical history" fields={medicalHistory} longText />
    </section>
  );
}
