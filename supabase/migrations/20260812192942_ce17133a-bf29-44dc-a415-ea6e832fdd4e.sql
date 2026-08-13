-- ============ ENUMS ============
CREATE TYPE public.reward_txn_type AS ENUM ('AFFILIATE_COMMISSION','REFERRAL','PREMIUM_PURCHASE','PARTNER_BONUS','PROMOTIONAL_BONUS','REDEMPTION','ADJUSTMENT');
CREATE TYPE public.reward_txn_status AS ENUM ('PENDING','CONFIRMED','CANCELLED','EXPIRED');
CREATE TYPE public.affiliate_commission_status AS ENUM ('PENDING','CONFIRMED','CANCELLED');
CREATE TYPE public.referral_status AS ENUM ('PENDING','QUALIFIED','REWARDED','CANCELLED');
CREATE TYPE public.redemption_type AS ENUM ('MILA_CREDIT','PREMIUM','PARTNER_VOUCHER','GIFT_CARD','BANK_PAYOUT');
CREATE TYPE public.redemption_status AS ENUM ('REQUESTED','APPROVED','PROCESSED','REJECTED','CANCELLED');

-- ============ SETTINGS (singleton) ============
CREATE TABLE public.reward_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT false,
  affiliate_rewards_enabled boolean NOT NULL DEFAULT true,
  affiliate_share_rate_bps integer NOT NULL DEFAULT 3000 CHECK (affiliate_share_rate_bps >= 0 AND affiliate_share_rate_bps <= 10000),
  referral_rewards_enabled boolean NOT NULL DEFAULT false,
  referral_bonus_cents bigint NOT NULL DEFAULT 300 CHECK (referral_bonus_cents >= 0),
  referral_cap_cents bigint CHECK (referral_cap_cents IS NULL OR referral_cap_cents >= 0),
  referral_requires_verified_email boolean NOT NULL DEFAULT true,
  referral_requires_list boolean NOT NULL DEFAULT true,
  referral_min_items integer NOT NULL DEFAULT 3 CHECK (referral_min_items >= 0),
  premium_rewards_enabled boolean NOT NULL DEFAULT false,
  premium_bonus_cents bigint NOT NULL DEFAULT 200 CHECK (premium_bonus_cents >= 0),
  partner_rewards_enabled boolean NOT NULL DEFAULT false,
  promotional_rewards_enabled boolean NOT NULL DEFAULT false,
  redemption_enabled boolean NOT NULL DEFAULT false,
  bank_payout_enabled boolean NOT NULL DEFAULT false,
  marketplace_enabled boolean NOT NULL DEFAULT false,
  min_redemption_cents bigint NOT NULL DEFAULT 1000 CHECK (min_redemption_cents >= 0),
  expiry_days integer CHECK (expiry_days IS NULL OR expiry_days > 0),
  per_transaction_cap_cents bigint CHECK (per_transaction_cap_cents IS NULL OR per_transaction_cap_cents >= 0),
  monthly_cap_cents_per_list bigint CHECK (monthly_cap_cents_per_list IS NULL OR monthly_cap_cents_per_list >= 0),
  lifetime_cap_cents_per_list bigint CHECK (lifetime_cap_cents_per_list IS NULL OR lifetime_cap_cents_per_list >= 0),
  promotional_cap_cents bigint CHECK (promotional_cap_cents IS NULL OR promotional_cap_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  explainer_text text NOT NULL DEFAULT 'Lorsque Mila reçoit une commission sur certains achats éligibles effectués depuis votre liste, une partie peut être ajoutée à vos Récompenses Mila. Vos proches ne paient rien de plus.',
  validation_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  anti_fraud_rules jsonb NOT NULL DEFAULT '{"block_self_referral": true, "manual_review_threshold": 3}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_settings TO authenticated;
GRANT ALL ON public.reward_settings TO service_role;
ALTER TABLE public.reward_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read reward settings" ON public.reward_settings FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER reward_settings_updated_at BEFORE UPDATE ON public.reward_settings FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
INSERT INTO public.reward_settings (id) VALUES (true);

-- ============ MERCHANT REWARD CONFIG ============
ALTER TABLE public.merchants
  ADD COLUMN reward_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN reward_share_rate_bps integer CHECK (reward_share_rate_bps IS NULL OR (reward_share_rate_bps >= 0 AND reward_share_rate_bps <= 10000));

-- ============ AFFILIATE EVENTS / COMMISSIONS ============
CREATE TABLE public.affiliate_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  external_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, external_id)
);
GRANT ALL ON public.affiliate_events TO service_role;
ALTER TABLE public.affiliate_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read affiliate events" ON public.affiliate_events FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
GRANT SELECT ON public.affiliate_events TO authenticated;

