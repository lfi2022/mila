-- 1. Merchants: remove broad authenticated read, expose a safe view instead
DROP POLICY IF EXISTS "authenticated reads enabled merchants" ON public.merchants;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.merchants FROM authenticated, anon;
GRANT ALL ON public.merchants TO service_role;

CREATE OR REPLACE VIEW public.merchants_public
WITH (security_invoker = on) AS
  SELECT id, name, domains, logo_url, enabled, affiliate_enabled, link_mode, reward_enabled
  FROM public.merchants
  WHERE enabled = true;

CREATE POLICY "staff read merchants" ON public.merchants
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));

GRANT SELECT ON public.merchants_public TO authenticated, service_role;

-- 2. SECURITY DEFINER functions: least-privilege EXECUTE grants
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.prosecdef AND p.prorettype <> 'trigger'::regtype
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- Guest-facing (anon + authenticated) public list & reservation flows
GRANT EXECUTE ON FUNCTION public.increment_list_view(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_item(uuid, text, text, text, integer, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_reservation_by_token(text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_reservation_by_token(text, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.track_click(text, text, boolean) TO anon, authenticated;

-- Membership / role checks used by signed-in app code and RLS policies
GRANT EXECUTE ON FUNCTION public.is_list_owner(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_list_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff(uuid) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, anon;

-- 3. Storage policies for the private list-covers bucket
CREATE POLICY "list members read covers" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'list-covers'
    AND public.is_list_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "list members upload covers" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'list-covers'
    AND public.is_list_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "list members update covers" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'list-covers'
    AND public.is_list_member(((storage.foldername(name))[1])::uuid, auth.uid())
  )
  WITH CHECK (
    bucket_id = 'list-covers'
    AND public.is_list_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );

CREATE POLICY "list members delete covers" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'list-covers'
    AND public.is_list_member(((storage.foldername(name))[1])::uuid, auth.uid())
  );