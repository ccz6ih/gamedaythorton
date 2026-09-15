-- 0034_appointment_location.sql
-- Where the appointment actually is.
--
-- ===========================================================================
-- WHY THIS IS NOT A SECOND CLINIC
-- ===========================================================================
-- Gameday Thornton already exists in this database as its own clinic row, with
-- its own patients, prices and console. That is the right model for a separate
-- business and the wrong one for this: Jamie is not moving her practice, she is
-- seeing HER client, on HER books, at HER prices, in somebody else's room for
-- an afternoon.
--
-- Filing that appointment under Gameday would put her client in Gameday's
-- patient list and her money in Gameday's takings. So a location is an
-- attribute of the appointment, not a tenancy.
--
-- ===========================================================================
-- WHY IT IS A TABLE AND NOT A TEXT COLUMN
-- ===========================================================================
-- Because the address has to reach the client. `appointment.room` is free text
-- and holds "3"; that is fine for a room, and useless for the thing that
-- actually matters here — the confirmation email saying where to drive.
--
-- A wrong address in a confirmation is worse than no address: a client who sees
-- nothing looks it up, and a client who sees Loveland drives to Loveland while
-- the practitioner is in Northglenn.
--
-- So each location carries its own address and that is what the email renders.

begin;

create table if not exists location (
  id           uuid primary key default gen_random_uuid(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  clinic_id    uuid not null references clinic(id) on delete cascade,

  name         text not null,
  -- Written as one block rather than parsed into fields. It goes into an email
  -- and onto a map link; nothing here needs to sort by postcode.
  address      text,
  note         text,

  /** The one assumed when nobody picks. Exactly one per clinic — see below. */
  is_default   boolean not null default false,
  active       boolean not null default true,
  sort_order   int not null default 0,
  synthetic    boolean not null default false
);

comment on table location is
  'Somewhere a clinic sees clients. Not a tenant: same books, same prices, '
  'different room. The address is what a confirmation email renders.';

-- At most one default per clinic, enforced rather than trusted. Two defaults
-- means the email address depends on row order.
create unique index if not exists location_one_default_per_clinic
  on location (clinic_id) where is_default;

create index if not exists location_clinic_idx on location (clinic_id, active, sort_order);

alter table appointment
  add column if not exists location_id uuid references location(id);

comment on column appointment.location_id is
  'Where this one is happening. Null means the clinic default, which is what '
  'every appointment booked before locations existed means.';

create index if not exists appointment_location_idx on appointment (location_id);

-- ---------------------------------------------------------------------------
-- RLS: same shape as every other tenant table
-- ---------------------------------------------------------------------------
alter table location enable row level security;

drop policy if exists location_staff_read on location;
create policy location_staff_read on location
  for select using (
    exists (
      select 1 from staff_user su
       where su.auth_user_id = auth.uid()
         and su.clinic_id = location.clinic_id
         and su.active
    )
  );

drop policy if exists location_staff_write on location;
create policy location_staff_write on location
  for all using (
    exists (
      select 1 from staff_user su
       where su.auth_user_id = auth.uid()
         and su.clinic_id = location.clinic_id
         and su.active
    )
  );

-- The storefront reads locations only through named column grants, and only
-- the ones a client could legitimately be sent to. No note, no synthetic flag.
grant select (id, clinic_id, name, address, is_default, active, sort_order)
  on location to anon;

-- ---------------------------------------------------------------------------
-- Seed: where The Med Bar actually works
-- ---------------------------------------------------------------------------
insert into location (clinic_id, name, address, is_default, sort_order)
select c.id,
       c.name,
       concat_ws(', ', c.address_line1, c.address_line2, c.address_city,
                       c.address_state, c.address_zip),
       true,
       0
  from clinic c
 where c.slug = 'medbar-loveland'
   and not exists (select 1 from location l where l.clinic_id = c.id);

-- The collaboration. Its address is read from Gameday's own clinic row rather
-- than typed here, so it cannot drift from the other tenant's record.
insert into location (clinic_id, name, address, is_default, sort_order)
select med.id,
       'Gameday Men''s Health — Northglenn',
       concat_ws(', ', gd.address_line1, gd.address_line2, gd.address_city,
                       gd.address_state, gd.address_zip),
       false,
       1
  from clinic med, clinic gd
 where med.slug = 'medbar-loveland'
   and gd.slug = 'gameday-thornton'
   and not exists (
     select 1 from location l
      where l.clinic_id = med.id and l.name like 'Gameday%'
   );

commit;