CREATE TABLE public.affiliate_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  network text NOT NULL,
  external_id text NOT NULL,
  event_id uuid REFERENCES public.affiliate_events(id) ON DELETE SET NULL,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  registry_id uuid REFERENCES public.registries(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.items(id) ON DELETE SET NULL,
  click_reference text,
  order_reference text,
  order_amount_cents bigint CHECK (order_amount_cents IS NULL OR order_amount_cents >= 0),
  commission_amount_cents bigint NOT NULL CHECK (commission_amount_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  status public.affiliate_commission_status NOT NULL DEFAULT 'PENDING',
  occurred_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (network, external_id)
);
GRANT SELECT ON public.affiliate_commissions TO authenticated;
GRANT ALL ON public.affiliate_commissions TO service_role;
ALTER TABLE public.affiliate_commissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read affiliate commissions" ON public.affiliate_commissions FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER affiliate_commissions_updated_at BEFORE UPDATE ON public.affiliate_commissions FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ WALLETS ============
CREATE TABLE public.reward_wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  registry_id uuid NOT NULL UNIQUE REFERENCES public.registries(id) ON DELETE CASCADE,
  currency text NOT NULL DEFAULT 'EUR',
  pending_balance_cents bigint NOT NULL DEFAULT 0,
  available_balance_cents bigint NOT NULL DEFAULT 0,
  lifetime_earned_cents bigint NOT NULL DEFAULT 0,
  lifetime_redeemed_cents bigint NOT NULL DEFAULT 0,
  flagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_wallets TO authenticated;
GRANT ALL ON public.reward_wallets TO service_role;
ALTER TABLE public.reward_wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own wallet" ON public.reward_wallets FOR SELECT TO authenticated
  USING (public.is_list_member(registry_id, auth.uid()) OR public.is_staff(auth.uid()));
CREATE TRIGGER reward_wallets_updated_at BEFORE UPDATE ON public.reward_wallets FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ TRANSACTIONS (ledger) ============
CREATE TABLE public.reward_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.reward_wallets(id) ON DELETE CASCADE,
  type public.reward_txn_type NOT NULL,
  amount_cents bigint NOT NULL,
  currency text NOT NULL DEFAULT 'EUR',
  status public.reward_txn_status NOT NULL DEFAULT 'PENDING',
  source_type text,
  source_id uuid,
  source_reference text,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  description text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  confirmed_at timestamptz,
  cancelled_at timestamptz,
  expires_at timestamptz
);
CREATE UNIQUE INDEX reward_transactions_source_unique
  ON public.reward_transactions (source_type, source_reference)
  WHERE source_type IS NOT NULL AND source_reference IS NOT NULL;
CREATE INDEX reward_transactions_wallet_idx ON public.reward_transactions (wallet_id, created_at DESC);
GRANT SELECT ON public.reward_transactions TO authenticated;
GRANT ALL ON public.reward_transactions TO service_role;
ALTER TABLE public.reward_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own reward transactions" ON public.reward_transactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reward_wallets w
    WHERE w.id = reward_transactions.wallet_id
      AND (public.is_list_member(w.registry_id, auth.uid()) OR public.is_staff(auth.uid()))
  ));

-- ============ REFERRALS ============
ALTER TABLE public.profiles ADD COLUMN referral_code text UNIQUE;

