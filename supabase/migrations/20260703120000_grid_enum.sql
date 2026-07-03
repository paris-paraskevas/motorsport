-- Grid market type: pick a driver + their exact STARTING grid slot; settles on
-- the QUALIFYING classification, not the race. Ships DORMANT (no automation
-- opens one, no UI lists one) — exactly how podium/top10 first landed. Add the
-- enum value in its own migration so the value is committed before the
-- settle_market branch (next migration) references it (same two-step as
-- 20260624130000_forecast_enum).
alter type market_type add value if not exists 'grid';
