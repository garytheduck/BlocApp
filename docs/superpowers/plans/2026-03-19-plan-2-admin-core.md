# BlocApp — Plan 2: Admin Core

**Goal:** Build the complete admin management interface — association settings, building CRUD, apartment CRUD with CSV import, and the foundation for resident invitations. After this plan, an admin can fully configure their association data (buildings, apartments, residents) ready for monthly report generation in Plan 3.

**Depends on:** Plan 1 Foundation (complete)

**Tech patterns established in Plan 1:**
- Server Components by default, `'use client'` only for interactivity
- `createClient()` for user-scoped Supabase queries (RLS enforced)
- `createServiceClient()` for admin operations needing service-role
- shadcn/ui components in `components/ui/`
- Dark theme with indigo/emerald accents
- Dashboard layout: sidebar (`AdminNav`) + main content area

---

## Chunk 1: Association Settings + Building Management

### Task 1: shadcn/ui Components Setup

Install additional shadcn/ui components needed across Plan 2.

- [ ] Install: `dialog`, `table`, `select`, `textarea`, `separator`, `dropdown-menu`, `alert-dialog`, `tabs`, `toast` (if not already from sonner), `skeleton`, `switch`
- [ ] Run: `npx shadcn@latest add dialog table select textarea separator dropdown-menu alert-dialog tabs skeleton switch` inside `blocapp/`
- [ ] Verify all imported correctly in `components/ui/`

### Task 2: Association Settings Page

**Route:** `/dashboard/settings`

- [ ] Create `app/(dashboard)/dashboard/settings/page.tsx` — Server Component
  - Fetch association data: `supabase.from('associations').select('*').eq('id', associationId).single()`
  - Pass data to client form component
- [ ] Create `components/settings/association-form.tsx` — Client Component
  - Fields: `name` (required), `address`, `cui`, `bank_account`
  - Use `react-hook-form` + shadcn `Form` component
  - Server Action for save: `app/(dashboard)/dashboard/settings/actions.ts`
  - `updateAssociation(formData)` — validates, updates via Supabase, revalidates path
  - Toast on success/error
- [ ] Add section headers with `Separator` for visual grouping
- [ ] Show subscription info (read-only): plan, status, trial_ends_at — displayed in a Card
- [ ] Show Stripe Connect status (read-only placeholder for now): onboarded or not

### Task 3: Buildings CRUD

**Route:** `/dashboard/settings/buildings`

- [ ] Add a `Tabs` component on `/dashboard/settings` page with tabs: "Asociatie", "Blocuri/Scari"
  - Tab 1: Association form (Task 2)
  - Tab 2: Buildings management (this task)
- [ ] Create `components/settings/buildings-list.tsx` — Client Component
  - Table showing all buildings: name, address, floors, staircase_count, actions
  - "Adauga bloc" button opens Dialog
  - Edit button on each row opens Dialog pre-filled
  - Delete button with AlertDialog confirmation
- [ ] Create `components/settings/building-form.tsx` — Client Component (used inside Dialog)
  - Fields: `name` (required), `address`, `floors`, `staircase_count`
  - react-hook-form validation
- [ ] Create `app/(dashboard)/dashboard/settings/building-actions.ts` — Server Actions
  - `createBuilding(formData)` — insert into buildings table with association_id from profile
  - `updateBuilding(id, formData)` — update building
  - `deleteBuilding(id)` — delete building (CASCADE will remove building_id from apartments)
  - All actions: validate association ownership, revalidate path
- [ ] Show apartment count per building in the table (query with count)

---

## Chunk 2: Apartment Management

### Task 4: Apartments List Page

**Route:** `/dashboard/apartments`

- [ ] Create `app/(dashboard)/dashboard/apartments/page.tsx` — Server Component
  - Fetch apartments with building name join: `supabase.from('apartments').select('*, buildings(name)').eq('association_id', associationId).order('number')`
  - Pass to client list component
- [ ] Create `components/apartments/apartments-table.tsx` — Client Component
  - Table columns: Nr., Bloc/Scara, Etaj, Suprafata, Cota parte, Nr. persoane, Proprietar, Status (vacant/ocupat), Actiuni
  - Filter by building (Select dropdown)
  - Search by apartment number or owner name
  - Badge for vacant apartments
  - Summary row: total apartments, sum cota_parte (show warning if != 1.0)
- [ ] "Adauga apartament" button at top
- [ ] Edit / Delete actions per row
- [ ] Empty state: illustration + "Adaugati primul apartament" CTA

### Task 5: Apartment Create/Edit

- [ ] Create `components/apartments/apartment-form.tsx` — Client Component (Dialog)
  - Fields: `number` (required), `building_id` (Select from buildings), `floor`, `staircase`, `surface_m2`, `cota_parte` (required, decimal), `persons_count` (default 1), `owner_name`, `is_vacant` (Switch)
  - Validation: cota_parte must be positive decimal, number unique within association
  - react-hook-form + zod schema
- [ ] Create `app/(dashboard)/dashboard/apartments/actions.ts` — Server Actions
  - `createApartment(formData)` — insert, validate uniqueness (association_id + number)
  - `updateApartment(id, formData)` — update
  - `deleteApartment(id)` — AlertDialog confirm, check if apartment has charges/payments before delete
    - If charges exist: show warning "Apartamentul are istoric de plati. Doriti sa continuati?"
    - CASCADE will handle FK cleanup
  - `toggleVacant(id, isVacant)` — quick toggle action
- [ ] After create/edit: show updated cota_parte sum with validation warning

### Task 6: CSV Import for Apartments

