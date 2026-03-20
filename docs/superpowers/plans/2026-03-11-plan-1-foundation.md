# BlocApp — Plan 1: Foundation

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the Next.js + Supabase project with full database schema, RLS policies, authentication flow, JWT claims, and route-protection middleware — everything subsequent plans build on.

**Architecture:** Next.js 14 App Router project deployed on Vercel, connected to a Supabase project for PostgreSQL + Auth. All tables include `association_id` for multi-tenancy. RLS policies enforce isolation at the DB layer. Next.js middleware enforces auth at the route layer. JWT custom claims (set via Supabase DB hook) carry `user_role` and `association_id` so RLS policies can read them without additional DB queries.

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, shadcn/ui, Supabase JS v2, Supabase CLI, PostgreSQL migrations, next-pwa

---

## Chunk 1: Project Scaffold + Database Schema

### File Structure

```
blocapp/
├── app/
│   ├── layout.tsx                     # Root layout, Inter font, dark theme
│   ├── page.tsx                       # Landing page (placeholder)
│   ├── globals.css                    # Tailwind base + dark theme vars
│   ├── auth/
│   │   ├── layout.tsx                 # Centered auth shell layout
│   │   ├── login/page.tsx             # Login form → serves at /auth/login
│   │   ├── register/page.tsx          # Registration → serves at /auth/register
│   │   └── accept-invite/page.tsx     # Invite acceptance → /auth/accept-invite
│   ├── (dashboard)/
│   │   └── dashboard/
│   │       ├── layout.tsx             # Admin shell layout
│   │       └── page.tsx               # Admin dashboard placeholder
│   └── (resident)/
│       └── resident/
│           ├── layout.tsx             # Resident shell layout
│           └── page.tsx               # Resident portal placeholder
├── components/
│   ├── ui/                            # shadcn/ui components (auto-generated)
│   ├── admin-nav.tsx                  # Admin sidebar navigation
│   └── resident-nav.tsx               # Resident top navigation bar
├── lib/
│   ├── supabase/
│   │   ├── client.ts                  # Browser Supabase client (singleton)
│   │   └── server.ts                  # Server Supabase client (per-request)
│   └── utils.ts                       # cn() helper + shared utils
├── types/
│   └── database.ts                    # Supabase-generated DB types (manual stub → replaced Task 10)
├── middleware.ts                       # Route protection
├── supabase/
│   ├── config.toml                    # Supabase local dev config
│   └── migrations/
│       ├── 20260311000001_schema.sql  # All tables
│       ├── 20260311000002_rls.sql     # RLS policies
│       ├── 20260311000003_functions.sql # JWT claims hook, profile trigger, grants
│       └── 20260311000004_cron.sql     # pg_cron penalty job (pushed AFTER Task 10.4)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

### Task 1: Initialize Next.js Project

**Files:**
- Create: `package.json`, `next.config.ts`, `tsconfig.json`, `tailwind.config.ts`, `app/globals.css`, `app/layout.tsx`, `app/page.tsx`

- [ ] **Step 1.1: Create the project**

```bash
cd "C:/Users/Samuel/Desktop/Proiect asociatie"
npx create-next-app@latest blocapp \
  --typescript \
  --tailwind \
  --eslint \
  --app \
  --src-dir=false \
  --import-alias="@/*"
cd blocapp
```

- [ ] **Step 1.2: Install dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install next-pwa
npm install decimal.js
npm install -D supabase
```

- [ ] **Step 1.3: Initialize shadcn/ui**

```bash
npx shadcn@latest init
```

When prompted:
- Style: Default
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 1.4: Add essential shadcn components**

```bash
npx shadcn@latest add button input label card badge toast form
```

- [ ] **Step 1.5: Configure dark theme in `tailwind.config.ts`**

```typescript
import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./app/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "#4f46e5",
          foreground: "#ffffff",
        },
        secondary: {
          DEFAULT: "#059669",
          foreground: "#ffffff",
        },
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}

export default config
```

- [ ] **Step 1.6: Set dark theme CSS variables in `app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 222 47% 3%;
    --foreground: 210 40% 98%;
    --card: 222 47% 6%;
    --card-foreground: 210 40% 98%;
    --popover: 222 47% 6%;
    --popover-foreground: 210 40% 98%;
    --primary: 243 75% 59%;
    --primary-foreground: 0 0% 100%;
    --secondary: 160 84% 39%;
    --secondary-foreground: 0 0% 100%;
    --muted: 217 33% 17%;
    --muted-foreground: 215 20% 65%;
    --accent: 217 33% 17%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 84% 60%;
    --destructive-foreground: 0 0% 100%;
    --border: 217 33% 17%;
    --input: 217 33% 17%;
    --ring: 243 75% 59%;
    --radius: 0.5rem;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
    font-feature-settings: "rlig" 1, "calt" 1;
  }
}
```

- [ ] **Step 1.7: Configure `app/layout.tsx`**

```typescript
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "BlocApp — Administrare Asociații de Proprietari",
  description: "Gestionează lista de întreținere, plăți și comunicarea cu locatarii.",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ro" className="dark">
      <body className={inter.className}>{children}</body>
    </html>
  )
}
```

- [ ] **Step 1.8: Add placeholder `app/page.tsx`**

