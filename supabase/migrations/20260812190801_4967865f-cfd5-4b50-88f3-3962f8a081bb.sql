ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS link_mode text NOT NULL DEFAULT 'TEMPLATE',
  ADD COLUMN IF NOT EXISTS api_endpoint text,
  ADD COLUMN IF NOT EXISTS api_key text,
  ADD COLUMN IF NOT EXISTS api_config jsonb NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_link_mode_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_link_mode_check CHECK (link_mode IN ('NONE','TEMPLATE','API'));

DROP POLICY IF EXISTS "public reads enabled merchants" ON public.merchants;

REVOKE ALL ON public.merchants FROM anon;
REVOKE ALL ON public.merchants FROM authenticated;
GRANT SELECT (id, name, domains, logo_url, enabled) ON public.merchants TO authenticated;
GRANT ALL ON public.merchants TO service_role;

CREATE POLICY "authenticated reads enabled merchants"
  ON public.merchants FOR SELECT TO authenticated
  USING (enabled = true);