CREATE TABLE public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  referrer_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  status public.referral_status NOT NULL DEFAULT 'PENDING',
  risk_signals jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs_review boolean NOT NULL DEFAULT false,
  qualified_at timestamptz,
  rewarded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (referrer_user_id <> referred_user_id)
);
GRANT SELECT ON public.referrals TO authenticated;
GRANT ALL ON public.referrals TO service_role;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own referrals select" ON public.referrals FOR SELECT TO authenticated
  USING (referrer_user_id = auth.uid() OR referred_user_id = auth.uid() OR public.is_staff(auth.uid()));
CREATE TRIGGER referrals_updated_at BEFORE UPDATE ON public.referrals FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ PARTNER CAMPAIGNS ============
CREATE TABLE public.partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_name text NOT NULL,
  campaign_name text NOT NULL,
  description text,
  bonus_amount_cents bigint NOT NULL CHECK (bonus_amount_cents >= 0),
  currency text NOT NULL DEFAULT 'EUR',
  conditions text,
  usage_limit integer CHECK (usage_limit IS NULL OR usage_limit > 0),
  usage_count integer NOT NULL DEFAULT 0,
  visible boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT false,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.partner_campaigns TO authenticated;
GRANT ALL ON public.partner_campaigns TO service_role;
ALTER TABLE public.partner_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read campaigns" ON public.partner_campaigns FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE POLICY "authenticated read visible campaigns" ON public.partner_campaigns FOR SELECT TO authenticated USING (visible = true AND active = true);
CREATE TRIGGER partner_campaigns_updated_at BEFORE UPDATE ON public.partner_campaigns FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ REDEMPTIONS ============
CREATE TABLE public.reward_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id uuid NOT NULL REFERENCES public.reward_wallets(id) ON DELETE CASCADE,
  type public.redemption_type NOT NULL,
  amount_cents bigint NOT NULL CHECK (amount_cents > 0),
  currency text NOT NULL DEFAULT 'EUR',
  status public.redemption_status NOT NULL DEFAULT 'REQUESTED',
  provider text,
  external_reference text,
  offer_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  transaction_id uuid REFERENCES public.reward_transactions(id) ON DELETE SET NULL,
  requested_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  cancelled_at timestamptz
);
GRANT SELECT ON public.reward_redemptions TO authenticated;
GRANT ALL ON public.reward_redemptions TO service_role;
ALTER TABLE public.reward_redemptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "members read own redemptions" ON public.reward_redemptions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.reward_wallets w
    WHERE w.id = reward_redemptions.wallet_id
      AND (public.is_list_member(w.registry_id, auth.uid()) OR public.is_staff(auth.uid()))
  ));

