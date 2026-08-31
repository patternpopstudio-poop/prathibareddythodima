-- Limit patient-record access to the patient, admins, and doctors who have an
-- assigned booking or consultation with that patient.

DROP POLICY IF EXISTS patients_select_staff ON public.patients;
DROP POLICY IF EXISTS patients_select_assigned_staff ON public.patients;

CREATE POLICY patients_select_assigned_staff
  ON public.patients
  FOR SELECT
  TO authenticated
  USING (
    public.is_admin()
    OR (
      public.is_doctor()
      AND (
        EXISTS (
          SELECT 1
          FROM public.bookings b
          WHERE b.patient_id = patients.id
            AND b.doctor_id = auth.uid()
            AND b.status = 'confirmed'
        )
        OR EXISTS (
          SELECT 1
          FROM public.consultations c
          WHERE c.patient_id = patients.id
            AND c.doctor_id = auth.uid()
        )
      )
    )
  );

COMMENT ON POLICY patients_select_assigned_staff ON public.patients IS
  'Admins may read all patients; doctors may read patients with a confirmed booking or consultation assignment.';
