-- Per-series tags for threads. A thread MAY be tagged with one series (its slug,
-- e.g. 'formula-1') so a series page can surface its own discussion. NULLABLE on
-- purpose: existing threads predate this column and untagged threads stay valid
-- (general discussion). No FK — series live in the repo (content/series/<slug>),
-- not in Postgres; the API validates the slug against lib/series meta on write.
-- RLS-on / no-policies / service_role-only is inherited from the thread table.
alter table thread add column if not exists series_slug text;

-- The series page asks "which slugs have >=1 approved thread?" and the index
-- page filters approved threads by ?series=<slug>; both hit (status, series_slug).
create index if not exists thread_series_idx on thread (status, series_slug);
