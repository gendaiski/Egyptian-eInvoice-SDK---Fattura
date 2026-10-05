# Nile Ledger — Fatura design system v2

The live reference is the `/design-system` page: every swatch, type sample and component there is
the real component in the current theme and language. This file records the decisions.

## Principles
1. **The document is the hero.** Show the real invoice, its status and its numbers before decoration.
2. **State before style.** Valid / Invalid / overdue are encoded in form (icon, chip, stripe) and words first, colour second.
3. **Two scripts, one system.** Arabic is designed, not mirrored. Logical properties everywhere; IDs, codes, IBANs stay LTR.
4. **Calm by default, loud on purpose.** Quiet neutrals, one accent, emphasis spent on what needs action.

## Tokens (`src/styles/index.css`)
Colours are space-separated RGB custom properties so Tailwind alpha modifiers work (`bg-accent/10`).
Light values are on `:root`. Dark values apply under `prefers-color-scheme: dark` when no explicit theme
is set, and under `[data-theme='dark']`. The invoice paper (`.paper-light`) is pinned to the light values.

| Role | Tokens |
|---|---|
| Neutrals (stone, biased toward the accent hue) | `canvas` `surface` `sunken` `line` `line-strong` `ink` `ink-muted` `ink-subtle` |
| Brand | `accent` (Nile) `accent-strong` `accent-soft` `accent-on`, `gold` (logo dot and seal only) |
| Status (reserved) | `ok` `warn` `bad` `info` + `-soft` fills |
| Shape | `--radius-control` 8 · `--radius-card` 14 · `--radius-sheet` 20 · pill |
| Elevation | flat (border) · `shadow-card` · `shadow-pop` (popovers, dialogs, toasts) |
| Motion | `--dur-fast` 120 · `--dur-base` 180 · `--dur-slow` 320 · `--ease-standard`; reduced motion respected globally |

Rules: text uses ink tokens (AA ≥ 4.5:1 on surface, measured live on the reference page); one accent per
screen for primary actions, links and selection; status colours never stand alone.

## Typography
| Role | Face | Use |
|---|---|---|
| Display | **Alexandria** (Latin + Arabic, Egyptian-designed by Mohamed Gaber) | `h1`, `.font-display`, marketing headings, numbers in KPI and pricing |
| Interface | Geist / IBM Plex Sans Arabic | everything else |
| Data | Geist Mono | UUIDs, item codes, IBANs, JSON |

Scale (Tailwind): `text-display-xl` clamp(38–64), `text-display` clamp(32–52), `text-title` clamp(24–32),
`text-lead` 18/1.6, body 14–15, caption 12–12.5, `text-eyebrow` 12 uppercase +0.08em (at most one per three sections).

## Components (`src/components/ui.tsx`, `src/site/kit.tsx`)
Button (primary, secondary, quiet, ghost, danger; sm 32 / md 36 / lg 44; loading, disabled), IconButton,
Field + Input / Select / Textarea (label above, hint or error below), Switch, Segmented, Tabs, Badge,
StatusBadge (all seven document states), Callout, Card, Stat, Progress, Table, Modal / side sheet, Toast,
EmptyState, Skeleton, charts (Bar, Line, Sparkline, StackedMeter with hidden data tables),
InvoicePaper, QR, and the **Seal** (`Stamp`). Website kit: Wrap, Section, SectionHead, PageHero, Checks,
ArrowLink, CtaBand, Faq, EchoLine (the headline's counterpart in the other language).

## Signature graphic: the seal
A tax-office seal with bilingual ring text. Use it once per marketing page and for success moments
(valid document, request received). Never as decoration on working screens.

## Voice
Plain and specific, from the user's side: "Sign & submit to ETA", not "Process document"; explain errors
with the rule and the fix ("Individuals need a 14-digit national ID at EGP 50,000 or more"), never codes alone.
