# BlocApp — Design Specification

**Date:** 2026-03-11
**Status:** Draft v2
**Product:** SaaS platform for Romanian homeowners associations (asociații de proprietari)

---

## 1. Problem & Opportunity

~153,000 registered homeowners associations in Romania manage monthly maintenance lists (liste de întreținere) using Excel spreadsheets, paper printouts, and cash collection. Existing software (BlocExpert, BlocManagerNET) is desktop-oriented, outdated, and offers no modern mobile experience for residents.

**Core pain points:**
- Administrators calculate charges manually (error-prone, time-consuming)
- Residents have no visibility into how their bill is calculated
- Cash collection is inefficient; no online payment option
- No digital communication channel between admin and residents

---

## 2. Solution

A web + PWA application with two primary interfaces:
1. **Administrator portal** — manage the association, generate monthly maintenance lists, track payments
2. **Resident portal** — view monthly charges with full breakdown, pay online, receive announcements

---

## 3. Architecture

### Stack
| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router + RSC) |
| Styling | Tailwind CSS + shadcn/ui |
| Backend | Supabase (PostgreSQL + RLS + Auth + Storage + Edge Functions) |
| Payments | Stripe Connect (platform) + Stripe Billing (SaaS subscriptions) |
| Email | Resend |
| Deploy | Vercel (frontend) + Supabase (backend) |
| PWA | next-pwa for offline support and installability |

### Multi-tenancy
Every table includes an `association_id` column. Row Level Security (RLS) policies in PostgreSQL enforce data isolation — no association can access another's data. Authentication is handled by Supabase Auth.

### User Roles
| Role | Description |
|---|---|
| `super_admin` | Platform owner (developer) |
| `admin` | Association administrator — paying customer, Stripe Connected Account |
| `resident` | Apartment owner/tenant — end user, pays via platform |

### URL Structure
```
/                          → Marketing/landing page
/auth/login                → Login
/auth/register             → New association registration
/dashboard                 → Admin dashboard
/dashboard/reports         → Maintenance lists
/dashboard/reports/new     → Create new monthly report
/dashboard/apartments      → Apartment management
/dashboard/meters          → Meter readings
/dashboard/payments        → Payment tracking
/dashboard/announcements   → Announcements
/dashboard/settings        → Association settings + Stripe Connect onboarding
/resident                  → Resident portal
/resident/pay              → Payment flow
```

### Multi-building scoping
An association can have multiple buildings. `expense_items` are scoped at the association level by default. A `building_id` filter on `expense_items` is **out of scope for MVP** — all expenses are distributed across all non-vacant apartments in the association. Building is stored for display and organizational purposes only in MVP.

---

## 4. Data Model

### `associations`
```sql
id uuid PK
name text NOT NULL
address text
cui text
bank_account text
stripe_customer_id text          -- platform subscription customer
stripe_subscription_id text
subscription_status enum('trialing', 'active', 'past_due', 'canceled')
plan enum('starter', 'pro')
stripe_connect_account_id text   -- Connected Account for resident payments
stripe_connect_onboarded boolean DEFAULT false
trial_ends_at timestamptz
created_at timestamptz DEFAULT now()
```

### `buildings`
```sql
id uuid PK
association_id uuid FK → associations.id
name text
address text
floors int
staircase_count int
```

### `apartments`
```sql
id uuid PK
association_id uuid FK
building_id uuid FK → buildings.id
number text NOT NULL
floor int
staircase text
surface_m2 decimal(8,2)
cota_parte decimal(10,6)   -- fractional share, e.g. 0.020833 for 1/48
persons_count int DEFAULT 1
owner_name text
is_vacant boolean DEFAULT false
```

**Note on `cota_parte`:** Stored as a raw fractional value (e.g. 1/48 = 0.020833). The sum of all non-vacant apartments' `cota_parte` must equal 1.0. Admin UI validates this on save. Distribution formulas divide by the sum of participating apartments' cote (not assumed to be 1.0), to handle vacancies correctly.

### `profiles` (extends Supabase auth.users)
```sql
id uuid PK (= auth.uid())
association_id uuid FK
apartment_id uuid FK nullable
role enum('super_admin', 'admin', 'resident')
full_name text
phone text
created_at timestamptz DEFAULT now()
```

**JWT Claims (set via Supabase Auth Hook — `custom_access_token` hook, server-side only):**
```json
{ "role": "admin", "association_id": "uuid-here" }
```
Claims are written from `profiles` via the `custom_access_token` Database Function hook. This hook runs server-side with service-role privileges — users cannot modify their own claims. `user_metadata` is not used for authorization.

