-- No extensions needed — using gen_random_uuid() (built into PostgreSQL 13+)

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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  association_id uuid NOT NULL REFERENCES associations(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text,
  floors int,
  staircase_count int
);

-- APARTMENTS
CREATE TABLE apartments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
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
