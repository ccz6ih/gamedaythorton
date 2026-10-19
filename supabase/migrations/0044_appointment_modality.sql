-- 0044_appointment_modality.sql
-- In person, on the phone, or on video — and say so.
--
-- ===========================================================================
-- WHAT WENT WRONG
-- ===========================================================================
-- A consultation came in and Jamie could not tell whether she was meant to be
-- at the studio, at Northglenn, on the phone, or on a video call. She was not
-- missing it in the email: the email could not say, because nothing in the
-- system knew.
--
-- There was no modality anywhere. A 15-minute consult booked online got
-- location_id NULL, which means "the usual place" — a default that is right
-- for a facial and a guess for a consult. And the notice that reaches her
-- listed Treatment, When, Contact and nothing about WHERE at all.
--
-- ===========================================================================
-- TWO COLUMNS, NOT ONE
-- ===========================================================================
-- `service.default_modality` is how that treatment is normally delivered. A
-- consult may be a phone call by default; microneedling never is.
--
-- `appointment.modality` is how THIS one is happening, copied from the service
-- at booking and changeable after. The default has to be overridable, because
-- the whole point is the consult that is on Zoom this once.
--
-- Storing only the service default would mean changing a service retroactively
-- rewrites what happened at appointments already in the calendar — a record
-- quietly becoming untrue.
--
-- ===========================================================================
-- EVERYTHING DEFAULTS TO in_person, DELIBERATELY
-- ===========================================================================
-- That is what every existing row actually was, so the backfill states a fact
-- rather than inventing one. Jamie changes the consult's default herself in
-- Services & pricing; guessing it here would put a wrong answer in front of
-- her with the same confidence as a right one, which is the bug being fixed.

begin;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'appointment_modality') then
    create type appointment_modality as enum ('in_person', 'phone', 'video');
  end if;
end $$;

alter table service
  add column if not exists default_modality appointment_modality not null default 'in_person';

alter table appointment
  add column if not exists modality appointment_modality not null default 'in_person',
  -- Only meaningful for video, and deliberately per-appointment: a standing
  -- room link that turns out to be stale is worse than no link.
  add column if not exists meeting_url text;

comment on column service.default_modality is
  'How this treatment is normally delivered. Copied onto an appointment at '
  'booking; changing it never rewrites appointments already made.';

comment on column appointment.modality is
  'How THIS appointment happens. Copied from the service default and '
  'overridable — the point is the consult that is on video just this once.';

comment on column appointment.meeting_url is
  'Video link for this one appointment. Null for in person and phone.';

/* ------------------------------------------- what the notifications read ---- */

/**
 * One sentence describing where to be, assembled in one place.
 *
 * Every surface that tells somebody about an appointment needs the same
 * sentence — the practice's notice, the client's confirmation, the reminder,
 * the console. Four hand-written versions would disagree within a month, and
 * the one that disagrees is the one that sends a client to the wrong town.
 */
create or replace function app.appointment_where(p_appointment uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'modality', a.modality::text,
    'label',
      case a.modality
        when 'phone' then 'Phone call'
        when 'video' then 'Video call'
        else coalesce(l.name, c.name)
      end,
    'detail',
      case a.modality
        when 'phone' then coalesce(p.phone, 'no number on file')
        when 'video' then coalesce(a.meeting_url, 'link to be sent')
        -- The address only when it is NOT the usual room. Repeating an address
        -- somebody has driven to six times is noise; omitting it the once it
        -- changed sends them to the wrong place.
        else case when l.id is not null and not l.is_default then l.address end
      end,
    'is_default_place', coalesce(l.is_default, true)
  )
  from public.appointment a
  join public.clinic c on c.id = a.clinic_id
  left join public.location l on l.id = a.location_id
  left join public.patient p on p.id = a.patient_id
  where a.id = p_appointment;
$$;

revoke all on function app.appointment_where(uuid) from public, anon, authenticated, service_role;
grant execute on function app.appointment_where(uuid) to authenticated, service_role;

commit;