### `resident_invites`
```sql
id uuid PK
association_id uuid FK
apartment_id uuid FK
email text NOT NULL
token text UNIQUE NOT NULL    -- secure random token
expires_at timestamptz        -- 7 days from creation
accepted_at timestamptz nullable
revoked_at timestamptz nullable
created_by uuid FK → profiles.id
```

### `monthly_reports`
```sql
id uuid PK
association_id uuid FK
period_month int CHECK (1-12)
period_year int
status enum('draft', 'collecting_meters', 'published', 'closed')
total_expenses decimal(12,2)
fond_rulment_pct decimal(5,4)    -- e.g. 0.02 = 2% of total expenses
fond_reparatii_pct decimal(5,4)
penalty_rate_per_day decimal(6,4) -- e.g. 0.005 = 0.5%/day, max legal 1%/day (OG 11/1996)
meter_deadline date               -- last day residents can submit readings
due_date date                     -- payment due date; penalties start next day
published_at timestamptz
closed_at timestamptz
created_at timestamptz DEFAULT now()
UNIQUE(association_id, period_month, period_year)
```

**Status flow:** `draft` → `collecting_meters` → `published` → `closed`

The separate `calculating` status is removed. Calculation happens synchronously when admin clicks "Publică lista" (transition to `published`). Admin can republish (recalculate) while status is `published` if corrections are needed. Once `closed`, no changes are permitted.

### `expense_items`
```sql
id uuid PK
report_id uuid FK → monthly_reports.id
association_id uuid FK
category text                -- e.g. 'apa_rece', 'salarii', 'energie_comuna'
description text
amount decimal(12,2)
distribution_method enum('per_cota', 'per_person', 'per_apartment', 'per_consumption')
consumption_type enum('apa_rece', 'apa_calda', 'gaz') nullable  -- required when per_consumption
sort_order int DEFAULT 0
```

### `meter_readings`
```sql
id uuid PK
association_id uuid FK
apartment_id uuid FK → apartments.id
report_id uuid FK → monthly_reports.id
type enum('apa_rece', 'apa_calda', 'gaz')
index_previous decimal(10,3)
index_current decimal(10,3)
consumption decimal(10,3) GENERATED ALWAYS AS (index_current - index_previous) STORED
submitted_by enum('resident', 'admin')
submitted_at timestamptz DEFAULT now()
is_estimate boolean DEFAULT false   -- true if admin entered estimated value for missing reading
UNIQUE(apartment_id, report_id, type)
```

**Missing readings:** If a resident does not submit before `meter_deadline`, the admin must enter a value (marked `is_estimate = true`). If admin also does not enter, calculation is blocked. The previous month's consumption is suggested as the estimate.

### `apartment_charges`
One row per apartment per report. Created/replaced atomically when report is published.
```sql
id uuid PK
association_id uuid FK
report_id uuid FK → monthly_reports.id
apartment_id uuid FK → apartments.id
charges_breakdown jsonb   -- [{category, description, amount, method}] for resident display
subtotal decimal(12,2)            -- sum of expense shares
fond_rulment decimal(12,2)
fond_reparatii decimal(12,2)
balance_previous decimal(12,2) DEFAULT 0  -- carried from prior month's unpaid balance
penalties decimal(12,2) DEFAULT 0         -- accumulated since due_date
total_due decimal(12,2)                   -- subtotal + fonduri + balance_previous + penalties
amount_paid decimal(12,2) DEFAULT 0
payment_status enum('unpaid', 'partial', 'paid')
last_penalty_date date nullable            -- tracks last day penalties were accrued
UNIQUE(report_id, apartment_id)
```

### `payments`
```sql
id uuid PK
association_id uuid FK
apartment_id uuid FK
apartment_charge_id uuid FK → apartment_charges.id
amount decimal(12,2)
method enum('online', 'cash', 'transfer')
stripe_payment_intent_id text nullable
stripe_application_fee decimal(8,2) nullable  -- 1.5% taken by platform
status enum('pending', 'succeeded', 'failed', 'refunded')
paid_at timestamptz
recorded_by uuid nullable FK → profiles.id  -- admin id for cash/transfer entries
notes text nullable                           -- optional note for cash payments
```

### `announcements`
```sql
id uuid PK
association_id uuid FK
author_id uuid FK → profiles.id
title text
body text
is_pinned boolean DEFAULT false
created_at timestamptz DEFAULT now()
```

