-- Backfill state controls for the first staging application. Fresh databases
-- receive the same rows directly from the original migration's RETURNING CTE.
insert into public.drainscapes_market_controls(market_id)
select m.id
from public.markets m
where m.market_key like 'drainscapes:state:%'
on conflict (market_id) do nothing;