```typescript
export default function HomePage() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <h1 className="text-3xl font-bold text-primary">BlocApp</h1>
    </main>
  )
}
```

- [ ] **Step 1.9: Verify the app builds**

```bash
npm run dev
```

Expected: Server starts on http://localhost:3000, page shows "BlocApp" in indigo.

- [ ] **Step 1.10: Commit**

```bash
git init
git add .
git commit -m "feat: initialize Next.js 14 project with Tailwind dark theme and shadcn/ui"
```

---

### Task 2: Supabase Project Setup

**Files:**
- Create: `supabase/config.toml`, `.env.local`, `.env.local.example`

- [ ] **Step 2.1: Create Supabase project**

Go to https://supabase.com → New project → Name: `blocapp` → Note the project URL and anon key.

- [ ] **Step 2.2: Initialize Supabase CLI**

```bash
npx supabase init
```

- [ ] **Step 2.3: Link to remote project**

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
```

Get `<your-project-ref>` from your Supabase project URL: `https://supabase.com/dashboard/project/<ref>`.

- [ ] **Step 2.4: Create `.env.local`**

```bash
# .env.local — DO NOT COMMIT
NEXT_PUBLIC_SUPABASE_URL=https://<your-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

Find these in Supabase Dashboard → Project Settings → API.

- [ ] **Step 2.5: Create `.env.local.example`** (safe to commit)

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 2.6: Add `.env.local` to `.gitignore`**

```bash
echo ".env.local" >> .gitignore
```

- [ ] **Step 2.7: Commit**

```bash
git add .gitignore .env.local.example supabase/
git commit -m "feat: add Supabase CLI config and env template"
```

---

### Task 3: Database Schema Migration

**Files:**
- Create: `supabase/migrations/20260311000001_schema.sql`

- [ ] **Step 3.1: Create the schema migration file**

Create `supabase/migrations/20260311000001_schema.sql` with the following content:

```sql
-- Enable required extensions
-- NOTE: pg_cron must be enabled via Supabase Dashboard BEFORE running the functions migration (Task 10.4).
-- It cannot be enabled via CREATE EXTENSION in user migrations — Supabase requires platform-level activation.
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ENUMS
CREATE TYPE subscription_status AS ENUM ('trialing', 'active', 'past_due', 'canceled');
CREATE TYPE subscription_plan AS ENUM ('starter', 'pro');
CREATE TYPE user_role AS ENUM ('super_admin', 'admin', 'resident');
CREATE TYPE report_status AS ENUM ('draft', 'collecting_meters', 'published', 'closed');
CREATE TYPE distribution_method AS ENUM ('per_cota', 'per_person', 'per_apartment', 'per_consumption');
CREATE TYPE consumption_type AS ENUM ('apa_rece', 'apa_calda', 'gaz');
CREATE TYPE meter_submitted_by AS ENUM ('resident', 'admin');
CREATE TYPE payment_method AS ENUM ('online', 'cash', 'transfer');
CREATE TYPE payment_status AS ENUM ('pending', 'succeeded', 'failed', 'refunded');
CREATE TYPE charge_payment_status AS ENUM ('unpaid', 'partial', 'paid');

-- ASSOCIATIONS
CREATE TABLE associations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  address text,
  cui text,
  bank_account text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status subscription_status NOT NULL DEFAULT 'trialing',
  plan subscription_plan NOT NULL DEFAULT 'starter',
  stripe_connect_account_id text,
  stripe_connect_onboarded boolean NOT NULL DEFAULT false,
  trial_ends_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  canceled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- BUILDINGS
CREATE TABLE buildings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  floors int,
  staircase_count int
);

-- APARTMENTS
CREATE TABLE apartments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  building_id uuid REFERENCES buildings(id) ON DELETE SET NULL,
  number text NOT NULL,
  floor int,
  staircase text,
  surface_m2 decimal(8,2),
  cota_parte decimal(10,6) NOT NULL DEFAULT 0,
  persons_count int NOT NULL DEFAULT 1,
  owner_name text,
  is_vacant boolean NOT NULL DEFAULT false,
  UNIQUE(association_id, number)
);

-- PROFILES (extends auth.users)
CREATE TABLE profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  association_id uuid REFERENCES associations(id) ON DELETE SET NULL,
  apartment_id uuid REFERENCES apartments(id) ON DELETE SET NULL,
  role user_role NOT NULL DEFAULT 'resident',
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RESIDENT INVITES
CREATE TABLE resident_invites (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  email text NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- MONTHLY REPORTS
CREATE TABLE monthly_reports (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  period_year int NOT NULL CHECK (period_year BETWEEN 2020 AND 2100),
  status report_status NOT NULL DEFAULT 'draft',
  total_expenses decimal(12,2) NOT NULL DEFAULT 0,
  fond_rulment_pct decimal(5,4) NOT NULL DEFAULT 0.02,
  fond_reparatii_pct decimal(5,4) NOT NULL DEFAULT 0,
  penalty_rate_per_day decimal(6,4) NOT NULL DEFAULT 0.002,
  meter_deadline date,
  due_date date,
  published_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(association_id, period_month, period_year)
);

-- EXPENSE ITEMS
CREATE TABLE expense_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id uuid NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  category text NOT NULL,
  description text,
  amount decimal(12,2) NOT NULL CHECK (amount >= 0),
  distribution_method distribution_method NOT NULL,
  consumption_type consumption_type,
  sort_order int NOT NULL DEFAULT 0,
  CONSTRAINT consumption_type_required CHECK (
    (distribution_method = 'per_consumption' AND consumption_type IS NOT NULL) OR
    (distribution_method != 'per_consumption')
  )
);

