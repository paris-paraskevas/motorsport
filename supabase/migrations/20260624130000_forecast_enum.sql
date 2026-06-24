-- Forecast market type: pick ≥2 drivers + their exact finishing positions,
-- all-or-nothing. Add the enum value in its own migration so the value is
-- committed before the settle_market branch (next migration) references it.
alter type market_type add value if not exists 'forecast';
