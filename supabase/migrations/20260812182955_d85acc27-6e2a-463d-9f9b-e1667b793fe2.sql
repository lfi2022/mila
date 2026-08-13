-- ============ ENUMS ============
CREATE TYPE public.list_type AS ENUM ('BIRTH','BIRTHDAY','CHRISTENING','WEDDING','CHRISTMAS','OTHER');
CREATE TYPE public.list_visibility AS ENUM ('PUBLIC','UNLISTED','PROTECTED');
CREATE TYPE public.list_status AS ENUM ('ACTIVE','ARCHIVED','SUSPENDED');
CREATE TYPE public.item_status AS ENUM ('AVAILABLE','RESERVED','PURCHASED');
CREATE TYPE public.item_kind AS ENUM ('LINK','MANUAL','CONTRIBUTION');
CREATE TYPE public.member_role AS ENUM ('OWNER','CO_OWNER','EDITOR');
CREATE TYPE public.app_role AS ENUM ('USER','MODERATOR','ADMIN','SUPER_ADMIN');
CREATE TYPE public.reservation_status AS ENUM ('RESERVED','PURCHASED','CANCELLED');
CREATE TYPE public.report_status AS ENUM ('OPEN','REVIEWING','RESOLVED','DISMISSED');

-- ============ REGISTRIES (generic lists) ============
ALTER TABLE public.registries
  ADD COLUMN type public.list_type NOT NULL DEFAULT 'BIRTH',
  ADD COLUMN description TEXT,
  ADD COLUMN cover_image_url TEXT,
  ADD COLUMN visibility public.list_visibility NOT NULL DEFAULT 'UNLISTED',
  ADD COLUMN access_code_hash TEXT,
  ADD COLUMN surprise_mode BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN surprises_revealed_at TIMESTAMPTZ,
  ADD COLUMN allow_indexing BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN status public.list_status NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN is_demo BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN view_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.registries SET visibility = CASE WHEN is_public THEN 'PUBLIC'::public.list_visibility ELSE 'UNLISTED'::public.list_visibility END;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL DEFAULT 'USER',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;

CREATE OR REPLACE FUNCTION public.is_staff(_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('MODERATOR','ADMIN','SUPER_ADMIN'));
$$;

CREATE POLICY "own roles select" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- ============ LIST MEMBERS ============
CREATE TABLE public.list_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES public.registries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.member_role NOT NULL DEFAULT 'EDITOR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (registry_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.list_members TO authenticated;
GRANT ALL ON public.list_members TO service_role;
ALTER TABLE public.list_members ENABLE ROW LEVEL SECURITY;

INSERT INTO public.list_members (registry_id, user_id, role)
SELECT id, owner_id, 'OWNER' FROM public.registries
ON CONFLICT DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_list_member(_registry_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.list_members WHERE registry_id = _registry_id AND user_id = _user_id);
$$;

CREATE OR REPLACE FUNCTION public.is_list_owner(_registry_id UUID, _user_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.list_members WHERE registry_id = _registry_id AND user_id = _user_id AND role IN ('OWNER','CO_OWNER'));
$$;