-- METER READINGS
CREATE TABLE meter_readings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  type consumption_type NOT NULL,
  index_previous decimal(10,3) NOT NULL,
  index_current decimal(10,3) NOT NULL CHECK (index_current >= index_previous),
  consumption decimal(10,3) GENERATED ALWAYS AS (index_current - index_previous) STORED,
  submitted_by meter_submitted_by NOT NULL DEFAULT 'admin',
  is_estimate boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(apartment_id, report_id, type)
);

-- APARTMENT CHARGES
CREATE TABLE apartment_charges (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  report_id uuid NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  charges_breakdown jsonb NOT NULL DEFAULT '[]',
  subtotal decimal(12,2) NOT NULL DEFAULT 0,
  fond_rulment decimal(12,2) NOT NULL DEFAULT 0,
  fond_reparatii decimal(12,2) NOT NULL DEFAULT 0,
  balance_previous decimal(12,2) NOT NULL DEFAULT 0,
  penalties decimal(12,2) NOT NULL DEFAULT 0,
  penalties_waived boolean NOT NULL DEFAULT false,
  total_due decimal(12,2) NOT NULL DEFAULT 0,
  amount_paid decimal(12,2) NOT NULL DEFAULT 0,
  payment_status charge_payment_status NOT NULL DEFAULT 'unpaid',
  last_penalty_date date,
  UNIQUE(report_id, apartment_id)
);

-- PAYMENTS
CREATE TABLE payments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  apartment_id uuid NOT NULL REFERENCES apartments(id) ON DELETE CASCADE,
  apartment_charge_id uuid NOT NULL REFERENCES apartment_charges(id) ON DELETE CASCADE,
  amount decimal(12,2) NOT NULL CHECK (amount > 0),
  method payment_method NOT NULL,
  stripe_payment_intent_id text,
  stripe_application_fee decimal(8,2),
  stripe_event_id text UNIQUE,
  status payment_status NOT NULL DEFAULT 'pending',
  paid_at timestamptz,
  recorded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  notes text
);

-- ANNOUNCEMENTS
CREATE TABLE announcements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  author_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- INDEXES
CREATE INDEX idx_buildings_association ON buildings(association_id);
CREATE INDEX idx_apartments_association ON apartments(association_id);
CREATE INDEX idx_apartments_building ON apartments(building_id);
CREATE INDEX idx_profiles_association ON profiles(association_id);
CREATE INDEX idx_profiles_apartment ON profiles(apartment_id);
CREATE INDEX idx_invites_association ON resident_invites(association_id);
CREATE INDEX idx_invites_token ON resident_invites(token);
CREATE INDEX idx_reports_association ON monthly_reports(association_id);
CREATE INDEX idx_expense_items_report ON expense_items(report_id);
CREATE INDEX idx_expense_items_association ON expense_items(association_id);
CREATE INDEX idx_meter_readings_report ON meter_readings(report_id);
CREATE INDEX idx_meter_readings_apartment ON meter_readings(apartment_id);
CREATE INDEX idx_meter_readings_association ON meter_readings(association_id);
CREATE INDEX idx_charges_report ON apartment_charges(report_id);
CREATE INDEX idx_charges_apartment ON apartment_charges(apartment_id);
CREATE INDEX idx_charges_association ON apartment_charges(association_id);
CREATE INDEX idx_charges_status ON apartment_charges(payment_status);
CREATE INDEX idx_payments_association ON payments(association_id);
CREATE INDEX idx_payments_apartment ON payments(apartment_id);
CREATE INDEX idx_payments_charge ON payments(apartment_charge_id);
CREATE INDEX idx_announcements_association ON announcements(association_id);
```

- [ ] **Step 3.2: Apply migration to remote Supabase**

```bash
npx supabase db push
```

Expected: Migration applied successfully. Verify in Supabase Dashboard → Table Editor — all tables visible.

- [ ] **Step 3.3: Verify tables exist**

In Supabase Dashboard → SQL Editor, run:
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected: 11 tables: `announcements`, `apartment_charges`, `apartments`, `associations`, `buildings`, `expense_items`, `meter_readings`, `monthly_reports`, `payments`, `profiles`, `resident_invites`.

- [ ] **Step 3.4: Commit**

```bash
git add supabase/migrations/20260311000001_schema.sql
git commit -m "feat: add complete database schema with all tables and indexes"
```

---

### Task 4: RLS Policies

**Files:**
- Create: `supabase/migrations/20260311000002_rls.sql`

- [ ] **Step 4.1: Create RLS migration**

Create `supabase/migrations/20260311000002_rls.sql`:

```sql
-- Enable RLS on all tables
ALTER TABLE associations ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartments ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE resident_invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meter_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE apartment_charges ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- Helper functions
CREATE OR REPLACE FUNCTION auth_association_id()
RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT (auth.jwt() ->> 'association_id')::uuid
$$;

