-- Predictions: a free, virtual-coin game on live matches (no money moves, coins have no cash value).
-- Every coin movement goes through the ledger and the SECURITY DEFINER functions below, which only the FastAPI
-- service role may call, so wallets cannot be edited from the browser and balance = sum(ledger) is always checkable.

CREATE TABLE IF NOT EXISTS public.bet_wallets (
  user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  balance integer NOT NULL DEFAULT 0,          -- may dip below zero only when a settlement is reversed after an event undo
  last_refill_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.bet_markets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('MATCH_RESULT', 'NEXT_GOAL', 'TOTAL_GOALS', 'RT_TEST')),
  params jsonb NOT NULL DEFAULT '{}'::jsonb,   -- NEXT_GOAL: {"goal_no": n}; TOTAL_GOALS: {"line": 2.5}
  status text NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'SETTLED', 'VOID')),
  result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_bet_market ON public.bet_markets (match_id, kind, (COALESCE(params->>'goal_no', '') || ':' || COALESCE(params->>'line', '')));
CREATE INDEX IF NOT EXISTS idx_bet_markets_event ON public.bet_markets (event_id);

CREATE TABLE IF NOT EXISTS public.bets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  market_id uuid NOT NULL REFERENCES public.bet_markets(id) ON DELETE CASCADE,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  selection text NOT NULL,
  stake integer NOT NULL CHECK (stake > 0),
  odds numeric(6, 2) NOT NULL CHECK (odds > 1),  -- locked in when the bet is placed
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'WON', 'LOST', 'VOID')),
  payout integer NOT NULL DEFAULT 0,
  idempotency_key uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  settled_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_bets_user ON public.bets (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bets_market ON public.bets (market_id);
CREATE INDEX IF NOT EXISTS idx_bets_event ON public.bets (event_id);

CREATE TABLE IF NOT EXISTS public.bet_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  delta integer NOT NULL,
  reason text NOT NULL CHECK (reason IN ('SIGNUP_BONUS', 'STAKE', 'PAYOUT', 'REFUND', 'REFILL', 'REVERSAL')),
  bet_id uuid REFERENCES public.bets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bet_ledger_user ON public.bet_ledger (user_id, created_at DESC);

-- RLS: you read your own money, everyone reads markets of public events, nobody writes from the browser
ALTER TABLE public.bet_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_markets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bet_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Own wallet" ON public.bet_wallets;
CREATE POLICY "Own wallet" ON public.bet_wallets FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own bets" ON public.bets;
CREATE POLICY "Own bets" ON public.bets FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Own ledger" ON public.bet_ledger;
CREATE POLICY "Own ledger" ON public.bet_ledger FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "Markets of public events" ON public.bet_markets;
CREATE POLICY "Markets of public events" ON public.bet_markets FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.events e WHERE e.id = event_id AND e.status <> 'DRAFT'));

REVOKE INSERT, UPDATE, DELETE ON public.bet_wallets, public.bet_markets, public.bets, public.bet_ledger FROM anon, authenticated;
GRANT SELECT ON public.bet_wallets, public.bet_markets, public.bets, public.bet_ledger TO authenticated;
GRANT SELECT ON public.bet_markets TO anon;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['bet_markets', 'bets', 'bet_wallets'] LOOP
    BEGIN EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    EXCEPTION WHEN duplicate_object THEN NULL; END;
  END LOOP;
END $$;

-- 1. wallet with the sign-up bonus (idempotent)
CREATE OR REPLACE FUNCTION public.bet_ensure_wallet(p_user uuid, p_bonus integer DEFAULT 1000)
RETURNS public.bet_wallets LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.bet_wallets;
BEGIN
  INSERT INTO public.bet_wallets (user_id, balance) VALUES (p_user, p_bonus) ON CONFLICT (user_id) DO NOTHING;
  IF FOUND THEN
    INSERT INTO public.bet_ledger (user_id, delta, reason) VALUES (p_user, p_bonus, 'SIGNUP_BONUS');
  END IF;
  SELECT * INTO w FROM public.bet_wallets WHERE user_id = p_user;
  RETURN w;
END $$;

