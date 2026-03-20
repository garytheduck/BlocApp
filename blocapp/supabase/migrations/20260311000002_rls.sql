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
