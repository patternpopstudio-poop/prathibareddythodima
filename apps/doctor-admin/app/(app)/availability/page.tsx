import type { ConsultationMode } from '@teleconsult/shared-types';
import { consultationModeLabel, parseConsultationMode } from '@teleconsult/shared-types';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { AvailabilityManager } from '@/components/availability-manager';
import {
  DashboardKpiStrip,
  KpiCalendarIcon,
  KpiSlotsIcon,
  KpiQueueIcon,
} from '@/components/dashboard-kpi-strip';
import { fetchDoctorAvailability, fetchUpcomingOpenSlots } from '@/lib/availability';
import { requireStaff } from '@/lib/auth';

const MODES: ConsultationMode[] = ['online', 'offline'];

function modeHref(mode: ConsultationMode): string {
  return mode === 'online' ? '/availability' : `/availability?mode=${mode}`;
}

export default async function AvailabilityPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string | string[] }>;
}) {
  const staff = await requireStaff();
  if (!staff.ok) redirect('/login');

  if (staff.role !== 'doctor') {
    return (
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Availability
        </h1>
        <p className="max-w-xl text-muted">
          Doctors manage their own hours and open slots. Admins can create doctor accounts from{' '}
          <Link href="/invites" className="font-semibold text-primary hover:underline">
            Invites
          </Link>
          .
        </p>
      </div>
    );
  }

  const params = await searchParams;
  const mode = parseConsultationMode(params.mode);
  // Cap the RSC → client payload; calendar + conflict checks only need ~2 months.
  const slotsUntil = new Date();
  slotsUntil.setDate(slotsUntil.getDate() + 60);
  slotsUntil.setHours(23, 59, 59, 999);
  const [rules, slots] = await Promise.all([
    fetchDoctorAvailability(staff.supabase, staff.userId, mode),
    fetchUpcomingOpenSlots(staff.supabase, staff.userId, {
      mode,
      limit: 200,
      until: slotsUntil,
    }),
  ]);

  const activeRules = rules.filter((r) => r.isActive);
  const activeDays = new Set(activeRules.map((r) => r.dayOfWeek)).size;
  const modeLabel = consultationModeLabel(mode);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
          Availability
        </h1>
        <p className="max-w-2xl text-muted">
          Manage online and offline inventories separately. Slots cannot overlap across modes —
          generate and add will flag conflicts.
        </p>
      </div>

      <DashboardKpiStrip
        items={[
          {
            label: `${modeLabel} Hours`,
            value:
              activeRules.length === 0
                ? 'None set'
                : `${activeRules.length} Window${activeRules.length === 1 ? '' : 's'}`,
            tone: 'green',
            icon: <KpiCalendarIcon />,
          },
          {
            label: 'Active Days',
            value:
              activeDays === 0
                ? 'None'
                : `${activeDays} Day${activeDays === 1 ? '' : 's'}`,
            tone: 'blue',
            icon: <KpiQueueIcon />,
          },
          {
            label: 'Open Slots',
            value:
              slots.length === 0
                ? 'None'
                : `${slots.length} Ahead`,
            tone: 'amber',
            icon: <KpiSlotsIcon />,
          },
        ]}
      />

      <section className="rounded-[24px] bg-surface px-5 pt-4 shadow-[0_4px_20px_rgba(0,0,0,0.05)]">
        <div className="flex flex-wrap gap-4 border-b border-border">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <Link
                key={m}
                href={modeHref(m)}
                className={`relative -mb-px shrink-0 pb-2.5 text-sm font-semibold transition-colors ${
                  active ? 'text-primary' : 'text-muted hover:text-foreground'
                }`}
              >
                {consultationModeLabel(m)}
                {active ? (
                  <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
                ) : null}
              </Link>
            );
          })}
        </div>
      </section>

      <AvailabilityManager
        key={mode}
        doctorId={staff.userId}
        mode={mode}
        initialRules={rules}
        initialSlots={slots}
      />
    </div>
  );
}
