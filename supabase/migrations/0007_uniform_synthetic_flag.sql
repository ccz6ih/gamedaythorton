-- ===========================================================================
-- 0007_uniform_synthetic_flag
--
-- protocol_item and treatment_detail were added to the pilot-mode guard list in
-- 0005 but never given a `synthetic` column, so every insert into them failed
-- with "record new has no field synthetic".
--
-- Fixed by adding the column rather than by removing those two tables from the
-- guard. Both are child rows whose parent is already guarded, so exempting them
-- would have been defensible — but an exception list inside a compliance control
-- is exactly where the next mistake hides. Every table in the list now has the
-- same shape and the guard needs no special cases.
-- ===========================================================================

alter table protocol_item    add column synthetic boolean not null default false;
alter table treatment_detail add column synthetic boolean not null default false;

-- Guard against this class of bug returning: any table carrying the pilot guard
-- must have the column the guard reads. Raises at migration time, not at the
-- first insert months later.
do $$
declare
  missing text[];
begin
  select coalesce(array_agg(distinct c.relname order by c.relname), '{}') into missing
  from pg_trigger t
  join pg_class c on c.oid = t.tgrelid
  join pg_proc p on p.oid = t.tgfoid
  where p.proname = 'assert_synthetic_in_pilot'
    and not exists (
      select 1 from information_schema.columns col
      where col.table_schema = 'public'
        and col.table_name = c.relname
        and col.column_name = 'synthetic'
    );

  if array_length(missing, 1) > 0 then
    raise exception 'Tables carry the pilot guard but have no synthetic column: %',
      array_to_string(missing, ', ');
  end if;
end;
$$;
