'use client';

import type {
  AppointmentSlot,
  ConsultationMode,
  DayOfWeek,
  DoctorAvailability,
} from '@teleconsult/shared-types';
import {
  consultationModeLabel,
  mapAppointmentSlotRow,
  mapDoctorAvailabilityRow,
} from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { SlotsCalendar } from '@/components/slots-calendar';
import {
  DAY_OF_WEEK_LABELS,
  findOverlappingSlot,
  formatSlotConflictMessage,
  formatSlotInsertError,
  formatTimeLabel,
  generateSlotsFromRules,
  parseDateInputValue,
  parseTimeToMinutes,
  toDateInputValue,
  type ExistingSlotForConflict,
} from '@/lib/generate-slots';
import { createClient } from '@/lib/supabase/client';

type Props = {
  doctorId: string;
  mode: ConsultationMode;
  initialRules: DoctorAvailability[];
  initialSlots: AppointmentSlot[];
};

const DAY_OPTIONS = DAY_OF_WEEK_LABELS.map((label, value) => ({
  label,
  value: value as DayOfWeek,
}));

function defaultGenerateUntil(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return toDateInputValue(d);
}

export function AvailabilityManager({
  doctorId,
  mode,
  initialRules,
  initialSlots,
}: Props) {
  const router = useRouter();
  const [rules, setRules] = useState(initialRules);
  const [slots, setSlots] = useState(initialSlots);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [dayOfWeek, setDayOfWeek] = useState<DayOfWeek>(1);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('13:00');
  const [duration, setDuration] = useState(15);
  const [buffer, setBuffer] = useState(0);
  const [generateUntil, setGenerateUntil] = useState(defaultGenerateUntil);

  const [manualDate, setManualDate] = useState('');
  const [manualStart, setManualStart] = useState('10:00');
  const [manualDuration, setManualDuration] = useState(15);

  const modeLabel = consultationModeLabel(mode);
  const modeLower = modeLabel.toLowerCase();

  const sortedRules = useMemo(
    () =>
      [...rules].sort(
        (a, b) => a.dayOfWeek - b.dayOfWeek || a.startTime.localeCompare(b.startTime)
      ),
    [rules]
  );

  function clearFeedback() {
    setError(null);
    setMessage(null);
  }

  async function refreshFromServer() {
    const supabase = createClient();
    const [{ data: ruleRows, error: ruleError }, { data: slotRows, error: slotError }] =
      await Promise.all([
        supabase
          .from('doctor_availability')
          .select('*')
          .eq('doctor_id', doctorId)
          .eq('mode', mode)
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('appointment_slots')
          .select('*')
          .eq('doctor_id', doctorId)
          .eq('mode', mode)
          .eq('status', 'open')
          .gt('starts_at', new Date().toISOString())
          .order('starts_at', { ascending: true })
          .limit(500),
      ]);

    if (ruleError) throw ruleError;
    if (slotError) throw slotError;

    setRules((ruleRows ?? []).map(mapDoctorAvailabilityRow));
    setSlots((slotRows ?? []).map(mapAppointmentSlotRow));
    router.refresh();
  }

  async function fetchExistingSlotsInRange(
    rangeStart: string,
    rangeEnd: string
  ): Promise<ExistingSlotForConflict[]> {
    const supabase = createClient();
    // Overlap with [rangeStart, rangeEnd]: starts_at < rangeEnd AND ends_at > rangeStart
    const { data, error: fetchError } = await supabase
      .from('appointment_slots')
      .select('starts_at, ends_at, mode')
      .eq('doctor_id', doctorId)
      .neq('status', 'cancelled')
      .lt('starts_at', rangeEnd)
      .gt('ends_at', rangeStart);

    if (fetchError) throw fetchError;

    return (data ?? []).map((row) => ({
      startsAt: row.starts_at as string,
      endsAt: row.ends_at as string,
      mode: (row.mode === 'offline' ? 'offline' : 'online') as ConsultationMode,
    }));
  }

  async function onAddRule(event: React.FormEvent) {
    event.preventDefault();
    clearFeedback();

    try {
      if (duration < 15) throw new Error('Slot duration must be at least 15 minutes.');
      if (buffer < 0) throw new Error('Buffer cannot be negative.');
      if (parseTimeToMinutes(endTime) <= parseTimeToMinutes(startTime)) {
        throw new Error('End time must be after start time.');
      }

      setBusy(true);
      const supabase = createClient();
      const { error: insertError } = await supabase.from('doctor_availability').insert({
        doctor_id: doctorId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        slot_duration_minutes: duration,
        buffer_minutes: buffer,
        is_active: true,
        mode,
      });
      if (insertError) throw insertError;

      setMessage(`${modeLabel} weekly hours saved.`);
      await refreshFromServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save weekly hours.');
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteRule(ruleId: string) {
    clearFeedback();
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('doctor_availability')
        .delete()
        .eq('id', ruleId)
        .eq('doctor_id', doctorId)
        .eq('mode', mode);
      if (deleteError) throw deleteError;
      setMessage('Weekly hours removed.');
      await refreshFromServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete weekly hours.');
    } finally {
      setBusy(false);
    }
  }

  async function onGenerateSlots() {
    clearFeedback();
    setBusy(true);
    try {
      if (rules.filter((r) => r.isActive).length === 0) {
        throw new Error(
          `Add at least one ${modeLower} weekly hours rule before generating slots.`
        );
      }

      const untilDate = parseDateInputValue(generateUntil);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (untilDate < today) {
        throw new Error('Generate-through date must be today or later.');
      }

      const drafts = generateSlotsFromRules(rules, { untilDate });
      if (drafts.length === 0) {
        throw new Error(
          'No future slots fall on or before that date. Check your weekly hours.'
        );
      }

      const rangeStart = drafts.reduce(
        (min, d) => (d.startsAt < min ? d.startsAt : min),
        drafts[0]!.startsAt
      );
      const rangeEnd = drafts.reduce(
        (max, d) => (d.endsAt > max ? d.endsAt : max),
        drafts[0]!.endsAt
      );

      const existing = await fetchExistingSlotsInRange(rangeStart, rangeEnd);
      const existingSameModeStarts = new Set(
        existing
          .filter((s) => s.mode === mode)
          .map((s) => new Date(s.startsAt).getTime())
      );

      const toInsert = [];
      for (const draft of drafts) {
        if (existingSameModeStarts.has(new Date(draft.startsAt).getTime())) {
          continue;
        }
        const conflict = findOverlappingSlot(draft, existing);
        if (conflict) {
          throw new Error(formatSlotConflictMessage(draft, conflict));
        }
        toInsert.push({
          doctor_id: doctorId,
          availability_id: draft.availabilityId,
          starts_at: draft.startsAt,
          ends_at: draft.endsAt,
          status: 'open' as const,
          mode,
        });
      }

      if (toInsert.length === 0) {
        setMessage(`All generated ${modeLower} slots already exist for that period.`);
        return;
      }

      const supabase = createClient();
      const { error: insertError } = await supabase.from('appointment_slots').insert(toInsert);
      if (insertError) throw insertError;

      setMessage(
        `Created ${toInsert.length} open ${modeLower} slot${toInsert.length === 1 ? '' : 's'}.`
      );
      await refreshFromServer();
    } catch (err) {
      setError(formatSlotInsertError(err, 'Could not generate slots.'));
    } finally {
      setBusy(false);
    }
  }

  async function onAddManualSlot(event: React.FormEvent) {
    event.preventDefault();
    clearFeedback();
    setBusy(true);
    try {
      if (!manualDate) throw new Error('Pick a date for the slot.');
      if (manualDuration < 15) throw new Error('Slot duration must be at least 15 minutes.');

      const startMinutes = parseTimeToMinutes(manualStart);
      const [year, month, day] = manualDate.split('-').map(Number);
      if (!year || !month || !day) throw new Error('Invalid date.');

      const starts = new Date(year, month - 1, day, Math.floor(startMinutes / 60), startMinutes % 60);
      const ends = new Date(starts.getTime() + manualDuration * 60_000);

      if (starts <= new Date()) throw new Error('Slot must start in the future.');

      const startsAt = starts.toISOString();
      const endsAt = ends.toISOString();
      const existing = await fetchExistingSlotsInRange(startsAt, endsAt);
      const conflict = findOverlappingSlot({ startsAt, endsAt, mode }, existing);
      if (conflict) {
        throw new Error(formatSlotConflictMessage({ startsAt, endsAt, mode }, conflict));
      }

      const supabase = createClient();
      const { error: insertError } = await supabase.from('appointment_slots').insert({
        doctor_id: doctorId,
        starts_at: startsAt,
        ends_at: endsAt,
        status: 'open',
        mode,
      });
      if (insertError) throw insertError;

      setMessage(`Open ${modeLower} slot added.`);
      await refreshFromServer();
    } catch (err) {
      setError(formatSlotInsertError(err, 'Could not add slot.'));
    } finally {
      setBusy(false);
    }
  }

  async function onDeleteSlot(slotId: string) {
    clearFeedback();
    setBusy(true);
    try {
      const supabase = createClient();
      const { error: deleteError } = await supabase
        .from('appointment_slots')
        .delete()
        .eq('id', slotId)
        .eq('doctor_id', doctorId)
        .eq('mode', mode)
        .eq('status', 'open');
      if (deleteError) throw deleteError;
      setMessage('Open slot removed.');
      await refreshFromServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete slot.');
    } finally {
      setBusy(false);
    }
  }

  const panelClass =
    'space-y-4 rounded-[24px] bg-surface p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)]';
  const inputClass =
    'rounded-xl border border-border/70 bg-background px-3 py-2.5 font-normal outline-none focus:border-primary';

  return (
    <div className="space-y-5">
      {error ? (
        <div className="rounded-2xl border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="rounded-2xl border border-primary/20 bg-primary-soft px-4 py-3 text-sm font-medium text-foreground">
          {message}
        </div>
      ) : null}

      <section className={panelClass}>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            {modeLabel} weekly hours
          </h2>
          <p className="mt-1 text-sm text-muted">
            Set recurring {modeLower} windows. Slots are at least 15 minutes; buffer is an optional
            gap after each slot.
          </p>
        </div>

        <form onSubmit={onAddRule} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1.5 text-sm font-semibold lg:col-span-2">
            Day
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
              className={inputClass}
            >
              {DAY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Start
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            End
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Duration (min)
            <input
              type="number"
              min={15}
              step={5}
              required
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Buffer (min)
            <input
              type="number"
              min={0}
              step={5}
              required
              value={buffer}
              onChange={(e) => setBuffer(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-6">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
            >
              Add {modeLower} weekly hours
            </button>
          </div>
        </form>

        {sortedRules.length === 0 ? (
          <div className="rounded-2xl bg-background px-4 py-6 text-sm text-muted">
            No {modeLower} weekly hours yet.
          </div>
        ) : (
          <ul className="space-y-3">
            {sortedRules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-col gap-2 rounded-2xl border border-border/70 bg-background px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                style={{ borderLeftWidth: 4, borderLeftColor: 'var(--primary)' }}
              >
                <div className="text-sm">
                  <p className="font-semibold text-foreground">
                    {DAY_OF_WEEK_LABELS[rule.dayOfWeek]} · {formatTimeLabel(rule.startTime)} –{' '}
                    {formatTimeLabel(rule.endTime)}
                  </p>
                  <p className="text-muted">
                    {rule.slotDurationMinutes} min slots
                    {rule.bufferMinutes > 0 ? ` · ${rule.bufferMinutes} min buffer` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void onDeleteRule(rule.id)}
                  className="text-sm font-semibold text-danger hover:underline disabled:opacity-60"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className={panelClass}>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Generate {modeLower} open slots
          </h2>
          <p className="mt-1 text-sm text-muted">
            Creates bookable {modeLower} slots from your weekly hours through the date you pick
            (inclusive). Existing times are skipped; overlaps with the other mode are blocked.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Generate through
            <input
              type="date"
              required
              value={generateUntil}
              min={toDateInputValue(new Date())}
              onChange={(e) => setGenerateUntil(e.target.value)}
              className={inputClass}
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGenerateSlots()}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
          >
            Generate {modeLower} slots
          </button>
        </div>
      </section>

      <section className={panelClass}>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Add a single {modeLower} slot
          </h2>
          <p className="mt-1 text-sm text-muted">
            Optional one-off open {modeLower} slot outside weekly hours.
          </p>
        </div>
        <form onSubmit={onAddManualSlot} className="grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
            Date
            <input
              type="date"
              required
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Start
            <input
              type="time"
              required
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Duration (min)
            <input
              type="number"
              min={15}
              step={5}
              required
              value={manualDuration}
              onChange={(e) => setManualDuration(Number(e.target.value))}
              className={inputClass}
            />
          </label>
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl bg-primary-soft px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft/80 disabled:opacity-60"
            >
              Add open {modeLower} slot
            </button>
          </div>
        </form>
      </section>

      <section className={panelClass}>
        <div>
          <h2 className="text-base font-semibold tracking-tight text-foreground">
            Upcoming open {modeLower} slots
          </h2>
          <p className="mt-1 text-sm text-muted">
            Patients will book {modeLower} appointments from these. Remove any open slot you no
            longer want offered.
          </p>
        </div>
        <SlotsCalendar
          slots={slots}
          busy={busy}
          onDeleteSlot={(slotId) => void onDeleteSlot(slotId)}
        />
      </section>
    </div>
  );
}
