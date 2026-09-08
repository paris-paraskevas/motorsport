-- The alive search placeholder (operator, 2026-09-08 afternoon): the header's
-- search field cycles, a minute apart and only after the first paint, through
-- questions people actually ask, each one verified when it is saved to lead
-- somewhere on the site (the search index finds a page for it). The questions
-- are rows the operator keeps in the designer; `nav.search` stays the text the
-- cached render carries for everyone and the field's spoken label.
--
-- `leads_to` and `leads_title` record what the search found when the question
-- was saved, so the editor can say where a question goes and a question that
-- stops leading anywhere can be found. No function: a hint is one row, and its
-- write path is a single conditional statement through the API (updated_at
-- equality, the 1.0.25 pattern). Idempotent.
begin;

create table if not exists search_hint (
  id              uuid primary key default gen_random_uuid(),
  application_key text not null default 'paddock' references application(key),
  question        text not null,
  seq             int not null default 0,
  leads_to        text,
  leads_title     text,
  updated_at      timestamptz not null default now(),
  updated_by      text
);

create index if not exists search_hint_order_idx on search_hint (application_key, seq);

create or replace trigger search_hint_updated_at before update on search_hint for each row execute function design_set_updated_at();

alter table search_hint enable row level security;
revoke all on table search_hint from anon, authenticated;

commit;