CREATE POLICY "members read own lists members" ON public.list_members FOR SELECT TO authenticated
  USING (public.is_list_member(registry_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "owners manage members" ON public.list_members FOR DELETE TO authenticated
  USING (public.is_list_owner(registry_id, auth.uid()) AND role <> 'OWNER');
CREATE POLICY "owners update members" ON public.list_members FOR UPDATE TO authenticated
  USING (public.is_list_owner(registry_id, auth.uid())) WITH CHECK (public.is_list_owner(registry_id, auth.uid()));

CREATE OR REPLACE FUNCTION public.add_owner_member()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.list_members (registry_id, user_id, role)
  VALUES (NEW.id, NEW.owner_id, 'OWNER') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER registries_add_owner AFTER INSERT ON public.registries
FOR EACH ROW EXECUTE FUNCTION public.add_owner_member();

-- ============ LIST INVITATIONS ============
CREATE TABLE public.list_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES public.registries(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role public.member_role NOT NULL DEFAULT 'CO_OWNER',
  token_hash TEXT NOT NULL UNIQUE,
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '14 days',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.list_invitations TO authenticated;
GRANT ALL ON public.list_invitations TO service_role;
ALTER TABLE public.list_invitations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owners read invitations" ON public.list_invitations FOR SELECT TO authenticated
  USING (public.is_list_owner(registry_id, auth.uid()));
CREATE POLICY "owners create invitations" ON public.list_invitations FOR INSERT TO authenticated
  WITH CHECK (public.is_list_owner(registry_id, auth.uid()) AND invited_by = auth.uid());
CREATE POLICY "owners delete invitations" ON public.list_invitations FOR DELETE TO authenticated
  USING (public.is_list_owner(registry_id, auth.uid()));

-- ============ MERCHANTS ============
CREATE TABLE public.merchants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domains TEXT[] NOT NULL DEFAULT '{}',
  logo_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  affiliate_enabled BOOLEAN NOT NULL DEFAULT false,
  affiliate_network TEXT,
  affiliate_id TEXT,
  affiliate_template TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merchants TO authenticated;
GRANT SELECT ON public.merchants TO anon;
GRANT ALL ON public.merchants TO service_role;
ALTER TABLE public.merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public reads enabled merchants" ON public.merchants FOR SELECT TO anon, authenticated USING (enabled = true);
CREATE TRIGGER merchants_updated_at BEFORE UPDATE ON public.merchants FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.merchants (name, domains) VALUES
  ('Amazon', ARRAY['amazon.fr','amazon.be','amazon.com','amazon.de','amazon.nl']),
  ('IKEA', ARRAY['ikea.com']),
  ('Dreambaby', ARRAY['dreambaby.be']),
  ('Vertbaudet', ARRAY['vertbaudet.fr','vertbaudet.be']),
  ('Zalando', ARRAY['zalando.be','zalando.fr']),
  ('Baby-Walz', ARRAY['baby-walz.be','baby-walz.de']),
  ('Bol.com', ARRAY['bol.com']),
  ('Decathlon', ARRAY['decathlon.be','decathlon.fr']);

-- ============ ITEMS ============
ALTER TABLE public.items
  ADD COLUMN status public.item_status NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN kind public.item_kind NOT NULL DEFAULT 'MANUAL',
  ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR',
  ADD COLUMN merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  ADD COLUMN hidden_by_moderator BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN public_token TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  ADD COLUMN contribution_target NUMERIC,
  ADD COLUMN contribution_collected NUMERIC NOT NULL DEFAULT 0;
CREATE UNIQUE INDEX items_public_token_key ON public.items (public_token);
UPDATE public.items SET kind = 'LINK' WHERE url IS NOT NULL;
UPDATE public.items SET status = 'RESERVED' WHERE reserved_qty >= quantity;

-- ============ CLICK EVENTS ============
CREATE TABLE public.click_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  registry_id UUID REFERENCES public.registries(id) ON DELETE CASCADE,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  click_type TEXT NOT NULL DEFAULT 'MERCHANT',
  affiliate BOOLEAN NOT NULL DEFAULT false,
  country TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.click_events TO authenticated;
GRANT ALL ON public.click_events TO service_role;
ALTER TABLE public.click_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own list clicks" ON public.click_events FOR SELECT TO authenticated
  USING (registry_id IS NOT NULL AND (public.is_list_member(registry_id, auth.uid()) OR public.is_staff(auth.uid())));

-- ============ RESERVATIONS ============
ALTER TABLE public.reservations
  ADD COLUMN status public.reservation_status NOT NULL DEFAULT 'RESERVED',
  ADD COLUMN token_hash TEXT,
  ADD COLUMN token_expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '365 days',
  ADD COLUMN purchased_at TIMESTAMPTZ,
  ADD COLUMN cancelled_at TIMESTAMPTZ,
  ADD COLUMN revealed_at TIMESTAMPTZ;
CREATE UNIQUE INDEX reservations_token_hash_key ON public.reservations (token_hash);

-- Remove the racy anon insert path: reservations now go through a locking function only.
DROP POLICY IF EXISTS "guests can reserve available items" ON public.reservations;

-- ============ REPORTS & AUDIT ============
CREATE TABLE public.reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type TEXT NOT NULL,
  target_id UUID NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status public.report_status NOT NULL DEFAULT 'OPEN',
  admin_notes TEXT,
  reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read reports" ON public.reports FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "staff update reports" ON public.reports FOR UPDATE TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));
CREATE TRIGGER reports_updated_at BEFORE UPDATE ON public.reports FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id UUID,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT ALL ON public.admin_audit_log TO service_role;
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read audit" ON public.admin_audit_log FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ FREEMIUM ============
CREATE TABLE public.feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.feature_flags TO anon, authenticated;
GRANT ALL ON public.feature_flags TO service_role;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "everyone reads flags" ON public.feature_flags FOR SELECT TO anon, authenticated USING (true);
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('premium_paywall', false, 'Restreint les fonctionnalités premium'),
  ('contributions', false, 'Cagnottes et participations financières'),
  ('other_list_types', false, 'Types de listes autres que naissance'),
  ('editorial_seo', false, 'Contenu éditorial / guides');

CREATE TABLE public.list_entitlements (
  registry_id UUID PRIMARY KEY REFERENCES public.registries(id) ON DELETE CASCADE,
  plan TEXT NOT NULL DEFAULT 'FREE',
  features JSONB NOT NULL DEFAULT '{}'::jsonb,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.list_entitlements TO authenticated;
GRANT ALL ON public.list_entitlements TO service_role;
ALTER TABLE public.list_entitlements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read entitlements" ON public.list_entitlements FOR SELECT TO authenticated
  USING (public.is_list_member(registry_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE TRIGGER list_entitlements_updated_at BEFORE UPDATE ON public.list_entitlements FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.contribution_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES public.registries(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.items(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_amount NUMERIC,
  collected_amount NUMERIC NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  provider TEXT,
  provider_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contribution_goals TO authenticated;
GRANT ALL ON public.contribution_goals TO service_role;
ALTER TABLE public.contribution_goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members manage goals" ON public.contribution_goals FOR ALL TO authenticated
  USING (public.is_list_member(registry_id, auth.uid())) WITH CHECK (public.is_list_member(registry_id, auth.uid()));
CREATE TRIGGER contribution_goals_updated_at BEFORE UPDATE ON public.contribution_goals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ RLS: membership-based access ============
DROP POLICY IF EXISTS "owner manages registries" ON public.registries;
DROP POLICY IF EXISTS "public can read published registries" ON public.registries;
CREATE POLICY "members read lists" ON public.registries FOR SELECT TO authenticated
  USING (public.is_list_member(id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE POLICY "authenticated create lists" ON public.registries FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "members update lists" ON public.registries FOR UPDATE TO authenticated
  USING (public.is_list_member(id, auth.uid())) WITH CHECK (public.is_list_member(id, auth.uid()));
CREATE POLICY "owners delete lists" ON public.registries FOR DELETE TO authenticated
  USING (public.is_list_owner(id, auth.uid()));
CREATE POLICY "public reads shareable lists" ON public.registries FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE' AND visibility IN ('PUBLIC','UNLISTED','PROTECTED'));

DROP POLICY IF EXISTS "owner manages items" ON public.items;
DROP POLICY IF EXISTS "public reads available items" ON public.items;
CREATE POLICY "members manage items" ON public.items FOR ALL TO authenticated
  USING (public.is_list_member(registry_id, auth.uid()))
  WITH CHECK (public.is_list_member(registry_id, auth.uid()));
CREATE POLICY "public reads available items" ON public.items FOR SELECT TO anon, authenticated
  USING (
    hidden_by_moderator = false
    AND reserved_qty < quantity
    AND EXISTS (SELECT 1 FROM public.registries r WHERE r.id = items.registry_id AND r.status = 'ACTIVE' AND r.visibility IN ('PUBLIC','UNLISTED'))
  );

DROP POLICY IF EXISTS "owner reads reservations" ON public.reservations;
DROP POLICY IF EXISTS "owner deletes reservations" ON public.reservations;
CREATE POLICY "members read reservations" ON public.reservations FOR SELECT TO authenticated
  USING (public.is_list_member(registry_id, auth.uid()));
CREATE POLICY "members delete reservations" ON public.reservations FOR DELETE TO authenticated
  USING (public.is_list_member(registry_id, auth.uid()));

DROP POLICY IF EXISTS "own profile update" ON public.profiles;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ ITEM STATUS SYNC + NOTIFICATIONS ============
CREATE OR REPLACE FUNCTION public.handle_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item RECORD; v_reg RECORD; m RECORD;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.items SET reserved_qty = reserved_qty + NEW.quantity WHERE id = NEW.item_id
      RETURNING * INTO v_item;
    UPDATE public.items SET status = CASE WHEN reserved_qty >= quantity THEN 'RESERVED'::public.item_status ELSE 'AVAILABLE'::public.item_status END
      WHERE id = NEW.item_id AND status <> 'PURCHASED';
    SELECT * INTO v_reg FROM public.registries WHERE id = NEW.registry_id;
    FOR m IN SELECT user_id FROM public.list_members WHERE registry_id = NEW.registry_id LOOP
      INSERT INTO public.notifications (user_id, registry_id, title, body)
      VALUES (
        m.user_id, NEW.registry_id,
        CASE WHEN v_reg.surprise_mode THEN 'Un cadeau vient de trouver quelqu''un 🎁'
             ELSE NEW.guest_name || ' a réservé « ' || v_item.title || ' »' END,
        CASE WHEN v_reg.surprise_mode THEN 'Mode surprise activé : les détails restent cachés.'
             ELSE COALESCE(NEW.message, 'Aucun message laissé.') END
      );
    END LOOP;
    RETURN NEW;
  ELSE
    UPDATE public.items SET reserved_qty = GREATEST(reserved_qty - OLD.quantity, 0) WHERE id = OLD.item_id;
    UPDATE public.items SET status = CASE WHEN reserved_qty >= quantity THEN 'RESERVED'::public.item_status ELSE 'AVAILABLE'::public.item_status END
      WHERE id = OLD.item_id AND status <> 'PURCHASED';
    RETURN OLD;
  END IF;
END; $$;

-- ============ ATOMIC RESERVATION ============
CREATE OR REPLACE FUNCTION public.reserve_item(
  _item_id UUID,
  _guest_name TEXT,
  _guest_email TEXT,
  _message TEXT,
  _quantity INTEGER DEFAULT 1,
  _intent TEXT DEFAULT 'reserve'
)
RETURNS TABLE (reservation_id UUID, token TEXT)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items; v_reg public.registries; v_token TEXT; v_id UUID;
BEGIN
  IF _quantity IS NULL OR _quantity < 1 OR _quantity > 20 THEN
    RAISE EXCEPTION 'invalid_quantity';
  END IF;
  IF _guest_name IS NULL OR char_length(btrim(_guest_name)) < 1 OR char_length(_guest_name) > 100 THEN
    RAISE EXCEPTION 'invalid_name';
  END IF;

  SELECT * INTO v_item FROM public.items WHERE id = _item_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'item_not_found'; END IF;

  SELECT * INTO v_reg FROM public.registries WHERE id = v_item.registry_id;
  IF v_reg.status <> 'ACTIVE' THEN RAISE EXCEPTION 'list_unavailable'; END IF;
  IF v_item.hidden_by_moderator THEN RAISE EXCEPTION 'item_unavailable'; END IF;
  IF v_item.status = 'PURCHASED' THEN RAISE EXCEPTION 'already_taken'; END IF;
  IF v_item.reserved_qty + _quantity > v_item.quantity THEN RAISE EXCEPTION 'already_taken'; END IF;

  v_token := replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.reservations (item_id, registry_id, guest_name, guest_email, message, quantity, intent, token_hash, user_id)
  VALUES (_item_id, v_item.registry_id, btrim(_guest_name), NULLIF(btrim(COALESCE(_guest_email,'')),''), NULLIF(btrim(COALESCE(_message,'')),''), _quantity, COALESCE(_intent,'reserve'),
          encode(sha256(v_token::bytea), 'hex'), auth.uid())
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_token;
END; $$;
REVOKE ALL ON FUNCTION public.reserve_item(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_item(UUID, TEXT, TEXT, TEXT, INTEGER, TEXT) TO anon, authenticated, service_role;

-- ============ GUEST RESERVATION MANAGEMENT BY TOKEN ============
CREATE OR REPLACE FUNCTION public.get_reservation_by_token(_token TEXT)
RETURNS TABLE (
  id UUID, guest_name TEXT, guest_email TEXT, message TEXT, quantity INTEGER,
  status public.reservation_status, created_at TIMESTAMPTZ, purchased_at TIMESTAMPTZ,
  item_title TEXT, item_image_url TEXT, item_url TEXT, item_price NUMERIC, item_currency TEXT,
  registry_title TEXT, registry_slug TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.guest_name, r.guest_email, r.message, r.quantity, r.status, r.created_at, r.purchased_at,
         i.title, i.image_url, i.url, i.price, i.currency, g.title, g.slug
  FROM public.reservations r
  JOIN public.items i ON i.id = r.item_id
  JOIN public.registries g ON g.id = r.registry_id
  WHERE r.token_hash = encode(sha256(_token::bytea), 'hex')
    AND r.token_expires_at > now()
    AND r.status <> 'CANCELLED';
$$;
REVOKE ALL ON FUNCTION public.get_reservation_by_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_token(TEXT) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.update_reservation_by_token(_token TEXT, _action TEXT, _message TEXT DEFAULT NULL)
RETURNS TEXT LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_res public.reservations; v_reg public.registries; m RECORD; v_item_title TEXT;
BEGIN
  SELECT * INTO v_res FROM public.reservations
    WHERE token_hash = encode(sha256(_token::bytea), 'hex') AND token_expires_at > now() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invalid_token'; END IF;
  SELECT * INTO v_reg FROM public.registries WHERE id = v_res.registry_id;
  SELECT title INTO v_item_title FROM public.items WHERE id = v_res.item_id;

  IF _action = 'message' THEN
    UPDATE public.reservations SET message = NULLIF(btrim(COALESCE(_message,'')),'') WHERE id = v_res.id;
  ELSIF _action = 'purchased' THEN
    UPDATE public.reservations SET status = 'PURCHASED', purchased_at = now(), message = COALESCE(NULLIF(btrim(COALESCE(_message,'')),''), message) WHERE id = v_res.id;
    UPDATE public.items SET status = 'PURCHASED' WHERE id = v_res.item_id;
    FOR m IN SELECT user_id FROM public.list_members WHERE registry_id = v_res.registry_id LOOP
      INSERT INTO public.notifications (user_id, registry_id, title, body)
      VALUES (m.user_id, v_res.registry_id,
        CASE WHEN v_reg.surprise_mode THEN 'Un cadeau a été acheté 🎁' ELSE '« ' || v_item_title || ' » a été acheté' END,
        CASE WHEN v_reg.surprise_mode THEN 'Mode surprise activé.' ELSE 'Par ' || v_res.guest_name END);
    END LOOP;
  ELSIF _action = 'cancel' THEN
    IF v_res.status = 'CANCELLED' THEN RETURN 'ok'; END IF;
    DELETE FROM public.reservations WHERE id = v_res.id;
  ELSE
    RAISE EXCEPTION 'invalid_action';
  END IF;
  RETURN 'ok';
END; $$;
REVOKE ALL ON FUNCTION public.update_reservation_by_token(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.update_reservation_by_token(TEXT, TEXT, TEXT) TO anon, authenticated, service_role;

-- ============ CLICK TRACKING + PROTECTED LIST ACCESS ============
CREATE OR REPLACE FUNCTION public.track_click(_public_token TEXT, _click_type TEXT DEFAULT 'MERCHANT', _affiliate BOOLEAN DEFAULT false)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_item public.items;
BEGIN
  SELECT * INTO v_item FROM public.items WHERE public_token = _public_token;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO public.click_events (item_id, registry_id, merchant_id, click_type, affiliate)
  VALUES (v_item.id, v_item.registry_id, v_item.merchant_id, COALESCE(_click_type,'MERCHANT'), COALESCE(_affiliate,false));
END; $$;
REVOKE ALL ON FUNCTION public.track_click(TEXT, TEXT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.track_click(TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.increment_list_view(_slug TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.registries SET view_count = view_count + 1 WHERE slug = _slug AND status = 'ACTIVE';
END; $$;
REVOKE ALL ON FUNCTION public.increment_list_view(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_list_view(TEXT) TO anon, authenticated, service_role;

-- Default role for new users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'USER') ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

INSERT INTO public.user_roles (user_id, role) SELECT id, 'USER' FROM auth.users ON CONFLICT DO NOTHING;
INSERT INTO public.list_entitlements (registry_id) SELECT id FROM public.registries ON CONFLICT DO NOTHING;

CREATE INDEX IF NOT EXISTS items_registry_idx ON public.items (registry_id);
CREATE INDEX IF NOT EXISTS reservations_registry_idx ON public.reservations (registry_id);
CREATE INDEX IF NOT EXISTS click_events_registry_idx ON public.click_events (registry_id, created_at);
CREATE INDEX IF NOT EXISTS list_members_user_idx ON public.list_members (user_id);
CREATE INDEX IF NOT EXISTS notifications_user_idx ON public.notifications (user_id, created_at DESC);