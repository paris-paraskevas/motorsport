-- Phase 2, step 8 of the designer plan: Appearance (APEX: User Interface
-- Attributes). The application row gains `ui`, one JSON document holding the
-- typography and shape tokens the site reads at render: the four faces by role
-- (body, headline, data, names), the root font size, the body leading, the
-- spacing unit, the corner radius and the motion setting.
--
-- ONE DOCUMENT, NOT ROWS. A change of size, face and leading lands together or
-- not at all: the write path is a single conditional update on the row's
-- `updated_at` (the 1.0.25 pattern), so two people cannot half-overwrite each
-- other. lib/design/appearance-defaults.ts is the reader; every key it does not
-- know or cannot use falls back to the value the code shipped, and an empty
-- document means exactly what the site shipped.
--
-- Idempotent: re-applying changes nothing. The 'paddock' row exists since
-- 20260908090000.
begin;

alter table application add column if not exists ui jsonb not null default '{}'::jsonb;

commit;