CREATE OR REPLACE FUNCTION auth_user_role()
RETURNS text LANGUAGE sql STABLE AS $$
  SELECT auth.jwt() ->> 'user_role'
$$;

-- ASSOCIATIONS: admin sees only their own
CREATE POLICY "admin_own_association" ON associations
  FOR ALL USING (id = auth_association_id() AND auth_user_role() = 'admin');

-- BUILDINGS: admin full access within association
CREATE POLICY "admin_buildings" ON buildings
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_buildings_read" ON buildings
  FOR SELECT USING (
    association_id = auth_association_id() AND auth_user_role() = 'resident'
  );

-- APARTMENTS: admin full access; resident sees only own
CREATE POLICY "admin_apartments" ON apartments
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_own_apartment" ON apartments
  FOR SELECT USING (
    id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
  );

-- PROFILES: each user sees/edits only their own profile
CREATE POLICY "own_profile" ON profiles
  FOR ALL USING (id = auth.uid());

CREATE POLICY "admin_read_profiles" ON profiles
  FOR SELECT USING (
    association_id = auth_association_id() AND auth_user_role() = 'admin'
  );

-- RESIDENT INVITES: admin full access
CREATE POLICY "admin_invites" ON resident_invites
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

-- MONTHLY REPORTS: admin full access; resident can read published/closed
CREATE POLICY "admin_reports" ON monthly_reports
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_reports_read" ON monthly_reports
  FOR SELECT USING (
    association_id = auth_association_id()
    AND auth_user_role() = 'resident'
    AND status IN ('published', 'closed')
  );

-- EXPENSE ITEMS: admin full access; resident can read when report is published
CREATE POLICY "admin_expense_items" ON expense_items
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_expense_items_read" ON expense_items
  FOR SELECT USING (
    association_id = auth_association_id()
    AND auth_user_role() = 'resident'
    AND EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = report_id AND mr.status IN ('published', 'closed')
    )
  );

-- METER READINGS: admin full access; resident can insert/update own readings
CREATE POLICY "admin_meter_readings" ON meter_readings
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_own_meter_readings" ON meter_readings
  FOR SELECT USING (
    apartment_id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "resident_insert_meter_readings" ON meter_readings
  FOR INSERT WITH CHECK (
    apartment_id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
    AND submitted_by = 'resident'
    AND EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = report_id
        AND mr.status = 'collecting_meters'
        AND (mr.meter_deadline IS NULL OR mr.meter_deadline >= CURRENT_DATE)
    )
  );

CREATE POLICY "resident_update_meter_readings" ON meter_readings
  FOR UPDATE USING (
    apartment_id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
    AND submitted_by = 'resident'
    AND EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = report_id
        AND mr.status = 'collecting_meters'
        AND (mr.meter_deadline IS NULL OR mr.meter_deadline >= CURRENT_DATE)
    )
  );

-- APARTMENT CHARGES: admin full access; resident sees only own apartment
CREATE POLICY "admin_charges" ON apartment_charges
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_own_charges" ON apartment_charges
  FOR SELECT USING (
    apartment_id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
  );

-- PAYMENTS: admin full access; resident sees own payments
CREATE POLICY "admin_payments" ON payments
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_own_payments" ON payments
  FOR SELECT USING (
    apartment_id = (SELECT apartment_id FROM profiles WHERE id = auth.uid())
  );

-- ANNOUNCEMENTS: admin full access; resident reads own association's announcements
CREATE POLICY "admin_announcements" ON announcements
  FOR ALL USING (association_id = auth_association_id() AND auth_user_role() = 'admin');

CREATE POLICY "resident_announcements_read" ON announcements
  FOR SELECT USING (
    association_id = auth_association_id() AND auth_user_role() = 'resident'
  );
```

- [ ] **Step 4.2: Apply RLS migration**

```bash
npx supabase db push
```

Expected: Migration applied without errors.

- [ ] **Step 4.3: Verify RLS is enabled**

In Supabase Dashboard → SQL Editor:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
```

Expected: All tables show `rowsecurity = true`.

- [ ] **Step 4.4: Commit**

```bash
git add supabase/migrations/20260311000002_rls.sql
git commit -m "feat: add RLS policies for all tables with admin/resident isolation"
```

---

### Task 5: JWT Claims Hook + Profile Auto-creation

**Files:**
- Create: `supabase/migrations/20260311000003_functions.sql`

- [ ] **Step 5.1: Create functions migration**

Create `supabase/migrations/20260311000003_functions.sql`:

```sql
-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Custom JWT claims hook — adds user_role, association_id, and subscription_status to JWT.
-- This is the ONLY authoritative source of claims; user_metadata is not used for auth.
CREATE OR REPLACE FUNCTION custom_access_token_hook(event jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  claims jsonb;
  user_profile profiles%ROWTYPE;
  assoc associations%ROWTYPE;
BEGIN
  SELECT * INTO user_profile FROM profiles WHERE id = (event->>'user_id')::uuid;

  claims := event->'claims';

  IF user_profile.id IS NOT NULL THEN
    claims := jsonb_set(claims, '{user_role}', to_jsonb(user_profile.role::text));
    IF user_profile.association_id IS NOT NULL THEN
      claims := jsonb_set(claims, '{association_id}', to_jsonb(user_profile.association_id::text));
      -- Include subscription_status so middleware can enforce access without a DB query
      SELECT * INTO assoc FROM associations WHERE id = user_profile.association_id;
      IF assoc.id IS NOT NULL THEN
        claims := jsonb_set(claims, '{subscription_status}', to_jsonb(assoc.subscription_status::text));
      END IF;
    END IF;
  END IF;

  RETURN jsonb_set(event, '{claims}', claims);
END;
$$;

-- Grant necessary permissions for the hook
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT EXECUTE ON FUNCTION custom_access_token_hook TO supabase_auth_admin;
GRANT SELECT ON profiles TO supabase_auth_admin;
GRANT SELECT ON associations TO supabase_auth_admin;

-- NOTE: The pg_cron penalty job is in a SEPARATE migration (20260311000004_cron.sql).
-- That migration must be pushed AFTER pg_cron is enabled in the Supabase Dashboard (Task 10.4).
```

- [ ] **Step 5.2: Apply functions migration**

```bash
npx supabase db push
```

Expected: Migration applied without errors.

- [ ] **Step 5.3: Enable the JWT hook in Supabase Dashboard**

Go to Supabase Dashboard → Authentication → Hooks → **Custom Access Token Hook** → Enable → Select function: `custom_access_token_hook` → Save.

- [ ] **Step 5.4: Commit**

```bash
git add supabase/migrations/20260311000003_functions.sql
git commit -m "feat: add JWT claims hook and profile auto-creation trigger"
```

---

## Chunk 2: Auth Flow + Supabase Clients + Middleware

### Task 6: Supabase Client Utilities

**Files:**
- Create: `lib/supabase/client.ts`
- Create: `lib/supabase/server.ts`
- Create: `lib/utils.ts`
- Create: `types/database.ts`

- [ ] **Step 6.0: Install utility dependencies first**

```bash
npm install clsx tailwind-merge
```

Note: `shadcn/ui` may have installed these transitively, but this step ensures they're in `package.json` explicitly.

- [ ] **Step 6.1: Create browser Supabase client `lib/supabase/client.ts`**

```typescript
import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "@/types/database"

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

- [ ] **Step 6.2: Create server Supabase client `lib/supabase/server.ts`**

```typescript
import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"
import type { Database } from "@/types/database"

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll called from Server Component — safe to ignore
          }
        },
      },
    }
  )
}

export async function createServiceClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: { getAll: () => [], setAll: () => {} },
      auth: { persistSession: false },
    }
  )
}
```

- [ ] **Step 6.3: Create `lib/utils.ts`**

```typescript
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("ro-RO", {
    style: "currency",
    currency: "RON",
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date))
}
```

- [ ] **Step 6.4: Create minimal `types/database.ts`**

This is a hand-written stub. Later, replace with `npx supabase gen types typescript`.

```typescript
export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export type UserRole = "super_admin" | "admin" | "resident"
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "canceled"
export type SubscriptionPlan = "starter" | "pro"
export type ReportStatus = "draft" | "collecting_meters" | "published" | "closed"
export type DistributionMethod = "per_cota" | "per_person" | "per_apartment" | "per_consumption"
export type ConsumptionType = "apa_rece" | "apa_calda" | "gaz"
export type PaymentMethod = "online" | "cash" | "transfer"
export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded"
export type ChargePaymentStatus = "unpaid" | "partial" | "paid"

export interface Database {
  public: {
    Tables: {
      associations: {
        Row: {
          id: string
          name: string
          address: string | null
          cui: string | null
          bank_account: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_status: SubscriptionStatus
          plan: SubscriptionPlan
          stripe_connect_account_id: string | null
          stripe_connect_onboarded: boolean
          trial_ends_at: string
          canceled_at: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["associations"]["Row"], "id" | "created_at">
        Update: Partial<Database["public"]["Tables"]["associations"]["Insert"]>
      }
      profiles: {
        Row: {
          id: string
          association_id: string | null
          apartment_id: string | null
          role: UserRole
          full_name: string | null
          phone: string | null
          created_at: string
        }
        Insert: Omit<Database["public"]["Tables"]["profiles"]["Row"], "created_at">
        Update: Partial<Database["public"]["Tables"]["profiles"]["Insert"]>
      }
      apartments: {
        Row: {
          id: string
          association_id: string
          building_id: string | null
          number: string
          floor: number | null
          staircase: string | null
          surface_m2: number | null
          cota_parte: number
          persons_count: number
          owner_name: string | null
          is_vacant: boolean
        }
        Insert: Omit<Database["public"]["Tables"]["apartments"]["Row"], "id">
        Update: Partial<Database["public"]["Tables"]["apartments"]["Insert"]>
      }
    }
    Functions: {}
    Enums: {}
  }
}
```

- [ ] **Step 6.5: Commit**

```bash
git add lib/ types/
git commit -m "feat: add Supabase client utilities and database types"
```

---

### Task 7: Route Protection Middleware

**Files:**
- Create: `middleware.ts`

- [ ] **Step 7.1: Create `middleware.ts`**

```typescript
import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

const AUTH_ROUTES = ["/auth/login", "/auth/register", "/auth/accept-invite"]
const PUBLIC_ROUTES = ["/", ...AUTH_ROUTES]
const ADMIN_PREFIX = "/dashboard"
const RESIDENT_PREFIX = "/resident"
const BILLING_PATH = "/dashboard/settings/billing"

// Routes admins can access even when subscription is past_due or canceled
const BILLING_ALLOWED_PATHS = [BILLING_PATH, "/auth/login"]

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname

  // Not logged in → redirect to login (except public routes)
  if (!user && !PUBLIC_ROUTES.some(r => pathname.startsWith(r))) {
    return NextResponse.redirect(new URL("/auth/login", request.url))
  }

  if (user) {
    const jwt = await supabase.auth.getSession()
    const claims = jwt.data.session?.access_token
      ? JSON.parse(atob(jwt.data.session.access_token.split(".")[1]))
      : {}
    const role = claims.user_role as string | undefined
    const subscriptionStatus = claims.subscription_status as string | undefined

    // Admin trying to access resident portal
    if (role === "admin" && pathname.startsWith(RESIDENT_PREFIX)) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }

    // Resident trying to access admin dashboard
    if (role === "resident" && pathname.startsWith(ADMIN_PREFIX)) {
      return NextResponse.redirect(new URL("/resident", request.url))
    }

    // Subscription enforcement for admins
    if (role === "admin" && pathname.startsWith(ADMIN_PREFIX)) {
      if (
        subscriptionStatus === "canceled" &&
        !BILLING_ALLOWED_PATHS.some(p => pathname.startsWith(p))
      ) {
        // Canceled: admin can only reach billing page
        return NextResponse.redirect(new URL(BILLING_PATH, request.url))
      }
      if (
        subscriptionStatus === "past_due" &&
        !BILLING_ALLOWED_PATHS.some(p => pathname.startsWith(p))
      ) {
        // past_due: read-only enforcement is done at API route level (not middleware redirect).
        // Middleware only adds a header so server components can show a warning banner.
        supabaseResponse.headers.set("x-subscription-warning", "past_due")
      }
    }

