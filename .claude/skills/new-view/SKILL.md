---
name: new-view
description: Scaffold a new dashboard view — component, View type entry, route, active-view mapping, and sidebar nav item
disable-model-invocation: true
---

# New Dashboard View

Scaffold a new authenticated dashboard view named by the argument (e.g. `/new-view CohortReports` → `CohortReportsView`, route `/cohort-reports`, View id `COHORT_REPORTS`).

Adding a view touches **five places**. Missing any one of them either breaks the TypeScript build (`getRoutePath` uses `Record<View, string>`, so a new View member without a route entry is a compile error) or leaves the view unreachable.

## Steps

1. **Create the component** in `views/<Name>View.tsx`.
   - Functional component, default export, Tailwind utility classes, icons from `lucide-react`.
   - Look at a recent simple view (e.g. `views/DisciplinesView.tsx`) and match its layout conventions (page header, spacing, slate color palette).
   - Data fetching goes through a module in `services/` — never call axios directly from the view.

2. **Add the View id** to the `View` union type at the top of `types.ts` (SCREAMING_SNAKE_CASE string literal).

3. **Wire up `App.tsx`** (three separate spots):
   - Import the component with the other view imports.
   - Add `<VIEW_ID>: '/<kebab-route>'` to the `routes` record inside `getRoutePath`.
   - Add `if (path.startsWith('/<kebab-route>')) return '<VIEW_ID>';` to `getActiveView`. **Order matters** — a prefix that shadows another route must come first (see `/curricula` before `/curriculum`).
   - Add `<Route path="/<kebab-route>" element={<NameView />} />` inside the `<Routes>` block. If the view is superadmin-only, follow the `/tenants` pattern: `element={isSuperadmin ? <NameView /> : <Navigate to="/dashboard" replace />}`.

4. **Add the sidebar nav item** to the `navItems` array in `App.tsx`: `{ id: '<VIEW_ID>', label: '<Human Label>', icon: <LucideIcon> }`. Put it in the superadmin branch or the educator branch depending on the audience, and pick a lucide icon not already used by another item.

5. **Verify**: run `npx tsc --noEmit` and confirm no new errors, then check the view renders by navigating to its route in the dev server (`pnpm run dev`, port 5173).

If the user didn't specify the audience (superadmin vs educator) or which sidebar section it belongs in, ask before wiring the nav item.