---

## 5. Core Features

### 5.1 Monthly Report — Full Workflow

**States:**
- `draft` — admin is entering expense items; residents see nothing
- `collecting_meters` — admin opens meter submission window; residents receive email notification and can submit readings
- `published` — admin has finalized, calculation is complete; residents see their charges; online payment enabled
- `closed` — all payments settled or month archived; no further changes

**Transitions:**
- `draft` → `collecting_meters`: admin clicks "Deschide citiri apometre"
- `collecting_meters` → `published`: admin clicks "Publică lista" — triggers calculation
- `published` → `published`: admin can re-publish (recalculates, replaces `apartment_charges`) while no payment has been made
- `published` → `closed`: admin clicks "Închide luna" or scheduled after 60 days

**Recalculation guard:** If any apartment has a succeeded payment, re-publishing is blocked. Admin must reverse the payment first.

### 5.2 Calculation Engine

Runs in a single PostgreSQL transaction (called from Next.js API route with service-role client).

**Inputs:** All `expense_items` for the report, all `apartments` (non-vacant), all `meter_readings` for the report.

**For each `expense_item`:**

```
per_cota:
  divisor = SUM(cota_parte) for non-vacant apartments
  apt_share = item.amount × (apt.cota_parte / divisor)

per_person:
  divisor = SUM(persons_count) for non-vacant apartments
  apt_share = item.amount × (apt.persons_count / divisor)

per_apartment:
  divisor = COUNT(non-vacant apartments)
  apt_share = item.amount / divisor

per_consumption:
  For each apartment: find meter_reading WHERE type = item.consumption_type
  divisor = SUM(consumption) across all non-vacant apartments
  IF divisor = 0: distribute per_apartment as fallback (no consumption recorded)
  ELSE: apt_share = item.amount × (apt_consumption / divisor)
```

**Rounding:** Each share is rounded to 2 decimal places. Rounding differences (±0.01 RON) are applied to the apartment with the highest charge.

**fond_rulment and fond_reparatii:**
```
fond_rulment_share = subtotal × fond_rulment_pct
fond_reparatii_share = subtotal × fond_reparatii_pct
```

**balance_previous:** Taken from the prior month's `apartment_charges.total_due - amount_paid` for the same apartment. If no prior month exists, 0.

**penalties:** Initialized to 0 at publication. Accrued daily by pg_cron after `due_date`.

**Final:**
```
total_due = subtotal + fond_rulment_share + fond_reparatii_share + balance_previous + penalties
```

### 5.3 Penalty Accrual

- Configured per report: `penalty_rate_per_day` (admin sets this, default 0.2%/day, legal max 1%/day per OG 11/1996)
- Grace period: penalties begin the day after `due_date`
- pg_cron job runs daily at 08:00 Romania time:
  ```sql
  UPDATE apartment_charges
  SET penalties = penalties + (total_due - amount_paid) * penalty_rate_per_day,
      total_due = total_due + (total_due - amount_paid) * penalty_rate_per_day,
      last_penalty_date = CURRENT_DATE
  WHERE payment_status != 'paid'
    AND last_penalty_date < CURRENT_DATE
    AND EXISTS (SELECT 1 FROM monthly_reports mr
                WHERE mr.id = report_id AND mr.due_date < CURRENT_DATE AND mr.status = 'published')
  ```
- Penalties do not compound (applied to `total_due - amount_paid`, not to accumulated penalties)
- When a payment is recorded, `amount_paid` is updated; penalties stop accruing when `payment_status = 'paid'`
- Admin can manually waive penalties (sets `penalties = 0`, recalculates `total_due`)

### 5.4 Stripe Architecture — Two Separate Flows

**Flow A: SaaS Subscription (admin pays platform)**
- Platform has its own Stripe account
- Admin signs up → Stripe Billing Checkout Session → subscription created
- `associations.stripe_customer_id` + `stripe_subscription_id` stored
- Webhook: `customer.subscription.updated` → update `subscription_status`

**Flow B: Resident Payments (Stripe Connect)**
- Each association admin onboards as a Stripe Connect Express account
- `associations.stripe_connect_account_id` stored after onboarding
- When resident pays: Next.js API creates PaymentIntent on the Connected Account with `application_fee_amount = ceil(amount * 0.015)`
- Money flows: resident → association's Stripe account (minus 1.5% platform fee)
- Platform fee is automatic — no manual transfers needed
- Webhook: `payment_intent.succeeded` on the Connect account → update `payments` + `apartment_charges`