- [ ] Create `components/apartments/csv-import-dialog.tsx` — Client Component
  - Step 1: File upload (drag & drop or click) — accept `.csv` only
  - Step 2: Preview parsed data in a table (first 10 rows) with validation status per row
  - Step 3: Confirm import — show total rows, warnings (duplicate numbers, cota sum)
  - Step 4: Result — success count, skipped rows with reasons
- [ ] CSV parsing: use `papaparse` library (add to dependencies)
  - Expected columns: `numar, etaj, scara, suprafata_m2, cota_parte, numar_persoane, nume_proprietar`
  - Column name matching: case-insensitive, trim whitespace
  - Optional: auto-detect separator (comma, semicolon — common in Romanian CSV)
- [ ] Create `app/api/apartments/import/route.ts` — API Route (POST)
  - Receive parsed rows as JSON (client parses CSV, server validates + inserts)
  - Validate: required fields (numar, cota_parte), data types, cota_parte sum = 1.0 (±0.0001 tolerance)
  - Check for duplicate apartment numbers (skip existing with warning)
  - All-or-nothing transaction: use `createServiceClient()` with manual BEGIN/COMMIT
  - Return: `{ inserted: number, skipped: { number: string, reason: string }[], warnings: string[] }`
- [ ] Add "Import CSV" button next to "Adauga apartament" on apartments page
- [ ] Download template button: generates a sample CSV with headers + 2 example rows

---

## Chunk 3: Dashboard Overview + Polish

### Task 7: Admin Dashboard with Real Data

**Route:** `/dashboard`

- [ ] Replace placeholder with real dashboard — `app/(dashboard)/dashboard/page.tsx`
- [ ] Create `components/dashboard/stats-cards.tsx` — Server Component
  - Card 1: Total apartamente (count) + vacant count
  - Card 2: Total blocuri (count)
  - Card 3: Subscription status + days remaining in trial
  - Card 4: Ultima lista publicata (month/year) or "Nicio lista" if none
- [ ] Create `components/dashboard/quick-actions.tsx` — Client Component
  - "Genereaza lista intretinere" → link to `/dashboard/reports/new` (placeholder for Plan 3)
  - "Adauga apartament" → link to `/dashboard/apartments`
  - "Trimite anunt" → link to `/dashboard/announcements`
- [ ] Create `components/dashboard/recent-activity.tsx` — Server Component
  - Last 5 events: new apartments added, reports published, payments received
  - Query from relevant tables, ordered by created_at desc
  - Empty state if no activity
- [ ] Use `Skeleton` components for loading states

### Task 8: Responsive Navigation + Mobile Layout

- [ ] Update `components/admin-nav.tsx` for mobile responsiveness
  - On mobile (< 768px): collapse sidebar to hamburger menu
  - Use Sheet component from shadcn for mobile drawer
  - Add hamburger button visible only on mobile
- [ ] Install shadcn `sheet` component: `npx shadcn@latest add sheet`
- [ ] Update dashboard layout to handle mobile nav state
- [ ] Test: sidebar visible on desktop, drawer on mobile
- [ ] Add breadcrumb-style page title in main content header area

### Task 9: Final Verification + Cleanup

- [ ] Verify all CRUD operations work end-to-end:
  - Create/edit/delete building
  - Create/edit/delete apartment
  - CSV import with valid and invalid data
  - Association settings save
- [ ] Verify RLS: admin can only see their own association's data
- [ ] Check TypeScript: `npx tsc --noEmit` passes
- [ ] Check build: `npm run build` succeeds
- [ ] Test mobile layout at 375px, 768px, 1280px viewpoints
- [ ] Clean up any TODO comments or placeholder text from Plan 1

---

## File Map (new/modified files)

```
blocapp/
├── app/
│   ├── (dashboard)/dashboard/
│   │   ├── page.tsx                          # MODIFY — real dashboard
│   │   ├── settings/
│   │   │   ├── page.tsx                      # NEW — settings with tabs
│   │   │   ├── actions.ts                    # NEW — association update actions
│   │   │   └── building-actions.ts           # NEW — building CRUD actions
│   │   └── apartments/
│   │       ├── page.tsx                      # NEW — apartments list
│   │       └── actions.ts                    # NEW — apartment CRUD actions
│   └── api/
│       └── apartments/
│           └── import/route.ts               # NEW — CSV import endpoint
├── components/
│   ├── admin-nav.tsx                         # MODIFY — responsive mobile
│   ├── settings/
│   │   ├── association-form.tsx              # NEW
│   │   ├── buildings-list.tsx                # NEW
│   │   └── building-form.tsx                 # NEW
│   ├── apartments/
│   │   ├── apartments-table.tsx              # NEW
│   │   ├── apartment-form.tsx               # NEW
│   │   └── csv-import-dialog.tsx            # NEW
│   └── dashboard/
│       ├── stats-cards.tsx                   # NEW
│       ├── quick-actions.tsx                 # NEW
│       └── recent-activity.tsx              # NEW
└── package.json                              # MODIFY — add papaparse
```

## Dependencies to Add

```bash
npm install papaparse
npm install -D @types/papaparse
```

## Design Notes

- All forms use shadcn `Form` + `react-hook-form` + `zod` validation
- Tables use shadcn `Table` with custom styling matching dark theme
- Dialogs for create/edit (not separate pages) — keeps context
- Server Actions for mutations (not API routes, except CSV import which needs streaming response)
- Loading states with `Skeleton` placeholders
- Empty states with helpful CTAs
- Toast notifications for all CRUD operations (success + error)
- Cota parte sum validation shown as a persistent warning banner if != 1.0