    // Logged in user hitting auth pages → redirect to their home
    if (AUTH_ROUTES.some(r => pathname.startsWith(r))) {
      if (role === "admin") return NextResponse.redirect(new URL("/dashboard", request.url))
      if (role === "resident") return NextResponse.redirect(new URL("/resident", request.url))
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
```

- [ ] **Step 7.2: Verify middleware doesn't break the dev server**

```bash
npm run dev
```

Navigate to http://localhost:3000/dashboard — expected: redirect to `/auth/login`.
Navigate to http://localhost:3000 — expected: landing page loads normally.

- [ ] **Step 7.3: Commit**

```bash
git add middleware.ts
git commit -m "feat: add route protection middleware with role-based redirects"
```

---

### Task 8: Authentication Pages

**Files:**
- Create: `app/auth/layout.tsx`
- Create: `app/auth/login/page.tsx`
- Create: `app/auth/register/page.tsx`
- Create: `app/auth/accept-invite/page.tsx`
- Create: `app/api/auth/register/route.ts`

Note: Using `app/auth/` (not a route group) so routes are served at `/auth/login`, `/auth/register`, `/auth/accept-invite` — matching the spec URL table and middleware `AUTH_ROUTES` list.

- [ ] **Step 8.1: Create auth layout `app/auth/layout.tsx`**

```typescript
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-black tracking-tight">
            <span className="bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              BlocApp
            </span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Administrare asociații de proprietari
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}
```

- [ ] **Step 8.2: Create login page `app/auth/login/page.tsx`**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError("Email sau parolă incorecte.")
      setLoading(false)
      return
    }

    // Parse JWT to determine redirect
    const token = data.session?.access_token
    if (token) {
      const claims = JSON.parse(atob(token.split(".")[1]))
      if (claims.user_role === "admin") {
        router.push("/dashboard")
      } else if (claims.user_role === "resident") {
        router.push("/resident")
      } else {
        router.push("/")
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Intră în cont</CardTitle>
        <CardDescription>Folosește emailul și parola asociației tale.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="admin@asociatia.ro"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Se procesează..." : "Intră în cont"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Nu ai cont?{" "}
          <Link href="/auth/register" className="text-primary hover:underline">
            Înregistrează asociația
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8.3: Create registration page `app/auth/register/page.tsx`**

```typescript
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    associationName: "",
    associationAddress: "",
  })
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm(prev => ({ ...prev, [field]: e.target.value }))
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    // 1. Create auth user
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    })

    if (signUpError || !authData.user) {
      setError(signUpError?.message ?? "Eroare la înregistrare.")
      setLoading(false)
      return
    }

    // 2. Create association via API route (needs service role to set profile role)
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: authData.user.id,
        fullName: form.fullName,
        associationName: form.associationName,
        associationAddress: form.associationAddress,
      }),
    })

    if (!res.ok) {
      const { message } = await res.json()
      setError(message ?? "Eroare la crearea asociației.")
      setLoading(false)
      return
    }

    // 3. Refresh session to get updated JWT claims
    await supabase.auth.refreshSession()
    router.push("/dashboard")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Înregistrează asociația</CardTitle>
        <CardDescription>14 zile gratuit, fără card bancar.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Numele tău</Label>
            <Input id="fullName" value={form.fullName} onChange={update("fullName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={form.email} onChange={update("email")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">Parolă</Label>
            <Input id="password" type="password" value={form.password} onChange={update("password")} minLength={8} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assocName">Numele asociației</Label>
            <Input id="assocName" placeholder="Asociația de Proprietari Bloc 12" value={form.associationName} onChange={update("associationName")} required />
          </div>
          <div className="space-y-2">
            <Label htmlFor="assocAddress">Adresa</Label>
            <Input id="assocAddress" placeholder="Str. Exemplu nr. 12, București" value={form.associationAddress} onChange={update("associationAddress")} />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Se procesează..." : "Creează contul"}
          </Button>
        </form>
        <p className="mt-4 text-center text-sm text-muted-foreground">
          Ai deja cont?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Intră în cont
          </Link>
        </p>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 8.4: Create API route for registration `app/api/auth/register/route.ts`**

```typescript
import { NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase/server"

export async function POST(request: Request) {
  const { userId, fullName, associationName, associationAddress } = await request.json()

  if (!userId || !associationName) {
    return NextResponse.json({ message: "Date lipsă." }, { status: 400 })
  }

  const supabase = await createServiceClient()

  // Create association
  const { data: association, error: assocError } = await supabase
    .from("associations")
    .insert({ name: associationName, address: associationAddress ?? null })
    .select("id")
    .single()

  if (assocError || !association) {
    return NextResponse.json({ message: "Eroare la crearea asociației." }, { status: 500 })
  }

  // Update profile with role=admin and association_id
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      role: "admin",
      full_name: fullName,
      association_id: association.id,
    })
    .eq("id", userId)

  if (profileError) {
    return NextResponse.json({ message: "Eroare la configurarea profilului." }, { status: 500 })
  }

  return NextResponse.json({ associationId: association.id })
}
```

- [ ] **Step 8.5: Create accept-invite placeholder `app/auth/accept-invite/page.tsx`**

```typescript
// Full implementation in Plan 2 (Admin Core — resident invite flow)
export default function AcceptInvitePage() {
  return (
    <div className="text-center text-muted-foreground">
      <p>Se verifică invitația...</p>
    </div>
  )
}
```

- [ ] **Step 8.6: Test registration flow manually**

```bash
npm run dev
```

1. Go to http://localhost:3000/auth/register
2. Fill in all fields → Submit
3. Expected: redirect to `/dashboard` (placeholder page)
4. Check Supabase Dashboard → Authentication → Users: user exists
5. Check `associations` table: one row with your association name
6. Check `profiles` table: row with `role = 'admin'` and `association_id` set

- [ ] **Step 8.7: Commit**

```bash
git add app/ lib/ types/
git commit -m "feat: add auth pages (login, register) with association creation flow"
```

---

### Task 9: Shell Layouts (Admin + Resident)

**Files:**
- Create: `components/admin-nav.tsx`
- Create: `components/resident-nav.tsx`
- Create: `app/(dashboard)/dashboard/layout.tsx`
- Create: `app/(dashboard)/dashboard/page.tsx`
- Create: `app/(resident)/resident/layout.tsx`
- Create: `app/(resident)/resident/page.tsx`

- [ ] **Step 9.1: Create admin nav component `components/admin-nav.tsx`**

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: "⬛" },
  { href: "/dashboard/reports", label: "Liste întreținere", icon: "📋" },
  { href: "/dashboard/payments", label: "Plăți", icon: "💳" },
  { href: "/dashboard/apartments", label: "Apartamente", icon: "🚪" },
  { href: "/dashboard/meters", label: "Apometre", icon: "🔢" },
  { href: "/dashboard/announcements", label: "Anunțuri", icon: "📢" },
  { href: "/dashboard/settings", label: "Setări", icon: "⚙️" },
]

