# Agent instructions

## Expo

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before writing patient-mobile code.

## Project docs (read before building)

- `docs/ROADMAP.md` — phased development plan and feature priorities
- `docs/DESIGN_SYSTEM.md` — colors, typography, layout for all frontends

## Monorepo

| Path | Role |
|------|------|
| `apps/patient-mobile` | Patient module (React Native / Expo) |
| `apps/doctor-admin` | Doctor module + admin tooling (Next.js) |
| `apps/backend` | Node.js orchestration |
| `packages/shared-types` | Shared TypeScript types |
| `supabase/` | Database, auth, storage, migrations |

## Priorities

- Follow phase order in `docs/ROADMAP.md` — do not skip ahead
- Audio/video (Phase 9) is **last priority** — defer until Phases 0–8 are stable
- Apply design tokens from `docs/DESIGN_SYSTEM.md` on all UI work
