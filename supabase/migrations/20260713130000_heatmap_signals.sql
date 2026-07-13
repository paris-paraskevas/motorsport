-- Phase 2 heatmap signals: scroll-depth + rage/dead-click frustration.
-- Extends the kind check with 'scroll' | 'rage' | 'dead', adds a scroll-depth
-- `value` column (0..1), and an index for the per-path per-kind reads.
-- Additive + idempotent. The app already emits these kinds and is fail-soft:
-- until this is applied, a batch carrying a new kind is retried with only the
-- click/impression rows (see lib/heatmap.ts recordEvents), so nothing regresses.
alter table heatmap_event add column if not exists value real;
alter table heatmap_event drop constraint if exists heatmap_event_kind_check;
alter table heatmap_event add constraint heatmap_event_kind_check
  check (kind in ('click', 'impression', 'scroll', 'rage', 'dead'));
create index if not exists heatmap_event_path_kind_idx on heatmap_event (path, kind, breakpoint);
