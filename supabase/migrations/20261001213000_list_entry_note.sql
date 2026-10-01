-- R18 PR C (2026-10-01): the sentence a card draws under a list entry's words, written in the list editor (at most 120
-- characters; the shell's lists carry none). The save function is re-created whole with the column: its one definition is
-- 20260908130000's, an applied migration never edited.
alter table list_entry add column if not exists note text;
alter table list_entry drop constraint if exists list_entry_note_length;
alter table list_entry add constraint list_entry_note_length check (note is null or char_length(note) <= 120);

create or replace function design_save_list(
  p_application text,
  p_key text,
  p_expected timestamptz,
  p_entries jsonb,
  p_actor text
) returns timestamptz
language plpgsql as $$
declare
  v_touched int;
  v_stamp timestamptz;
begin
  -- The version check. The update fires design_set_updated_at, so the row's stamp
  -- moves to now(); a caller holding an older stamp, or naming a list that does
  -- not exist, touches nothing.
  update list
     set updated_by = p_actor
   where application_key = p_application and key = p_key and updated_at = p_expected;
  get diagnostics v_touched = row_count;
  if v_touched = 0 then
    raise exception 'stale' using errcode = 'P0001',
      hint = 'The list changed since it was loaded, or does not exist.';
  end if;

  delete from list_entry where application_key = p_application and list_key = p_key;

  insert into list_entry (application_key, list_key, seq, label, dest_key, icon, authz_key, condition, note, updated_by)
  select p_application, p_key, (e.ord * 10)::int,
         e.value ->> 'label', e.value ->> 'dest_key',
         nullif(e.value ->> 'icon', ''), nullif(e.value ->> 'authz_key', ''),
         e.value -> 'condition', nullif(e.value ->> 'note', ''), p_actor
    from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) with ordinality as e(value, ord);

  select updated_at into v_stamp from list where application_key = p_application and key = p_key;
  return v_stamp;
end $$;

-- Service role only, like the tables it writes.
revoke all on function design_save_list(text, text, timestamptz, jsonb, text) from public, anon, authenticated;
grant execute on function design_save_list(text, text, timestamptz, jsonb, text) to service_role;
