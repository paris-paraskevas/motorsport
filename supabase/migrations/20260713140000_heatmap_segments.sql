-- Phase 3 heatmap segments: anonymous entry-source + new/returning columns, so
-- /admin can slice the heatmap by segment (never read "the average visitor").
-- Additive + idempotent. The app already emits these; recordEvents falls back to
-- the original columns until this is applied, so capture never regresses.
alter table heatmap_event add column if not exists source text;
alter table heatmap_event add column if not exists visitor text;
alter table heatmap_event drop constraint if exists heatmap_event_source_check;
alter table heatmap_event add constraint heatmap_event_source_check
  check (source is null or source in ('direct', 'organic', 'referral', 'campaign', 'internal'));
alter table heatmap_event drop constraint if exists heatmap_event_visitor_check;
alter table heatmap_event add constraint heatmap_event_visitor_check
  check (visitor is null or visitor in ('new', 'returning'));
create index if not exists heatmap_event_path_seg_idx on heatmap_event (path, source, visitor);
