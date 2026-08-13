REVOKE ALL ON FUNCTION public.reward_transactions_sync() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reward_transactions_sync() FROM anon;
REVOKE ALL ON FUNCTION public.reward_transactions_sync() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reward_transactions_sync() TO service_role;