-- 2. place a bet atomically: state guard, funds guard, ledger, wallet, all in one transaction
CREATE OR REPLACE FUNCTION public.bet_place(p_user uuid, p_market uuid, p_selection text, p_stake integer, p_odds numeric, p_key uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.bet_markets; w public.bet_wallets; existing uuid; new_id uuid;
BEGIN
  IF p_key IS NOT NULL THEN
    SELECT id INTO existing FROM public.bets WHERE idempotency_key = p_key AND user_id = p_user;
    IF existing IS NOT NULL THEN RETURN existing; END IF;
  END IF;
  PERFORM public.bet_ensure_wallet(p_user);
  SELECT * INTO w FROM public.bet_wallets WHERE user_id = p_user FOR UPDATE;
  SELECT * INTO m FROM public.bet_markets WHERE id = p_market;
  IF m.id IS NULL OR m.status <> 'OPEN' THEN RAISE EXCEPTION 'MARKET_CLOSED'; END IF;
  IF p_stake <= 0 THEN RAISE EXCEPTION 'BAD_STAKE'; END IF;
  IF w.balance < p_stake THEN RAISE EXCEPTION 'INSUFFICIENT_COINS'; END IF;

  INSERT INTO public.bets (user_id, market_id, match_id, event_id, selection, stake, odds, idempotency_key)
  VALUES (p_user, m.id, m.match_id, m.event_id, p_selection, p_stake, p_odds, p_key) RETURNING id INTO new_id;
  INSERT INTO public.bet_ledger (user_id, delta, reason, bet_id) VALUES (p_user, -p_stake, 'STAKE', new_id);
  UPDATE public.bet_wallets SET balance = balance - p_stake, updated_at = now() WHERE user_id = p_user;
  RETURN new_id;
END $$;

-- 3. settle (or re-settle) a market. Re-running with a different result first reverses the old payouts, so an
--    undone goal or a corrected score repairs every wallet instead of leaving stale wins behind.
CREATE OR REPLACE FUNCTION public.bet_apply_result(p_market uuid, p_result text, p_void boolean DEFAULT false)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m public.bet_markets; b record; n integer := 0; pay integer;
BEGIN
  SELECT * INTO m FROM public.bet_markets WHERE id = p_market FOR UPDATE;
  IF m.id IS NULL THEN RETURN 0; END IF;

  -- nothing to do when the market already is in the requested state
  IF (p_void AND m.status = 'VOID') OR (NOT p_void AND p_result IS NOT NULL AND m.status = 'SETTLED' AND m.result = p_result)
     OR (NOT p_void AND p_result IS NULL AND m.status = 'OPEN') THEN
    RETURN 0;
  END IF;

  IF m.status <> 'OPEN' THEN  -- reverse the previous outcome
    FOR b IN SELECT * FROM public.bets WHERE market_id = p_market AND status <> 'PENDING' ORDER BY id LOOP
      IF b.payout <> 0 THEN
        INSERT INTO public.bet_ledger (user_id, delta, reason, bet_id) VALUES (b.user_id, -b.payout, 'REVERSAL', b.id);
        UPDATE public.bet_wallets SET balance = balance - b.payout, updated_at = now() WHERE user_id = b.user_id;
      END IF;
      UPDATE public.bets SET status = 'PENDING', payout = 0, settled_at = NULL WHERE id = b.id;
    END LOOP;
    UPDATE public.bet_markets SET status = 'OPEN', result = NULL, settled_at = NULL WHERE id = p_market;
  END IF;

  IF p_void THEN
    FOR b IN SELECT * FROM public.bets WHERE market_id = p_market AND status = 'PENDING' ORDER BY id LOOP
      INSERT INTO public.bet_ledger (user_id, delta, reason, bet_id) VALUES (b.user_id, b.stake, 'REFUND', b.id);
      UPDATE public.bet_wallets SET balance = balance + b.stake, updated_at = now() WHERE user_id = b.user_id;
      UPDATE public.bets SET status = 'VOID', payout = b.stake, settled_at = now() WHERE id = b.id;
      n := n + 1;
    END LOOP;
    UPDATE public.bet_markets SET status = 'VOID', settled_at = now() WHERE id = p_market;
  ELSIF p_result IS NOT NULL THEN
    FOR b IN SELECT * FROM public.bets WHERE market_id = p_market AND status = 'PENDING' ORDER BY id LOOP
      pay := CASE WHEN b.selection = p_result THEN floor(b.stake * b.odds)::integer ELSE 0 END;
      IF pay > 0 THEN
        INSERT INTO public.bet_ledger (user_id, delta, reason, bet_id) VALUES (b.user_id, pay, 'PAYOUT', b.id);
        UPDATE public.bet_wallets SET balance = balance + pay, updated_at = now() WHERE user_id = b.user_id;
      END IF;
      UPDATE public.bets SET status = CASE WHEN pay > 0 THEN 'WON' ELSE 'LOST' END, payout = pay, settled_at = now() WHERE id = b.id;
      n := n + 1;
    END LOOP;
    UPDATE public.bet_markets SET status = 'SETTLED', result = p_result, settled_at = now() WHERE id = p_market;
  END IF;
  RETURN n;
END $$;

-- 4. a safety net for players who run out of coins: 300 coins, once a day, only when broke with nothing pending
CREATE OR REPLACE FUNCTION public.bet_refill(p_user uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE w public.bet_wallets;
BEGIN
  PERFORM public.bet_ensure_wallet(p_user);
  SELECT * INTO w FROM public.bet_wallets WHERE user_id = p_user FOR UPDATE;
  IF w.balance >= 100 OR EXISTS (SELECT 1 FROM public.bets WHERE user_id = p_user AND status = 'PENDING')
     OR (w.last_refill_at IS NOT NULL AND w.last_refill_at > now() - interval '24 hours') THEN
    RAISE EXCEPTION 'REFILL_NOT_AVAILABLE';
  END IF;
  INSERT INTO public.bet_ledger (user_id, delta, reason) VALUES (p_user, 300, 'REFILL');
  UPDATE public.bet_wallets SET balance = balance + 300, last_refill_at = now(), updated_at = now() WHERE user_id = p_user RETURNING balance INTO w.balance;
  RETURN w.balance;
END $$;

-- 5. public leaderboard (profit on settled bets), globally or for one event. Respects profile privacy.
CREATE OR REPLACE FUNCTION public.bet_leaderboard(p_event uuid DEFAULT NULL, p_limit integer DEFAULT 50)
RETURNS TABLE (user_id uuid, display_name text, avatar_media_id uuid, profit integer, bets_settled integer, bets_won integer,
               win_rate numeric, biggest_win integer, balance integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH s AS (
    SELECT b.user_id,
           SUM(CASE WHEN b.status = 'WON' THEN b.payout - b.stake ELSE -b.stake END) AS profit,
           COUNT(*) AS settled,
           COUNT(*) FILTER (WHERE b.status = 'WON') AS won,
           MAX(CASE WHEN b.status = 'WON' THEN b.payout - b.stake END) AS biggest
    FROM public.bets b
    WHERE b.status IN ('WON', 'LOST') AND (p_event IS NULL OR b.event_id = p_event)
    GROUP BY b.user_id
  )
  SELECT s.user_id,
         CASE WHEN ps.profile_public IS FALSE THEN 'Anonymous player' ELSE COALESCE(u.display_name, u.username, 'Player') END,
         CASE WHEN ps.profile_public IS FALSE THEN NULL ELSE u.avatar_media_id END,
         s.profit::integer, s.settled::integer, s.won::integer,
         ROUND(100.0 * s.won / NULLIF(s.settled, 0), 1),
         COALESCE(s.biggest, 0)::integer, COALESCE(w.balance, 0)
  FROM s
  JOIN public.users u ON u.id = s.user_id
  LEFT JOIN public.user_privacy_settings ps ON ps.user_id = s.user_id
  LEFT JOIN public.bet_wallets w ON w.user_id = s.user_id
  ORDER BY s.profit DESC, s.won DESC, s.settled DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 200)
$$;

REVOKE ALL ON FUNCTION public.bet_ensure_wallet(uuid, integer), public.bet_place(uuid, uuid, text, integer, numeric, uuid),
  public.bet_apply_result(uuid, text, boolean), public.bet_refill(uuid), public.bet_leaderboard(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bet_ensure_wallet(uuid, integer), public.bet_place(uuid, uuid, text, integer, numeric, uuid),
  public.bet_apply_result(uuid, text, boolean), public.bet_refill(uuid), public.bet_leaderboard(uuid, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.bet_leaderboard(uuid, integer) TO anon, authenticated;
