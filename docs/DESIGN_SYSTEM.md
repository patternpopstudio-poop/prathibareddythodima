# Design System

Canonical visual language for the Hospital Tele-Consulting Platform. Apply across **patient-mobile** (React Native / Expo) and **doctor-admin** (Next.js).

**Mood:** Fresh, trustworthy telehealth — grass green accents on clean white, calm and approachable.

**Patient mobile source of truth:** redesign mockups (splash, phone login, OTP, home). Prefer those layouts when they differ from older clinic-photo patterns.

---

## Colors

### Primary (grass green)

| Token | Hex | Use |
|-------|-----|-----|
| `primary-900` | `#6bae3d` | Primary CTA, logo, key accents (splash green) |
| `primary-700` | `#5c9a32` | CTA hover / active |
| `primary-600` | `#7bbc52` | Secondary accents |
| `primary-400` | `#9fd07a` | Highlights, badges |
| `primary-100` | `#e5f3d8` | Soft tinted bars / banners |
| `primary-50` | `#f2f8eb` | Soft green backgrounds, blobs |
| `splash-background` | `#fafaf8` | Splash / auth canvas |

### Neutrals

| Token | Hex | Use |
|-------|-----|-----|
| `neutral-black` | `#111827` / `#1f2937` | Primary text |
| `neutral-white` | `#ffffff` | Cards, auth canvas |
| `gray-50` | `#f9fafb` | Subtle surfaces |
| `gray-100` | `#f3f4f6` / `#f5f6f8` | **App page background** |
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
| Display / H1 | **Stack Sans Headline** | Manrope / system sans-serif |
| Headings H2–H5, body, labels | **Manrope** | system sans-serif |
| Utility (sparingly) | Geist, Geist Mono | — |

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

## Brand

| Element | Value |
|---------|-------|
| Name | TeleConsult |
| Tagline | Expert Care. Anywhere. Anytime. |
| Logo | Green circle + medical cross with leaf accent |
| Footer line | Connecting Care, Building Healthier Tomorrows |

---

## Layout

| Element | Value |
|---------|-------|
| Auth / splash background | White + soft green blobs + dot grids |
| App page background | `#f5f6f8` |
| Card background | `#ffffff` |
| Card border-radius | `20–24px` |
| Card shadow | Soft, subtle elevation |
| Input / chip radius | `12–14px` |
| Button radius | `14–16px` |
| Bottom sheet (auth) | White card, large top radius (~28px) |
| Whitespace | Generous — avoid cramped layouts |

---

## Components

### Cards
- White surface on gray page background (home)
- Auth: bottom sheet card with rounded top corners
- Soft shadow or light border

### CTAs
- Background: `primary-900` (`#4c9a2a`)
- Text: white
- Often include a trailing arrow / chevron
- Rounded corners (14–16px)

### Auth pattern
1. Splash (brand + illustration)
2. Login / Sign up (mobile number primary)
3. OTP verification (6 boxes)

### Home pattern
- Greeting + language + avatar
- Search
- Book consultation hero card
- Upcoming appointment
- Quick access grid
- Explore care horizontal cards
- 5-tab bottom nav: Home, My Health, Messages, Bookings, More

### Trust elements
- Soft green tinted banners with shield icons
- Terms / privacy links in primary green

---

## Rules

1. **Grass green = action** — primary buttons, active nav, booking CTAs
2. **White cards on soft gray** — content blocks sit on cards (home)
3. **Manrope for almost everything** — Stack Sans Headline only for display/hero when available
4. **Red sparingly** — errors and alerts only (`#a6021a`)
5. **No default Expo blue** — do not use `#3c87f7` for primary actions
6. **Consistent rounding** — 20–24px cards, 12–14px inputs
7. **Mockup fidelity** — match patient redesign screens before inventing alternate layouts

---

## Per-app implementation

### Patient mobile (`apps/patient-mobile`)
- Define tokens in `src/constants/theme.ts`
- Load Manrope via `expo-font`
- Shared brand pieces: `BrandLogo`, decorative blobs, phone field, OTP boxes

### Doctor admin (`apps/doctor-admin`)
- Extend Tailwind / shadcn theme with the same hex tokens
- Load fonts via `next/font`
- Mirror card, CTA, and spacing patterns from this doc

### Shared tokens (future)
- Extract to `packages/ui-tokens` when both apps are scaffolded
- Single source: `tokens.ts` + `tokens.css` for web
