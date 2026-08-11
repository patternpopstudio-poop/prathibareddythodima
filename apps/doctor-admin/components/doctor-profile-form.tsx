'use client';

import { formatInrFromPaise, type Doctor } from '@teleconsult/shared-types';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { DOCTOR_PHOTOS_BUCKET, doctorPhotoObjectPath } from '@/lib/doctors';
import { createClient } from '@/lib/supabase/client';

type Props = {
  doctor: Doctor;
};

export function DoctorProfileForm({ doctor }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(doctor.fullName);
  const [mobile, setMobile] = useState(doctor.mobile ?? '');
  const [photoUrl, setPhotoUrl] = useState(doctor.photoUrl);
  const [previewUrl, setPreviewUrl] = useState<string | null>(doctor.photoUrl);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function onPhotoChange(file: File | null) {
    if (!file) return;
    setError(null);

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Use a JPG, PNG, or WebP image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Photo must be 5 MB or smaller.');
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const path = doctorPhotoObjectPath(doctor.id, file.name);
      const { error: uploadError } = await supabase.storage
        .from(DOCTOR_PHOTOS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from(DOCTOR_PHOTOS_BUCKET).getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      setPhotoUrl(data.publicUrl);
      setPreviewUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not upload photo.');
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const name = fullName.trim();
    if (name.length < 2) {
      setError('Enter your full name.');
      return;
    }
    if (!photoUrl?.trim()) {
      setError('A profile photo is required to complete your doctor profile.');
      return;
    }

    setLoading(true);
    try {
      const supabase = createClient();
      const { error: updateError } = await supabase
        .from('doctors')
        .update({
          full_name: name,
          mobile: mobile.trim() || null,
          photo_url: photoUrl.trim(),
        })
        .eq('id', doctor.id);

      if (updateError) throw updateError;
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6 rounded-3xl border border-border bg-surface p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-primary-soft">
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote storage URL with cache-bust
            <img src={previewUrl} alt="Doctor profile" className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-semibold text-primary">No photo</span>
          )}
        </div>
        <div className="space-y-2">
          <label className="block text-sm font-semibold text-foreground">
            Profile photo <span className="font-normal text-muted">(required)</span>
          </label>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploading || loading}
            onChange={(e) => void onPhotoChange(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-muted file:mr-4 file:rounded-xl file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-primary-hover"
          />
          <p className="text-xs text-muted">JPG, PNG, or WebP · max 5 MB</p>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="fullName" className="text-sm font-semibold">
          Full name
        </label>
        <input
          id="fullName"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
          required
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-semibold">
          Email
        </label>
        <input
          id="email"
          value={doctor.email}
          disabled
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-muted"
        />
        <p className="text-xs text-muted">Email is managed by admin and cannot be changed here.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="mobile" className="text-sm font-semibold">
          Mobile <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="mobile"
          value={mobile}
          onChange={(e) => setMobile(e.target.value)}
          placeholder="+91…"
          className="w-full rounded-2xl border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="specialty" className="text-sm font-semibold">
          Specialty
        </label>
        <input
          id="specialty"
          value={doctor.specialty}
          disabled
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-muted"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="degrees" className="text-sm font-semibold">
          Degrees
        </label>
        <input
          id="degrees"
          value={doctor.degrees}
          disabled
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-muted"
        />
        <p className="text-xs text-muted">Specialty and degrees are managed by admin.</p>
      </div>

      <div className="space-y-2">
        <label htmlFor="consultationFee" className="text-sm font-semibold">
          Consultation fee
        </label>
        <input
          id="consultationFee"
          value={formatInrFromPaise(doctor.consultationFeePaise)}
          disabled
          className="w-full rounded-2xl border border-border bg-background/60 px-4 py-3 text-sm text-muted"
        />
        <p className="text-xs text-muted">Fee is set by admin (₹400–₹700) and cannot be changed here.</p>
      </div>

      {error ? <p className="text-sm font-medium text-danger">{error}</p> : null}

      <button
        type="submit"
        disabled={loading || uploading}
        className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60">
        {uploading ? 'Uploading photo…' : loading ? 'Saving…' : 'Save profile'}
      </button>
    </form>
  );
}