export function AdminNav({ associationName }: { associationName: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <aside className="w-52 bg-card border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <div className="text-xs font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent mb-1">
          BlocApp
        </div>
        <div className="text-xs text-muted-foreground truncate">{associationName}</div>
      </div>
      <nav className="flex-1 py-2">
        {NAV_ITEMS.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm border-l-2 transition-colors",
              pathname === item.href
                ? "text-primary border-primary bg-primary/10"
                : "text-muted-foreground border-transparent hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className="text-base">{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="p-4 border-t border-border">
        <button
          onClick={handleSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Deconectare
        </button>
      </div>
    </aside>
  )
}
```

- [ ] **Step 9.2: Create resident nav component `components/resident-nav.tsx`**

```typescript
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

const NAV_ITEMS = [
  { href: "/resident", label: "Acasă" },
  { href: "/resident/payments", label: "Plăți" },
  { href: "/resident/announcements", label: "Anunțuri" },
  { href: "/resident/meters", label: "Apometre" },
]

export function ResidentNav({ apartmentNumber }: { apartmentNumber: string }) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push("/auth/login")
  }

  return (
    <header className="bg-card border-b border-border px-4 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <span className="text-sm font-black bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
          BlocApp
        </span>
        <nav className="flex gap-1">
          {NAV_ITEMS.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-md text-sm transition-colors",
                pathname === item.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">Ap. {apartmentNumber}</span>
        <button
          onClick={handleSignOut}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Deconectare
        </button>
      </div>
    </header>
  )
}
```

- [ ] **Step 9.3: Create admin dashboard layout `app/(dashboard)/dashboard/layout.tsx`**

```typescript
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AdminNav } from "@/components/admin-nav"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("association_id, role")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "admin") redirect("/auth/login")

  const { data: association } = await supabase
    .from("associations")
    .select("name")
    .eq("id", profile.association_id!)
    .single()

  return (
    <div className="flex h-screen bg-background">
      <AdminNav associationName={association?.name ?? "Asociația mea"} />
      <main className="flex-1 overflow-auto p-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 9.4: Create admin dashboard placeholder `app/(dashboard)/dashboard/page.tsx`**

```typescript
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-foreground mb-1">Dashboard</h1>
      <p className="text-muted-foreground text-sm">
        Statistici și rapoarte recente — implementate în Plan 2.
      </p>
    </div>
  )
}
```

- [ ] **Step 9.5: Create resident layout `app/(resident)/resident/layout.tsx`**

```typescript
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ResidentNav } from "@/components/resident-nav"

export default async function ResidentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect("/auth/login")

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, apartment_id")
    .eq("id", user.id)
    .single()

  if (!profile || profile.role !== "resident") redirect("/auth/login")

  let apartmentNumber = "–"
  if (profile.apartment_id) {
    const { data: apt } = await supabase
      .from("apartments")
      .select("number")
      .eq("id", profile.apartment_id)
      .single()
    if (apt) apartmentNumber = apt.number
  }

  return (
    <div className="min-h-screen bg-background">
      <ResidentNav apartmentNumber={apartmentNumber} />
      <main className="max-w-lg mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
```

- [ ] **Step 9.6: Create resident placeholder `app/(resident)/resident/page.tsx`**

```typescript
export default function ResidentPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-muted-foreground">Portal locatar — implementat în Plan 5.</p>
    </div>
  )
}
```

- [ ] **Step 9.7: Test the full auth flow**

```bash
npm run dev
```

1. Go to `/auth/login` → login with account created in Task 8 step 8.6
2. Expected: redirect to `/dashboard` with admin sidebar visible
3. Click "Deconectare" → expected: redirect to `/auth/login`
4. Go directly to `/dashboard` without logging in → expected: redirect to `/auth/login`

- [ ] **Step 9.8: Commit**

```bash
git add app/ components/
git commit -m "feat: add admin and resident shell layouts with navigation"
```

---

### Task 10: Supabase Types Generation + Final Verification

**Files:**
- Modify: `types/database.ts` (replace stub with generated types)

- [ ] **Step 10.1: Generate TypeScript types from Supabase**

```bash
npx supabase gen types typescript --linked > types/database.ts
```

Expected: `types/database.ts` now contains fully generated types for all tables.

- [ ] **Step 10.2: Fix any TypeScript errors**

```bash
npm run build
```

Fix any type errors that appear. Common fix: update imports that referenced the old stub types.

- [ ] **Step 10.3: Enable Realtime for `apartment_charges` table**

In Supabase Dashboard → Database → Replication → Select `apartment_charges` → Toggle on for INSERT and UPDATE events.

- [ ] **Step 10.4: Enable pg_cron extension**

In Supabase Dashboard → Database → Extensions → Search "pg_cron" → Enable.

Wait for the extension to activate (usually instant).

- [ ] **Step 10.5: Push the cron migration**

Create `supabase/migrations/20260311000004_cron.sql`:

```sql
-- Penalty accrual cron job — requires pg_cron extension (enabled in Task 10.4)
SELECT cron.schedule(
  'accrue-penalties',
  '0 6 * * *',
  $$
  UPDATE apartment_charges ac
  SET
    penalties = penalties + ROUND(((total_due - amount_paid) * (
      SELECT penalty_rate_per_day FROM monthly_reports WHERE id = ac.report_id
    ))::numeric, 2),
    total_due = total_due + ROUND(((total_due - amount_paid) * (
      SELECT penalty_rate_per_day FROM monthly_reports WHERE id = ac.report_id
    ))::numeric, 2),
    last_penalty_date = CURRENT_DATE
  WHERE
    payment_status != 'paid'
    AND penalties_waived = false
    AND (last_penalty_date IS NULL OR last_penalty_date < CURRENT_DATE)
    AND EXISTS (
      SELECT 1 FROM monthly_reports mr
      WHERE mr.id = ac.report_id
        AND mr.status = 'published'
        AND mr.due_date IS NOT NULL
        AND mr.due_date < CURRENT_DATE
    );
  $$
);
```

Then push:

```bash
npx supabase db push
```

Expected: Migration applied without errors.

Verify in Supabase Dashboard → Database → Cron Jobs: `accrue-penalties` job listed with `0 6 * * *` schedule.

- [ ] **Step 10.7: Final commit**

```bash
git add types/database.ts supabase/migrations/20260311000004_cron.sql
git commit -m "feat: generate DB types, enable realtime + pg_cron, add penalty cron job"
```

---

## Plan 1 Complete

Foundation is done. Next: **Plan 2 — Admin Core** (association settings, apartment management, CSV import, resident invitations).
