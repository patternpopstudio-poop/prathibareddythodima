-- Optional seed data for local development.
-- Bootstrap the first admin via backend: POST /bootstrap/admin
-- Sample employer for B2B patient invites.

INSERT INTO public.employers (id, name)
VALUES ('11111111-1111-1111-1111-111111111111', 'Demo Employer')
ON CONFLICT (id) DO NOTHING;
