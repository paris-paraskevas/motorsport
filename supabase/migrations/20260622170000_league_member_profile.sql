-- Paddock — per-member league profile: a nickname + colour, settable by ANY
-- member of the league (operator decision). Rendered on the league page; the
-- nickname overrides the display name within that league.
alter table league_member add column if not exists nickname text;
alter table league_member add column if not exists color text;
