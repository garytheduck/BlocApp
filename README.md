# BlocApp

> SaaS platform for Romanian homeowners associations (*asociații de proprietari*) — maintenance list generation, resident portal, online payments, and subscription billing.

Romania has ~153,000 homeowners associations with virtually no modern software. BlocApp is a multi-tenant SaaS that replaces paper-based administration with a clean web platform.

---

## Screenshots

### Admin Dashboard
![Admin Dashboard](docs/screenshots/dashboard.png)

### Apartments Management
![Apartments](docs/screenshots/apartments.png)

### Maintenance List (Liste de Întreținere)
![Maintenance List](docs/screenshots/reports.png)

### SaaS Billing
![Billing](docs/screenshots/billing.png)

---

## Features

### For Administrators
- **Maintenance list generation** — monthly expense allocation across apartments using 4 distribution methods: by share (*cotă-parte*), by person, per apartment, or by meter consumption
- **Apartment management** — full CRUD with CSV bulk import, cota-parte validation
- **Meter readings** — collect cold/hot water and gas readings per apartment; residents can submit their own
- **Payments** — record cash/bank transfers; online payments via Stripe Connect (1.5% platform fee)
- **Resident management** — invite residents by email (token-based, 7-day expiry)
- **Announcements** — broadcast pinned or regular messages to all residents
- **PDF export** — download generated maintenance lists as formatted PDFs
- **Settings** — manage association details, buildings, Stripe Connect onboarding

### For Residents
- **Portal** — view monthly charges with full breakdown (expenses, funds, balance carried forward, penalties)
- **Online payments** — pay maintenance fees directly via Stripe
- **Meter submission** — submit utility meter readings during the collection phase
- **Announcements feed** — view admin announcements with pinned priority

### Platform
- **SaaS billing** — Starter (49 RON/mo) and Pro (149 RON/mo) plans with 14-day free trial via Stripe Checkout
- **Multi-tenancy** — full data isolation via PostgreSQL Row Level Security
- **Email** — automated invite emails via Resend

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Database | Supabase (PostgreSQL + RLS + Auth) |
| Styling | Tailwind CSS v4 + shadcn/ui v4 (base-ui) |
| Payments | Stripe Connect + Stripe Billing |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Deploy | Vercel + Supabase |

---

## Project Structure

```
blocapp/
├── app/
│   ├── (dashboard)/dashboard/     # Admin panel routes
│   │   ├── reports/               # Maintenance lists
│   │   ├── apartments/            # Apartment management
│   │   ├── residents/             # Resident invites
│   │   ├── payments/              # Payment recording
│   │   ├── announcements/         # Announcements CRUD
│   │   └── settings/              # Association settings + billing
│   ├── (resident)/resident/       # Resident portal routes
│   │   ├── charges/               # Monthly charges + online payment
│   │   ├── meters/                # Meter reading submission
│   │   └── announcements/         # Announcements feed
│   ├── api/
│   │   ├── reports/[id]/pdf/      # PDF generation route
│   │   ├── webhooks/stripe/       # Stripe webhook handler
│   │   └── auth/                  # Register + invite acceptance
│   └── auth/                      # Login + register pages
├── components/                    # Reusable UI components
├── lib/
│   ├── supabase/                  # Browser + server + service clients
│   ├── pdf/                       # React-PDF document component
│   ├── emails/                    # Resend email templates
│   ├── stripe.ts                  # Stripe client + helpers
│   ├── admin-ctx.ts               # Admin Server Action auth helper
│   ├── get-profile.ts             # Admin page auth helper
│   └── get-resident-profile.ts    # Resident page auth helper
├── types/database.ts              # TypeScript types mirroring DB schema
└── supabase/migrations/           # 4 SQL migration files
```

---

## Data Model

11 tables with full Row Level Security:

`associations` · `buildings` · `apartments` · `profiles` · `resident_invites` · `monthly_reports` · `expense_items` · `meter_readings` · `apartment_charges` · `payments` · `announcements`

### Expense Distribution Methods
- `per_cota` — proportional to each apartment's ownership share
- `per_person` — split equally among occupants (vacant apartments excluded)
- `per_apartment` — equal split among occupied apartments
- `per_consumption` — proportional to meter readings (water/gas)

### Report Status Flow
```
draft → collecting_meters → published → closed
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Stripe](https://stripe.com) account (for payments)
- A [Resend](https://resend.com) account (for email, optional)

### 1. Clone and install

```bash
git clone https://github.com/garytheduck/BlocApp.git
cd BlocApp/blocapp
npm install
```

### 2. Environment variables

Create `blocapp/.env.local`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_STARTER_PRICE_ID=price_...
STRIPE_PRO_PRICE_ID=price_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...

# Resend (optional)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@yourdomain.com

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Run migrations

Apply the 4 migration files in order via the Supabase SQL editor:

```
supabase/migrations/20260311000001_schema.sql
supabase/migrations/20260311000002_rls.sql
supabase/migrations/20260311000003_functions.sql
```

Also enable the **custom access token hook** in Supabase Dashboard → Auth → Hooks, pointing to `public.custom_access_token_hook`.

### 4. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## User Roles

| Role | Access |
|------|--------|
| **Administrator** | Full admin dashboard — manages the association, generates maintenance lists, invites residents, records payments |
| **Resident** | Resident portal — views charges, submits meter readings, pays online, reads announcements |

Administrators register at `/auth/register` (creates an association + admin account).
Residents are invited by email from the admin panel.

---

## Deployment

### Vercel + Supabase

1. Push to GitHub (already done)
2. Import the repo in [Vercel](https://vercel.com) — set root directory to `blocapp`
3. Add all environment variables in Vercel project settings
4. Set up the Stripe webhook endpoint pointing to `https://yourdomain.com/api/webhooks/stripe`

---

## License

MIT
