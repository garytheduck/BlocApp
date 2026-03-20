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
