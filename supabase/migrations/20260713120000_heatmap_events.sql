-- Anonymous element-relative click + impression heatmap. Rebuild of the KV 24x24
-- viewport-grid model. One row per raw event; /admin ranks HOT elements (most
-- clicks) and DEAD elements (seen but never clicked). No PII. RLS-on / no-policies
-- / service_role-only (default privileges already grant service_role on new
-- tables + views per 20260622094000_grants.sql).
create table if not exists heatmap_event (
  id          bigint generated always as identity primary key,
  path        text        not null,
  kind        text        not null check (kind in ('click', 'impression')),
  element_id  text,
  selector    text,
  rel_x       real,
  rel_y       real,
  breakpoint  text        not null check (breakpoint in ('mobile', 'tablet', 'desktop')),
  viewport_w  smallint,
  viewport_h  smallint,
  pointer     text        check (pointer in ('mouse', 'touch')),
  created_at  timestamptz not null default now()
);
create index if not exists heatmap_event_path_bp_el_idx on heatmap_event (path, breakpoint, element_id);
create index if not exists heatmap_event_created_idx on heatmap_event (created_at);
alter table heatmap_event enable row level security;
create or replace view heatmap_element_stats as
select path, breakpoint, element_id,
       count(*) filter (where kind = 'click')      as clicks,
       count(*) filter (where kind = 'impression') as impressions,
       max(created_at)                             as last_seen
from heatmap_event
where element_id is not null
group by path, breakpoint, element_id;