**Subscription enforcement:**
- During `trialing` or `active`: full access
- During `past_due`: read-only for admin (cannot publish new reports or invite residents); residents can still view and pay
- During `canceled`: admin redirected to billing page; residents retain read-only access for 30 days
- Stripe Connect onboarding is independent of subscription status — admin can complete it at any time after registration

**Resident can pay online only if:**
1. Association has `stripe_connect_onboarded = true`
2. `apartment_charges.payment_status != 'paid'`
3. `monthly_reports.status = 'published'`

### 5.5 Cash / Transfer Payment Recording

Admin-only action. Fields captured:
- `amount` (can be partial)
- `method` (cash | transfer)
- `paid_at` (defaults to now, admin can set past date)
- `notes` (optional, e.g. receipt number)

No Stripe involved. Creates a `payments` row with `method = 'cash'` or `'transfer'`, `status = 'succeeded'`, `recorded_by = admin.id`. Updates `apartment_charges.amount_paid` and `payment_status`. Can be deleted by admin (reversal) only while report is `published`.

### 5.6 Resident Invitation Flow

1. Admin enters email + selects apartment → system creates `resident_invites` row with 7-day expiry token
2. Resend sends invite email with link: `/auth/accept-invite?token=xxx`
3. Resident clicks link:
   - Token validated (not expired, not revoked, not already accepted)
   - If email already has a Supabase account: link apartment to existing profile, skip registration
   - If email is new: show name + password form → create account → link apartment
4. `resident_invites.accepted_at` set; `profiles.apartment_id = apartment_id`
5. Admin can revoke an unaccepted invite (sets `revoked_at`); expired tokens are auto-cleaned

**Edge cases:**
- Wrong person accepts: admin can unlink a resident from an apartment and re-invite
- Duplicate invite for same apartment: new invite revokes the previous one automatically

### 5.7 Meter Reading Collection

**State: `collecting_meters`**
- Admin sets `meter_deadline` before transitioning
- Residents receive email notification: "Introduceți indexurile apometrelor până pe [date]"
- Resident portal shows meter submission form for each meter type configured for their apartment
- Resident submits → `meter_readings` row created with `submitted_by = 'resident'`
- Resident can update their own reading until `meter_deadline` passes
- After `meter_deadline`, only admin can enter/override readings
- Admin dashboard shows: apartments with submitted readings vs. missing, with one-click to enter missing values

**Admin override:** Creates/replaces the `meter_readings` row with `submitted_by = 'admin'`. Resident is not notified of admin overrides.

**Blocking condition for publish:** If any `expense_item` has `distribution_method = 'per_consumption'`, all non-vacant apartments must have a reading for that `consumption_type`. Missing readings block publication with a clear error listing the apartments.

### 5.8 PDF Export

**Content (per Romanian association practice and OG 11/1996):**
- Association name, CUI, address
- Period (month/year)
- Table of all expense items: category, total amount, distribution method
- Per-apartment summary table: apartment number, owner name, per-expense breakdown, fond rulment, fond reparatii, balance previous, penalties, **TOTAL DE PLATĂ**
- Generation timestamp and administrator name
- Footer: "Generat de BlocApp"

**Format:** A4, portrait. One page for expense summary, remaining pages for per-apartment table.
**Generator:** `@react-pdf/renderer` (server-side, Next.js API route). No puppeteer — too heavy for serverless.
**Access:** Admin only. Resident can download only their own single-apartment PDF.

---

## 6. Monetization

### SaaS Subscription (admin pays)
| Plan | Price | Limit |
|---|---|---|
| Starter | 49 RON/month | up to 50 apartments |
| Pro | 149 RON/month | unlimited apartments |

**Trial:** 14 days, no credit card required. All features available. After trial: credit card required to continue. Data retained for 30 days after cancellation, then deleted (admin notified by email at 7-day and 1-day before deletion).

### Payment Commission (passive revenue)
- 1.5% platform application fee on all online resident payments
- Collected automatically via Stripe Connect application fee
- No action required per payment

### Projections
- 30 associations × ~100 RON avg = 3,000 RON/month recurring
- 1,000 apartments × 300 RON avg × 1.5% = 4,500 RON/month commission

---

## 7. Authentication & Authorization

### Auth mechanism
- Supabase Auth: email/password login + magic link (for resident invites)
- JWT custom claims set via Supabase `custom_access_token` hook (PostgreSQL function, service-role only)
- Claims: `{ "user_role": "admin", "association_id": "uuid" }`
- `user_metadata` is NOT used for authorization (user-editable, insecure)

