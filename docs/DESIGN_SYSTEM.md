# Design System

Canonical visual language for the Hospital Tele-Consulting Platform. Apply across **patient-mobile** (React Native / Expo) and **doctor-admin** (Next.js).

**Mood:** Calm, trustworthy, modern clinic — premium and warm, not clinical or cold.

---

## Colors

### Primary (olive green)

| Token | Hex | Use |
|-------|-----|-----|
| `primary-900` | `#49630b` | Primary CTA, key accents |
| `primary-700` | `#5b7a12` | CTA hover / active |
| `primary-600` | `#68852a` | Secondary accents |
| `primary-400` | `#8fb837` | Highlights, badges |
| `primary-50` | `#f0f5e4` | Soft green backgrounds |

### Neutrals

| Token | Hex | Use |
|-------|-----|-----|
| `neutral-black` | `#000000` | Primary text |
| `neutral-white` | `#ffffff` | Cards, hero text |
| `gray-50` | `#f9fafb` | Subtle surfaces |
| `gray-100` | `#f3f4f6` | **Page background** |
| `gray-200` | `#e5e7eb` | Borders, dividers |
| `gray-300` | `#d1d5db` | Disabled / muted borders |
| `gray-400` | `#9ca3af` | Placeholder text |
| `gray-500` | `#6b7280` | Secondary text |
| `gray-600` | `#4b5363` | Strong secondary text |
| `gray-500-alt` | `#838996` | Alt muted text |

### Semantic

| Token | Hex | Use |
|-------|-----|-----|
| `accent-red` | `#a6021a` | Errors, alerts only — never for primary actions |

---

## Typography

### Font families

| Role | Font | Fallback |
|------|------|----------|
| Display / H1 | **Stack Sans Headline** | system sans-serif |
| Headings H2–H5, body, labels | **Manrope** | Inter, system sans-serif |
| Utility (sparingly) | Geist, Geist Mono, Inter | — |

### Scale

| Role | Font | Size (responsive) | Weight | Letter-spacing | Line-height |
|------|------|-------------------|--------|----------------|-------------|
| Display / H1 | Stack Sans Headline | 72 → 48 → 44px | 500–600 | -0.04em | tight |
| H2 | Manrope | 36–48px | 600–700 | -0.04 to -0.05em | — |
| H3 | Manrope | 26–40px | 600–700 | -0.04 to -0.05em | — |
| H4 | Manrope | 24–32px | 600–700 | -0.04 to -0.05em | — |
| H5 | Manrope | 20–22px | 600–700 | -0.04 to -0.05em | — |
| Body | Manrope | 14–16px | 400–500 | — | 120–150% |
| Label / small | Manrope | 12px | 600 (semibold) | — | — |

---

## Layout

| Element | Value |
|---------|-------|
| Page background | `#f3f4f6` (gray-100) |
| Card background | `#ffffff` |
| Card border-radius | `20px` |
| Card shadow | Soft, subtle elevation |
| Input / chip radius | `10–12px` |
| Button radius | `10–20px` |
| Section padding | `48–80px` |
| Max content width | `~1700px` |
| Whitespace | Generous — avoid cramped layouts |

---

## Components

### Cards
- White surface on gray-100 page background
- 20px border-radius, soft shadow
- Use for all content blocks — avoid flat content on page bg

### CTAs (e.g. "Book Online")
- Background: `primary-900` (`#49630b`)
- Hover: `primary-700` (`#5b7a12`)
- Text: white
- Rounded corners (10–20px), subtle hover transition

### Hero sections
- Full-bleed photo with dark gradient overlay
- White text on overlay
- Display typography (Stack Sans Headline)

### Trust elements
- Star ratings, badges, testimonials
- Use `primary-400` and `primary-50` tints
- Testimonial carousel, 5.0 star trust badges

---

## Rules

1. **Olive green = action** — primary buttons, active nav, booking CTAs
2. **White cards on gray-100** — every content block sits on a card
3. **Manrope for almost everything** — Stack Sans Headline only for display/hero
4. **Red sparingly** — errors and alerts only (`#a6021a`)
5. **No default Expo blue** — do not use `#3c87f7` for primary actions
6. **Consistent rounding** — 20px cards, 10–12px inputs/chips

---

## Per-app implementation

### Patient mobile (`apps/patient-mobile`)
- Define tokens in `src/constants/theme.ts` (replace default Expo palette)
- Load Manrope + Stack Sans Headline via `expo-font`
- Map `ThemedText` variants to H1–H5 / body / label scale

### Doctor admin (`apps/doctor-admin`)
- Extend Tailwind / shadcn theme with the same hex tokens
- Load fonts via `next/font`
- Mirror card, CTA, and spacing patterns from this doc

### Shared tokens (future)
- Extract to `packages/ui-tokens` when both apps are scaffolded
- Single source: `tokens.ts` + `tokens.css` for web
