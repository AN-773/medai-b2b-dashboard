# Educator Dashboard — Design System

The dashboard's visual language and interaction patterns. New and redesigned
screens follow this document; the primitives live in `components/ui/`
(import from `@/components/ui`).

## Principles

1. **One job per surface.** A screen answers one question or supports one
   task. Secondary tasks open in a drawer or dialog instead of adding a column.
2. **Show the workflow.** Educators build courses in a fixed order —
   objectives → content → modules. Navigation, empty states and "next step"
   prompts should make that order obvious.
3. **Quiet by default, loud only for state.** Neutral text and borders carry
   the layout. Colour is reserved for meaning: green = done/active, amber =
   needs attention, red = destructive/error, the brand gradient = AI.
4. **Readable over compact.** Never truncate content people must read to decide
   (question stems, objective titles) — clamp to 2 lines instead. Truncate
   only labels people already know (course names in lists).
5. **Every action is reversible or confirmed.** Destructive actions live in a
   `⋯` menu and go through `ConfirmDialog`. Editors track dirty state, offer
   *Discard*, and warn before losing unsaved work.

## Tokens

| Token | Value | Use |
|---|---|---|
| `bg-canvas` | `#F8F6F2` | App background behind the sidebar and the page sheet (brand off-white) |
| `bg-white` | — | The page sheet, cards, drawers |
| `stone-*` | Tailwind warm grey | All neutrals: text, borders, subtle fills |
| `brand-50…900` | around `#1BC697` | State: active nav, completed steps, progress, focus rings, success |
| `.bg-ai-gradient` / `.text-ai-gradient` / `.border-ai-gradient` | `#1BC697 → #1EAEDB → #8B5CF6` | **Only** AI actions and AI-generated content |
| `shadow-card` / `shadow-pop` / `shadow-overlay` | — | Resting cards / menus / drawers & dialogs |

Text colours: `stone-900` titles, `stone-700` body, `stone-500` secondary,
`stone-400` placeholder/disabled. Brand green text uses `brand-700` or darker
(`brand-500` fails contrast on white).

Borders: `border-stone-200` everywhere; `border-stone-100` for dividers inside
cards. Radii: `rounded-lg` controls, `rounded-xl` cards/drawers/dialogs.

## Typography (Inter)

| Role | Classes |
|---|---|
| Page title | `text-[22px] font-semibold leading-8 tracking-[-0.01em] text-stone-900` (via `PageHeader`) |
| Section title | `text-[15px] font-semibold text-stone-900` |
| Card title / row title | `text-sm font-medium text-stone-900` |
| Body | `text-sm text-stone-700` |
| Meta / helper | `text-[13px] text-stone-500` or `text-xs text-stone-500` |
| Field label | `text-[13px] font-medium text-stone-700` (via `Field`) |
| Numbers | add `tabular-nums` |

**Never**: `uppercase` + `tracking-[…]` eyebrow labels, `font-black`,
text below 12px. Sentence case everywhere ("New module", not "NEW MODULE").

## Primitives (`@/components/ui`)

| Component | Use |
|---|---|
| `Button` | `variant`: `primary` (ink — one per surface), `secondary`, `ghost`, `danger`, `danger-solid`, `ai`. `size`: `sm`/`md`. `icon`, `loading`. |
| `IconButton` | Icon-only actions; always pass `label`. |
| `Badge` / `StatusDot` | Status and categories. `tone`: neutral/green/amber/red/blue/violet. Use `StatusDot` in dense rows. |
| `Field` + `Input` / `Select` / `Textarea` | Forms. `Field` renders label, hint ("Optional"), description, error. |
| `SearchInput` | Search boxes (with clear button). |
| `SwitchRow` | Boolean settings with an explanation. |
| `SegmentedControl` | View filters (All / Needs review / …) and 2–4 way toggles. |
| `PageHeader` | Title + description + eyebrow (back link) + meta badges + actions. |
| `Drawer` | Right slide-over for editing one record or running one sub-task (attach objectives, pick items, review AI drafts). Has `toolbar` and sticky `footer`. |
| `Dialog` | Short forms: create, rename, settings. |
| `ConfirmDialog` | Every destructive confirmation (replaces `window.confirm` and the legacy `ConfirmationModal`). |
| `Menu` | `⋯` overflow actions. Destructive items use `tone: 'danger'`. |
| `EmptyState` | Every empty list: icon, what's missing, the one action that fixes it. |
| `InlineAlert` | Errors/warnings inside a surface. |
| `ProgressBar`, `Spinner` | Progress and loading. |

## Patterns

**App shell.** Light sidebar on the canvas, grouped by job (Teaching,
Content, Curriculum). Each page renders on one white sheet with a slim top
bar. There is no giant page title in the layout.

**Page layout.** `px-8 py-6` inside the sheet, max content width
`max-w-[1400px]`. Page header → toolbar (search, filters, view controls) →
content.

**Lists.** Prefer divided rows inside one bordered card (`divide-y
divide-stone-100`) over grids of individually-bordered boxes. A row has: title
(medium weight), one meta line (`text-[13px] text-stone-500`, parts separated
by ` · `), trailing status and a `⋯` menu or chevron. Hover: `bg-stone-50`.

**Editing.** Click a row → a `Drawer` opens with the full editor. The page
behind stays visible. Drawer footer: destructive action left, *Cancel* /
*Discard* and the primary save right, plus a short status hint ("Unsaved
changes", "Select at least one item").

**AI.** AI entry points are `Button variant="ai"` with the `Sparkles` icon.
AI-generated suggestions awaiting review get an AI badge and an amber
"needs review" treatment until accepted.

**Loading / errors.** Skeleton-free: a centred `Spinner` with a label for
first loads, inline spinners for partial loads. Errors are `InlineAlert` at
the top of the affected surface; page-level success is a toast.

**Density.** 8px grid. Row padding `px-4 py-3`, card padding `p-5`, gaps
between sections `space-y-8`.

## Reference implementation: Courses

`views/CoursesView.tsx` is the first screen built on this system — copy its
structure when redesigning another area.

- **Index** (`components/academy/courses/CoursesIndex.tsx`): breadcrumb top bar
  → `PageHeader` with one primary action → toolbar (scope select, search,
  `SegmentedControl` filter with counts) → card grid with a trailing dashed
  "New …" card. Cards show only facts the API guarantees; attention states
  ("14 to review") are amber badges, "Draft" is neutral.
- **Record workspace**: breadcrumb (`Teaching › Courses › internal med`) →
  `PageHeader` (title, meta badges, *Edit details* + `⋯` menu) → sticky
  `CourseStepNav`. Build steps are numbered and turn into green checks when
  done (① Objectives › ② Content › ③ Modules); side tabs (Overview, Resources)
  sit outside the numbered group.
- **Home tab** (`CourseOverviewPanel`): a single "Next step" callout computed
  from the record's state, then one card per pipeline step with a big figure,
  one line of detail and a text link into that step.
- **Outline editing** (`CourseModulesPanel`): the list *is* the page; rows
  open a `Drawer` editor with dirty tracking, a discard confirmation and a
  footer hint; small create/rename forms use `Dialog`.
