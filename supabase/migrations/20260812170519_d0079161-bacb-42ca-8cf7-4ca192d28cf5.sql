-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  display_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- registries
CREATE TABLE public.registries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  baby_name TEXT,
  welcome_message TEXT,
  due_date DATE,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.registries TO authenticated;
GRANT SELECT ON public.registries TO anon;
GRANT ALL ON public.registries TO service_role;
ALTER TABLE public.registries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages registries" ON public.registries FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "public can read published registries" ON public.registries FOR SELECT TO anon, authenticated
  USING (is_public = true);
CREATE TRIGGER registries_updated_at BEFORE UPDATE ON public.registries FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- items
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id UUID NOT NULL REFERENCES public.registries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  store_name TEXT,
  url TEXT,
  price NUMERIC(10,2),
  image_url TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  reserved_qty INTEGER NOT NULL DEFAULT 0,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX items_registry_idx ON public.items(registry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.items TO authenticated;
GRANT SELECT ON public.items TO anon;
GRANT ALL ON public.items TO service_role;
ALTER TABLE public.items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner manages items" ON public.items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.registries r WHERE r.id = items.registry_id AND r.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.registries r WHERE r.id = items.registry_id AND r.owner_id = auth.uid()));
CREATE POLICY "public reads available items" ON public.items FOR SELECT TO anon, authenticated
  USING (reserved_qty < quantity AND EXISTS (SELECT 1 FROM public.registries r WHERE r.id = items.registry_id AND r.is_public = true));
CREATE TRIGGER items_updated_at BEFORE UPDATE ON public.items FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- reservations
CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE CASCADE,
  registry_id UUID NOT NULL REFERENCES public.registries(id) ON DELETE CASCADE,
  guest_name TEXT NOT NULL,
  guest_email TEXT,
  message TEXT,
  quantity INTEGER NOT NULL DEFAULT 1,
  intent TEXT NOT NULL DEFAULT 'reserve',
  user_id UUID REFERENCES auth.users ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reservations_registry_idx ON public.reservations(registry_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT INSERT ON public.reservations TO anon;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner reads reservations" ON public.reservations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.registries r WHERE r.id = reservations.registry_id AND r.owner_id = auth.uid()));
CREATE POLICY "owner deletes reservations" ON public.reservations FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.registries r WHERE r.id = reservations.registry_id AND r.owner_id = auth.uid()));
CREATE POLICY "guests can reserve available items" ON public.reservations FOR INSERT TO anon, authenticated
  WITH CHECK (
    quantity > 0 AND char_length(guest_name) BETWEEN 1 AND 100
    AND EXISTS (
      SELECT 1 FROM public.items i JOIN public.registries r ON r.id = i.registry_id
      WHERE i.id = reservations.item_id AND i.registry_id = reservations.registry_id
        AND r.is_public = true AND i.reserved_qty + reservations.quantity <= i.quantity
    )
  );

-- notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  registry_id UUID REFERENCES public.registries(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON public.notifications(user_id, created_at DESC);
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own notifications select" ON public.notifications FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "own notifications update" ON public.notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "own notifications delete" ON public.notifications FOR DELETE TO authenticated USING (user_id = auth.uid());

-- keep reserved_qty in sync + notify parents
CREATE OR REPLACE FUNCTION public.handle_reservation()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_owner UUID; v_item TEXT; v_reg TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.items SET reserved_qty = reserved_qty + NEW.quantity WHERE id = NEW.item_id;
    SELECT r.owner_id, r.title, i.title INTO v_owner, v_reg, v_item
    FROM public.items i JOIN public.registries r ON r.id = i.registry_id WHERE i.id = NEW.item_id;
    INSERT INTO public.notifications (user_id, registry_id, title, body)
    VALUES (v_owner, NEW.registry_id,
      NEW.guest_name || ' a réservé « ' || v_item || ' »',
      COALESCE(NEW.message, 'Aucun message laissé.'));
    RETURN NEW;
  ELSE
    UPDATE public.items SET reserved_qty = GREATEST(reserved_qty - OLD.quantity, 0) WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
END; $$;
CREATE TRIGGER reservations_sync AFTER INSERT OR DELETE ON public.reservations
FOR EACH ROW EXECUTE FUNCTION public.handle_reservation();