### RLS policy pattern
```sql
-- Admins access their association only
CREATE POLICY "admin_association_isolation" ON monthly_reports
  FOR ALL USING (
    association_id = (auth.jwt() ->> 'association_id')::uuid
    AND (auth.jwt() ->> 'user_role') = 'admin'
  );

-- Residents access only their apartment's charges
CREATE POLICY "resident_own_charges" ON apartment_charges
  FOR SELECT USING (
    apartment_id = (
      SELECT apartment_id FROM profiles WHERE id = auth.uid()
    )
  );
```

### Route protection
- Next.js middleware checks JWT claims and redirects unauthenticated/unauthorized requests
- `/dashboard/*` requires `user_role = admin`
- `/resident/*` requires `user_role = resident`

---

## 8. MVP Scope

**In scope:**
- Association setup & apartment management (manual + CSV import)
- Monthly report creation with all 4 distribution methods
- Meter reading collection (resident self-service + admin override + missing-reading handling)
- Automatic charge calculation per apartment (single PostgreSQL transaction)
- Online payment for residents (Stripe Connect)
- Cash/transfer payment recording by admin
- Daily penalty accrual (pg_cron) with admin waiver
- Announcements (create, pin, list)
- Resident invitation via email (magic link, 7-day expiry)
- PDF export of monthly list (association-wide + per-apartment)
- Stripe Billing subscription for admin
- Stripe Connect onboarding for associations

**Out of scope for MVP:**
- Native mobile app (PWA covers mobile)
- Netopia integration
- Multi-language (Romanian only)
- Advanced analytics / BI dashboard
- Third-party API
- Bulk SMS notifications
- Per-building expense scoping
- Expense document/invoice attachments

---

## 9. Design System

- **Color palette:** Dark navy background (`#030712`, `#0f172a`), Indigo accent (`#4f46e5`, `#818cf8`), Emerald secondary (`#059669`, `#34d399`)
- **Typography:** Inter (system font stack)
- **Components:** shadcn/ui base, customized to dark theme
- **Design principle:** Dark, sleek, minimal — high information density, no decorative clutter
- **PWA:** Installable on iOS/Android, offline view for last-loaded charges/announcements
- **Note:** Design aesthetic may evolve; all functional specifications in this doc are fixed

---

## 11. Edge Cases & Implementation Details

### 11.1 meter_deadline
Stored on `monthly_reports.meter_deadline` (type `date`, nullable). If null, there is no automated deadline enforcement — admin must manually transition. When set, the system blocks resident submissions after that date (checked server-side). Transitioning from `collecting_meters` → `published` is always a **manual admin action** (button click). There is no automatic transition on deadline. The deadline only controls who can enter readings, not when the state changes.

### 11.2 Report state transition triggers
| Transition | Trigger | Who |
|---|---|---|
| `draft` → `collecting_meters` | Admin clicks "Deschide citiri" | admin |
| `collecting_meters` → `published` | Admin clicks "Publică lista" | admin |
| `published` → `published` | Admin clicks "Repuplică" (recalculate) | admin |
| `published` → `closed` | Admin clicks "Închide luna" | admin |

All transitions are explicit manual actions. No automatic transitions.

### 11.3 Re-publish guard
Re-publication is blocked if **any payment with `status = 'succeeded'` exists** for that report, regardless of method (online, cash, or transfer). Admin must delete/reverse all succeeded payments before recalculating. This prevents recalculation from invalidating already-collected money.

### 11.4 balance_previous for first report
- First report ever for an apartment: `balance_previous = 0`
- If a prior month's report exists but no `apartment_charges` row (report was skipped): `balance_previous = 0`
- `persons_count` default: 1 for all new apartments. Admin must update before first calculation. If `SUM(persons_count) = 0` across all non-vacant apartments, `per_person` distribution falls back to `per_apartment` with an admin warning displayed.

### 11.5 Stripe Connect onboarding
- After admin registers: redirect to `/dashboard/settings/billing` which shows both subscription status and Connect onboarding status
- Onboarding: Next.js API creates Connect Express account → redirects to Stripe-hosted onboarding → Stripe redirects back to `/dashboard/settings/billing?connect=success`
- `stripe_connect_onboarded` is set to `true` via webhook: `account.updated` where `charges_enabled = true`
- If onboarding is incomplete/rejected: admin sees warning banner; online payments remain disabled; association data and subscriptions unaffected
- If Connected Account is deauthorized post-onboarding: `stripe_connect_onboarded` set to `false` via `account.application.deauthorized` webhook; pending PaymentIntents are abandoned (Stripe handles this); residents see "Plata online indisponibilă temporar" message

