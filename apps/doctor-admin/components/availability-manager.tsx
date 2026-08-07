'use client';

import type { AppointmentSlot, DayOfWeek, DoctorAvailability } from '@teleconsult/shared-types';
import { mapAppointmentSlotRow, mapDoctorAvailabilityRow } from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

import { SlotsCalendar } from '@/components/slots-calendar';
import {
  DAY_OF_WEEK_LABELS,
  formatTimeLabel,
  generateSlotsFromRules,
  parseDateInputValue,
  parseTimeToMinutes,
  toDateInputValue,
} from '@/lib/generate-slots';
import { createClient } from '@/lib/supabase/client';

type Props = {
  doctorId: string;
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

export function AvailabilityManager({ doctorId, initialRules, initialSlots }: Props) {
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
          .order('day_of_week', { ascending: true })
          .order('start_time', { ascending: true }),
        supabase
          .from('appointment_slots')
          .select('*')
          .eq('doctor_id', doctorId)
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
      });
      if (insertError) throw insertError;

      setMessage('Weekly hours saved.');
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
        .eq('doctor_id', doctorId);
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
        throw new Error('Add at least one weekly hours rule before generating slots.');
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

      const supabase = createClient();
      const rangeStart = drafts[0]!.startsAt;
      const rangeEnd = drafts[drafts.length - 1]!.endsAt;

      const { data: existing, error: existingError } = await supabase
        .from('appointment_slots')
        .select('starts_at')
        .eq('doctor_id', doctorId)
        .neq('status', 'cancelled')
        .gte('starts_at', rangeStart)
        .lte('starts_at', rangeEnd);

      if (existingError) throw existingError;

      const existingStarts = new Set(
        (existing ?? []).map((row) => new Date(row.starts_at as string).getTime())
      );
      const toInsert = drafts
        .filter((d) => !existingStarts.has(new Date(d.startsAt).getTime()))
        .map((d) => ({
          doctor_id: doctorId,
          availability_id: d.availabilityId,
          starts_at: d.startsAt,
          ends_at: d.endsAt,
          status: 'open' as const,
        }));

      if (toInsert.length === 0) {
        setMessage('All generated slots already exist for that period.');
        return;
      }

      const { error: insertError } = await supabase.from('appointment_slots').insert(toInsert);
      if (insertError) throw insertError;

      setMessage(`Created ${toInsert.length} open slot${toInsert.length === 1 ? '' : 's'}.`);
      await refreshFromServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not generate slots.');
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

      const supabase = createClient();
      const { error: insertError } = await supabase.from('appointment_slots').insert({
        doctor_id: doctorId,
        starts_at: starts.toISOString(),
        ends_at: ends.toISOString(),
        status: 'open',
      });
      if (insertError) throw insertError;

      setMessage('Open slot added.');
      await refreshFromServer();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add slot.');
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

  return (
    <div className="space-y-8">
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {message ? <p className="text-sm font-medium text-primary">{message}</p> : null}

      <section className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Weekly hours</h2>
          <p className="mt-1 text-sm text-muted">
            Set recurring windows. Slots are at least 15 minutes; buffer is an optional gap after each
            slot.
          </p>
        </div>

        <form onSubmit={onAddRule} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <label className="flex flex-col gap-1.5 text-sm font-semibold lg:col-span-2">
            Day
            <select
              value={dayOfWeek}
              onChange={(e) => setDayOfWeek(Number(e.target.value) as DayOfWeek)}
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
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
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            End
            <input
              type="time"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
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
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
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
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>
          <div className="flex items-end sm:col-span-2 lg:col-span-6">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
            >
              Add weekly hours
            </button>
          </div>
        </form>

        {sortedRules.length === 0 ? (
          <p className="text-sm text-muted">No weekly hours yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {sortedRules.map((rule) => (
              <li
                key={rule.id}
                className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="text-sm">
                  <p className="font-semibold">
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

      <section className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Generate open slots</h2>
          <p className="mt-1 text-sm text-muted">
            Creates bookable slots from your weekly hours through the date you pick (inclusive).
            Existing times are skipped.
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
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => void onGenerateSlots()}
            className="rounded-2xl bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-hover disabled:opacity-60"
          >
            Generate slots
          </button>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Add a single slot</h2>
          <p className="mt-1 text-sm text-muted">Optional one-off open slot outside weekly hours.</p>
        </div>
        <form onSubmit={onAddManualSlot} className="grid gap-3 sm:grid-cols-4">
          <label className="flex flex-col gap-1.5 text-sm font-semibold sm:col-span-2">
            Date
            <input
              type="date"
              required
              value={manualDate}
              onChange={(e) => setManualDate(e.target.value)}
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Start
            <input
              type="time"
              required
              value={manualStart}
              onChange={(e) => setManualStart(e.target.value)}
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
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
              className="rounded-xl border border-border px-3 py-2.5 font-normal outline-none focus:border-primary"
            />
          </label>
          <div className="sm:col-span-4">
            <button
              type="submit"
              disabled={busy}
              className="rounded-2xl border border-border bg-background px-4 py-2.5 text-sm font-semibold hover:border-primary disabled:opacity-60"
            >
              Add open slot
            </button>
          </div>
        </form>
      </section>

      <section className="space-y-4 rounded-3xl border border-border bg-surface p-6 shadow-sm">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">Upcoming open slots</h2>
          <p className="mt-1 text-sm text-muted">
            Patients will book from these. Browse by date and time of day — remove any open slot
            you no longer want offered.
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