-- ============ REWARD OFFERS (marketplace, intentionally empty) ============
CREATE TABLE public.reward_offers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type public.redemption_type NOT NULL DEFAULT 'MILA_CREDIT',
  cost_cents bigint NOT NULL CHECK (cost_cents > 0),
  currency text NOT NULL DEFAULT 'EUR',
  partner_campaign_id uuid REFERENCES public.partner_campaigns(id) ON DELETE SET NULL,
  image_url text,
  stock integer CHECK (stock IS NULL OR stock >= 0),
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.reward_offers TO authenticated;
GRANT ALL ON public.reward_offers TO service_role;
ALTER TABLE public.reward_offers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read active offers" ON public.reward_offers FOR SELECT TO authenticated USING (active = true);
CREATE POLICY "staff read all offers" ON public.reward_offers FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
CREATE TRIGGER reward_offers_updated_at BEFORE UPDATE ON public.reward_offers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ============ BALANCE RECOMPUTATION FROM LEDGER ============
CREATE OR REPLACE FUNCTION public.recompute_reward_wallet(_wallet_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_pending bigint; v_available bigint; v_earned bigint; v_redeemed bigint;
BEGIN
  SELECT
    COALESCE(SUM(CASE WHEN status = 'PENDING' AND type <> 'REDEMPTION' THEN amount_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN amount_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'CONFIRMED' AND amount_cents > 0 THEN amount_cents ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN status = 'CONFIRMED' AND type = 'REDEMPTION' THEN -amount_cents ELSE 0 END), 0)
  INTO v_pending, v_available, v_earned, v_redeemed
  FROM public.reward_transactions WHERE wallet_id = _wallet_id;

  UPDATE public.reward_wallets
     SET pending_balance_cents = v_pending,
         available_balance_cents = v_available,
         lifetime_earned_cents = v_earned,
         lifetime_redeemed_cents = v_redeemed
   WHERE id = _wallet_id;
END; $$;

CREATE OR REPLACE FUNCTION public.reward_transactions_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.recompute_reward_wallet(COALESCE(NEW.wallet_id, OLD.wallet_id));
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER reward_transactions_sync AFTER INSERT OR UPDATE OR DELETE ON public.reward_transactions
  FOR EACH ROW EXECUTE FUNCTION public.reward_transactions_sync();

-- ============ WALLET PROVISIONING ============
CREATE OR REPLACE FUNCTION public.ensure_reward_wallet(_registry_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM public.reward_wallets WHERE registry_id = _registry_id;
  IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  INSERT INTO public.reward_wallets (registry_id) VALUES (_registry_id)
    ON CONFLICT (registry_id) DO UPDATE SET updated_at = now()
    RETURNING id INTO v_id;
  RETURN v_id;
END; $$;

-- ============ CORE CREDIT (idempotent, capped, server-only) ============
CREATE OR REPLACE FUNCTION public.reward_credit(
  _registry_id uuid,
  _type public.reward_txn_type,
  _amount_cents bigint,
  _status public.reward_txn_status,
  _source_type text,
  _source_reference text,
  _description text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _merchant_id uuid DEFAULT NULL,
  _source_id uuid DEFAULT NULL,
  _created_by uuid DEFAULT NULL
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.reward_settings; v_wallet uuid; v_id uuid;
  v_amount bigint := _amount_cents; v_month_total bigint; v_life_total bigint; v_expires timestamptz;
BEGIN
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  SELECT * INTO s FROM public.reward_settings WHERE id;
  IF NOT s.enabled THEN RAISE EXCEPTION 'rewards_disabled'; END IF;

  IF _source_type IS NOT NULL AND _source_reference IS NOT NULL THEN
    SELECT id INTO v_id FROM public.reward_transactions
      WHERE source_type = _source_type AND source_reference = _source_reference;
    IF v_id IS NOT NULL THEN RETURN v_id; END IF;
  END IF;

  v_wallet := public.ensure_reward_wallet(_registry_id);
  PERFORM 1 FROM public.reward_wallets WHERE id = v_wallet FOR UPDATE;

  IF s.per_transaction_cap_cents IS NOT NULL THEN
    v_amount := LEAST(v_amount, s.per_transaction_cap_cents);
  END IF;

  IF s.monthly_cap_cents_per_list IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_month_total FROM public.reward_transactions
      WHERE wallet_id = v_wallet AND amount_cents > 0 AND status <> 'CANCELLED'
        AND created_at >= date_trunc('month', now());
    v_amount := LEAST(v_amount, GREATEST(s.monthly_cap_cents_per_list - v_month_total, 0));
  END IF;

  IF s.lifetime_cap_cents_per_list IS NOT NULL THEN
    SELECT COALESCE(SUM(amount_cents), 0) INTO v_life_total FROM public.reward_transactions
      WHERE wallet_id = v_wallet AND amount_cents > 0 AND status <> 'CANCELLED';
    v_amount := LEAST(v_amount, GREATEST(s.lifetime_cap_cents_per_list - v_life_total, 0));
  END IF;

  IF v_amount <= 0 THEN RETURN NULL; END IF;
  IF s.expiry_days IS NOT NULL THEN v_expires := now() + make_interval(days => s.expiry_days); END IF;

  INSERT INTO public.reward_transactions
    (wallet_id, type, amount_cents, currency, status, source_type, source_id, source_reference,
     merchant_id, description, metadata, created_by, confirmed_at, expires_at)
  VALUES
    (v_wallet, _type, v_amount, s.currency, _status, _source_type, _source_id, _source_reference,
     _merchant_id, _description, COALESCE(_metadata, '{}'::jsonb), _created_by,
     CASE WHEN _status = 'CONFIRMED' THEN now() ELSE NULL END, v_expires)
  RETURNING id INTO v_id;

  RETURN v_id;
END; $$;

-- ============ STATUS TRANSITIONS ============
CREATE OR REPLACE FUNCTION public.reward_set_status(_source_type text, _source_reference text, _status public.reward_txn_status)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_count integer;
BEGIN
  IF _status = 'CONFIRMED' THEN
    UPDATE public.reward_transactions SET status = 'CONFIRMED', confirmed_at = now()
      WHERE source_type = _source_type AND source_reference = _source_reference AND status = 'PENDING';
  ELSIF _status = 'CANCELLED' THEN
    UPDATE public.reward_transactions SET status = 'CANCELLED', cancelled_at = now()
      WHERE source_type = _source_type AND source_reference = _source_reference AND status = 'PENDING';
  ELSIF _status = 'EXPIRED' THEN
    UPDATE public.reward_transactions SET status = 'EXPIRED'
      WHERE source_type = _source_type AND source_reference = _source_reference AND status IN ('PENDING','CONFIRMED');
  ELSE
    RAISE EXCEPTION 'invalid_status';
  END IF;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END; $$;

-- ============ AFFILIATE COMMISSION -> REWARD ============
CREATE OR REPLACE FUNCTION public.reward_apply_commission(_commission_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  c public.affiliate_commissions; s public.reward_settings; m public.merchants;
  v_rate integer; v_amount bigint; v_ref text; v_status public.reward_txn_status;
BEGIN
  SELECT * INTO c FROM public.affiliate_commissions WHERE id = _commission_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'commission_not_found'; END IF;
  IF c.registry_id IS NULL THEN RETURN NULL; END IF;
  IF c.status = 'CANCELLED' THEN
    PERFORM public.reward_set_status('AFFILIATE_COMMISSION', c.id::text, 'CANCELLED');
    RETURN NULL;
  END IF;

  SELECT * INTO s FROM public.reward_settings WHERE id;
  IF NOT s.enabled OR NOT s.affiliate_rewards_enabled THEN RETURN NULL; END IF;

  v_rate := s.affiliate_share_rate_bps;
  IF c.merchant_id IS NOT NULL THEN
    SELECT * INTO m FROM public.merchants WHERE id = c.merchant_id;
    IF FOUND THEN
      IF NOT m.reward_enabled THEN RETURN NULL; END IF;
      IF m.reward_share_rate_bps IS NOT NULL THEN v_rate := m.reward_share_rate_bps; END IF;
    END IF;
  END IF;
  IF v_rate <= 0 THEN RETURN NULL; END IF;
  IF v_rate > 10000 THEN RAISE EXCEPTION 'rate_above_100_percent'; END IF;
  IF c.currency <> s.currency THEN RAISE EXCEPTION 'currency_mismatch'; END IF;

  -- integer arithmetic only, rounded down: never exceeds the revenue actually received
  v_amount := (c.commission_amount_cents * v_rate) / 10000;
  IF v_amount <= 0 THEN RETURN NULL; END IF;
  IF v_amount > c.commission_amount_cents THEN RAISE EXCEPTION 'reward_above_revenue'; END IF;

  v_ref := c.id::text;
  v_status := CASE WHEN c.status = 'CONFIRMED' THEN 'CONFIRMED'::public.reward_txn_status ELSE 'PENDING'::public.reward_txn_status END;

  IF EXISTS (SELECT 1 FROM public.reward_transactions WHERE source_type = 'AFFILIATE_COMMISSION' AND source_reference = v_ref) THEN
    IF v_status = 'CONFIRMED' THEN PERFORM public.reward_set_status('AFFILIATE_COMMISSION', v_ref, 'CONFIRMED'); END IF;
    RETURN (SELECT id FROM public.reward_transactions WHERE source_type = 'AFFILIATE_COMMISSION' AND source_reference = v_ref);
  END IF;

  RETURN public.reward_credit(
    c.registry_id, 'AFFILIATE_COMMISSION', v_amount, v_status,
    'AFFILIATE_COMMISSION', v_ref,
    'Commission sur un achat', jsonb_build_object('rate_bps', v_rate, 'commission_cents', c.commission_amount_cents),
    c.merchant_id, c.id, NULL);
END; $$;

-- ============ REDEMPTION ============
CREATE OR REPLACE FUNCTION public.reward_redeem(
  _registry_id uuid, _type public.redemption_type, _amount_cents bigint,
  _offer_id uuid DEFAULT NULL, _user_id uuid DEFAULT NULL, _metadata jsonb DEFAULT '{}'::jsonb
) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE s public.reward_settings; w public.reward_wallets; v_txn uuid; v_red uuid;
BEGIN
  SELECT * INTO s FROM public.reward_settings WHERE id;
  IF NOT s.enabled OR NOT s.redemption_enabled THEN RAISE EXCEPTION 'redemption_disabled'; END IF;
  IF _type = 'BANK_PAYOUT' AND NOT s.bank_payout_enabled THEN RAISE EXCEPTION 'bank_payout_disabled'; END IF;
  IF _amount_cents IS NULL OR _amount_cents <= 0 THEN RAISE EXCEPTION 'invalid_amount'; END IF;
  IF _amount_cents < s.min_redemption_cents THEN RAISE EXCEPTION 'below_minimum'; END IF;

  SELECT * INTO w FROM public.reward_wallets WHERE registry_id = _registry_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'wallet_not_found'; END IF;
  IF w.available_balance_cents < _amount_cents THEN RAISE EXCEPTION 'insufficient_balance'; END IF;

  INSERT INTO public.reward_transactions
    (wallet_id, type, amount_cents, currency, status, source_type, description, metadata, created_by, confirmed_at)
  VALUES (w.id, 'REDEMPTION', -_amount_cents, w.currency, 'CONFIRMED', 'REDEMPTION',
          'Utilisation de récompenses', COALESCE(_metadata,'{}'::jsonb), _user_id, now())
  RETURNING id INTO v_txn;

  INSERT INTO public.reward_redemptions (wallet_id, type, amount_cents, currency, status, offer_id, metadata, transaction_id, requested_by)
  VALUES (w.id, _type, _amount_cents, w.currency, 'REQUESTED', _offer_id, COALESCE(_metadata,'{}'::jsonb), v_txn, _user_id)
  RETURNING id INTO v_red;

  RETURN v_red;
END; $$;

-- ============ EXECUTE PRIVILEGES: server-side only ============
REVOKE ALL ON FUNCTION public.reward_credit(uuid, public.reward_txn_type, bigint, public.reward_txn_status, text, text, text, jsonb, uuid, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_set_status(text, text, public.reward_txn_status) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_apply_commission(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reward_redeem(uuid, public.redemption_type, bigint, uuid, uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.recompute_reward_wallet(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.ensure_reward_wallet(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reward_credit(uuid, public.reward_txn_type, bigint, public.reward_txn_status, text, text, text, jsonb, uuid, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reward_set_status(text, text, public.reward_txn_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.reward_apply_commission(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.reward_redeem(uuid, public.redemption_type, bigint, uuid, uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.recompute_reward_wallet(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_reward_wallet(uuid) TO service_role;

-- ============ FEATURE FLAGS ============
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('rewards', false, 'Programme Récompenses Mila'),
  ('affiliateRewards', false, 'Récompenses issues des commissions affiliation'),
  ('referralRewards', false, 'Récompenses de parrainage'),
  ('partnerRewards', false, 'Bonus partenaires'),
  ('premiumRewards', false, 'Bonus à l''achat de Mila Premium'),
  ('rewardRedemption', false, 'Utilisation des récompenses'),
  ('bankPayout', false, 'Virement bancaire des récompenses (juridique non validé)'),
  ('rewardMarketplace', false, 'Boutique des récompenses')
ON CONFLICT (key) DO NOTHING;