### 11.6 Penalty waiver
"Waive penalty" zeroes `apartment_charges.penalties` and recalculates `total_due`. It does **not** prevent future accrual — the pg_cron job will continue accruing from the new (lower) unpaid balance. Waiver survives re-publication only if explicitly preserved: when re-publishing, the system checks for existing waiver flag (`penalties_waived boolean DEFAULT false`) and skips penalty recalculation for flagged rows.

Add to `apartment_charges` schema:
```sql
penalties_waived boolean DEFAULT false
```

### 11.7 Stripe minimum charge
Minimum online payment: **10 RON** (enforced in UI and API). If `apartment_charges.total_due < 10`, online payment button is disabled and admin is advised to collect cash. This avoids Stripe minimum amount rejections (50 EUR cents ≈ 2.5 RON, but we use 10 RON as practical floor given 1.5% fee on small amounts).

### 11.8 Subscription cancellation timestamp
Add to `associations`:
```sql
canceled_at timestamptz nullable
```
Set via `customer.subscription.deleted` webhook. 30-day resident read-only access calculated as `canceled_at + interval '30 days' > now()`.

### 11.9 CSV import schema
Expected columns (apartment import):
```
numar, etaj, scara, suprafata_m2, cota_parte, numar_persoane, nume_proprietar
```
- `numar`: required, unique within association
- `cota_parte`: required, decimal (e.g. `0.020833`)
- All others: optional, default values applied if missing
- Validation: cota_parte sum across all rows must equal 1.0 (±0.0001 tolerance)
- Conflict: if `numar` already exists, row is skipped with a warning (no upsert in MVP)
- Full transaction: all rows inserted or none

### 11.10 PDF generation runtime
`@react-pdf/renderer` runs in a **Next.js API route** (`/api/reports/[id]/pdf`) with explicit `export const runtime = 'nodejs'` declaration. Not an Edge Function (Node.js APIs required). Vercel function size limit is 50MB unzipped — @react-pdf/renderer bundle is ~8MB, within limits. Function timeout set to 30s (sufficient for up to 200 apartments).

### 11.11 Supabase Realtime security
Using `postgres_changes` event on `apartment_charges` table. RLS is enforced on Realtime with `postgres_changes` — Supabase applies RLS policies to change events. Channel setup:
```js
// Resident subscribes only to their apartment's charge
supabase.channel('charge-updates')
  .on('postgres_changes', {
    event: 'UPDATE',
    schema: 'public',
    table: 'apartment_charges',
    filter: `apartment_id=eq.${residentApartmentId}`
  }, callback)
```
RLS policy on `apartment_charges` (SELECT for resident) ensures the filter is enforced server-side. Realtime must be explicitly enabled for the `apartment_charges` table in Supabase dashboard.

### 11.12 persons_count lifecycle
- Set by admin when creating/editing an apartment (default: 1)
- Snapshotted at calculation time: the current `apartments.persons_count` value is used when the report is published — not a historical snapshot stored separately
- Admin is responsible for keeping `persons_count` updated before publishing each month
- Vacant apartments (`is_vacant = true`) are excluded from all distribution calculations

## 12. Technical Considerations

- **RLS performance:** `association_id` indexed on every table; `apartment_id` indexed on `apartment_charges` and `meter_readings`
- **Calculation atomicity:** Entire publish operation (delete old charges + insert new charges) in one DB transaction with `BEGIN/COMMIT`
- **Stripe webhook idempotency:** All webhook handlers check for existing processed event ID before acting; Stripe event ID stored on `payments`
- **CSV import:** Server-side validation (column presence, data types, cota_parte sum = 1.0); entire import in one transaction, rolled back on any error
- **PDF generation:** `@react-pdf/renderer` in Next.js API route (not Edge Function — Node.js runtime required)
- **Real-time:** Supabase Realtime channel on `apartment_charges` for live payment status on resident portal
- **pg_cron:** Penalty job runs daily at `06:00 UTC` (= 08:00 Romanian time); requires `pg_cron` extension enabled in Supabase
- **Rounding:** All monetary calculations use `decimal.js` library client-side for preview; PostgreSQL `NUMERIC` for authoritative storage
