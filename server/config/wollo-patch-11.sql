-- =====================================================================
-- PATCH 11: staff invites (admin adds an instructor or coordinator by email)
--           + audit entry when an admin sends a password-reset email
-- Run once, after patches 1-10. Safe to run again.
--
-- How it works (no secret key, no extra server):
--   1. The admin types an email and a role. If that person already has an
--      account, they are promoted at once. If not, an invite is stored.
--   2. The person signs up on the normal register page with that email and
--      confirms the email address.
--   3. After their first login the app calls claim_staff_invite(). If the email
--      is CONFIRMED and the invite is valid, the role is applied.
-- Invites are limited to instructor and coordinator. Admins are promoted with
-- the role dropdown in the users table, never by invite.
-- =====================================================================
BEGIN;

-- 0. The profile guard must let claim_staff_invite() promote a student to staff.
--    The claim function sets a transaction-local flag naming the user; the guard
--    accepts it only for student -> instructor/coordinator on that same user.
CREATE OR REPLACE FUNCTION guard_profile() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND app_role() IS DISTINCT FROM 'admin'
     AND (NEW.role <> OLD.role OR NEW.status <> OLD.status OR NEW.email <> OLD.email OR NEW.id <> OLD.id) THEN
    IF NOT coalesce(current_setting('wollo.claim_uid', true) = OLD.id::text
            AND OLD.role = 'student' AND NEW.role IN ('instructor','coordinator')
            AND NEW.status = OLD.status AND NEW.email = OLD.email AND NEW.id = OLD.id, false) THEN
      RAISE EXCEPTION 'role, status and email can only be changed by an admin';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TABLE IF NOT EXISTS staff_invites (
  email       citext PRIMARY KEY,
  role        user_role   NOT NULL CHECK (role IN ('instructor','coordinator')),
  full_name   text        NOT NULL DEFAULT '',
  invited_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '14 days',
  claimed_at  timestamptz,
  claimed_by  uuid        REFERENCES profiles(id) ON DELETE SET NULL
);
ALTER TABLE staff_invites ENABLE ROW LEVEL SECURITY;      -- no policies: only the functions below can touch it
REVOKE ALL ON staff_invites FROM PUBLIC, anon, authenticated;

-- 1. Admin: invite (or promote) a staff member
CREATE OR REPLACE FUNCTION admin_invite_staff(p_email text, p_role user_role, p_name text DEFAULT '')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_email citext := lower(btrim(coalesce(p_email, '')));
  v_name  text   := btrim(coalesce(p_name, ''));
  v_p     profiles%ROWTYPE;
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  IF v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN RAISE EXCEPTION 'enter a valid email address'; END IF;
  IF p_role NOT IN ('instructor','coordinator') THEN
    RAISE EXCEPTION 'invites are for instructors and coordinators only'; END IF;
  IF length(v_name) > 120 THEN RAISE EXCEPTION 'name is too long'; END IF;

  SELECT * INTO v_p FROM profiles WHERE email = v_email;
  IF FOUND THEN
    IF v_p.role <> 'student' THEN
      RAISE EXCEPTION 'this person is already %. Change the role in the users table.', v_p.role; END IF;
    UPDATE profiles SET role = p_role WHERE id = v_p.id;
    INSERT INTO audit_log(actor_id, action, target, detail)
    VALUES (auth.uid(), 'user.set', 'user:' || v_p.id, jsonb_build_object('role', p_role, 'via', 'invite'));
    RETURN jsonb_build_object('result', 'promoted', 'email', v_email, 'role', p_role);
  END IF;

  INSERT INTO staff_invites(email, role, full_name, invited_by, created_at, expires_at, claimed_at, claimed_by)
  VALUES (v_email, p_role, v_name, auth.uid(), now(), now() + interval '14 days', NULL, NULL)
  ON CONFLICT (email) DO UPDATE
    SET role = EXCLUDED.role, full_name = EXCLUDED.full_name, invited_by = EXCLUDED.invited_by,
        created_at = now(), expires_at = now() + interval '14 days', claimed_at = NULL, claimed_by = NULL;
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'staff.invite', 'invite:' || v_email, jsonb_build_object('role', p_role));
  RETURN jsonb_build_object('result', 'invited', 'email', v_email, 'role', p_role);
END $$;

-- 2. Admin: list pending invites
CREATE OR REPLACE FUNCTION admin_list_invites()
RETURNS TABLE (email text, role user_role, full_name text, created_at timestamptz, expires_at timestamptz, expired boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  RETURN QUERY
  SELECT i.email::text, i.role, i.full_name, i.created_at, i.expires_at, i.expires_at < now()
  FROM staff_invites i WHERE i.claimed_at IS NULL
  ORDER BY i.created_at DESC;
END $$;

-- 3. Admin: cancel a pending invite
CREATE OR REPLACE FUNCTION admin_cancel_invite(p_email text) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_email citext := lower(btrim(coalesce(p_email, '')));
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  DELETE FROM staff_invites WHERE email = v_email AND claimed_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'no pending invite for that email'; END IF;
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'staff.invite_cancel', 'invite:' || v_email, '{}'::jsonb);
END $$;

-- 4. Signed-in user: claim an invite for my own confirmed email (called after login)
--    Returns the new role, or NULL when there is nothing to claim.
CREATE OR REPLACE FUNCTION claim_staff_invite() RETURNS user_role
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_conf  timestamptz;
  v_inv   staff_invites%ROWTYPE;
  v_p     profiles%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RETURN NULL; END IF;
  SELECT * INTO v_p FROM profiles WHERE id = v_uid;
  IF NOT FOUND OR v_p.status <> 'active' OR v_p.role <> 'student' THEN RETURN NULL; END IF;

  SELECT email_confirmed_at INTO v_conf FROM auth.users WHERE id = v_uid;
  IF v_conf IS NULL THEN RETURN NULL; END IF;                       -- email not confirmed: never claim

  SELECT * INTO v_inv FROM staff_invites
  WHERE email = v_p.email AND claimed_at IS NULL AND expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RETURN NULL; END IF;

  PERFORM set_config('wollo.claim_uid', v_uid::text, true);
  UPDATE profiles SET role = v_inv.role,
         full_name = CASE WHEN btrim(full_name) = '' THEN v_inv.full_name ELSE full_name END
  WHERE id = v_uid;
  PERFORM set_config('wollo.claim_uid', '', true);
  UPDATE staff_invites SET claimed_at = now(), claimed_by = v_uid WHERE email = v_inv.email;
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (v_uid, 'staff.invite_claimed', 'user:' || v_uid, jsonb_build_object('role', v_inv.role));
  RETURN v_inv.role;
END $$;

-- 5. Admin: record that a password-reset email was sent to a user
--    (the email itself is sent by Supabase Auth from the browser)
CREATE OR REPLACE FUNCTION admin_log_password_reset(p_user uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF app_role() IS DISTINCT FROM 'admin' THEN RAISE EXCEPTION 'admins only'; END IF;
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user) THEN RAISE EXCEPTION 'user not found'; END IF;
  INSERT INTO audit_log(actor_id, action, target, detail)
  VALUES (auth.uid(), 'user.password_reset_sent', 'user:' || p_user, '{}'::jsonb);
END $$;

REVOKE EXECUTE ON FUNCTION admin_invite_staff, admin_list_invites, admin_cancel_invite,
                           claim_staff_invite, admin_log_password_reset FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION admin_invite_staff, admin_list_invites, admin_cancel_invite,
                           claim_staff_invite, admin_log_password_reset TO authenticated;

COMMIT;
