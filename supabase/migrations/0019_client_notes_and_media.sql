-- 0019_client_notes_and_media.sql
--
-- Treatment notes, client photographs, and a birthday that is actually a
-- birthday.
--
-- ===========================================================================
-- 1. NOTES ARE APPEND-ONLY
-- ===========================================================================
-- A treatment note that can be quietly rewritten after the fact is worth very
-- little. The whole value of writing down what was injected, where, and in what
-- quantity is that the record says what was true at the time — and a record
-- that can be edited later says only what somebody wants to be true now.
--
-- That matters most in exactly the situation nobody plans for: a client comes
-- back unhappy, and the note is the only account of what was agreed and what
-- was done. If it is editable, its value in that conversation is zero, and
-- worse, an honest correction made in good faith is indistinguishable from
-- covering something up.
--
-- So: UPDATE and DELETE are revoked from every role the application runs as.
-- A correction is a NEW note that points at the one it amends, and both are
-- shown. The practitioner can always say more; she can never make the earlier
-- version disappear.
--
-- This is the same reasoning as audit_log in 0004, applied to the one other
-- table where being able to rewrite history is the actual risk.
--
-- ===========================================================================
-- 2. TWO KINDS OF CLIENT PHOTOGRAPH, ONE PRIVATE BUCKET
-- ===========================================================================
--   a face photo, so the practitioner knows who is walking in
--   before-and-after frames attached to a treatment
--
-- Both are the client's likeness and both go in a PRIVATE bucket reached only
-- by short-lived signed URLs. Not the `brand` bucket, which is public and
-- correct for a logo. A public URL to a client's face is a disclosure that
-- cannot be withdrawn: it will be cached, and cache invalidation is not
-- deletion. docs/16-media-pipeline.md.
--
-- ===========================================================================
-- 3. THE BIRTHDAY
-- ===========================================================================
-- The previous system's export has a "Date of Birth" column that is not one —
-- every value carried the current year and four of them were in the future. It
-- is the NEXT birthday, not the date of birth. Importing it as `dob` would have
-- put eight wrong dates of birth in a medical-adjacent record, so it was left
-- empty and the month and day kept as a note.
--
-- A note is not usable: it cannot be sorted, filtered, or turned into "whose
-- birthday is this month". So month and day get real columns. The YEAR is
-- still absent, because we genuinely do not know it and inventing one would
-- recreate the original problem — and because a month and a day is all a
-- birthday greeting has ever needed.

begin;

-- ------------------------------------------------------------ birthdays ----

alter table patient
  add column if not exists birth_month smallint check (birth_month between 1 and 12),
  add column if not exists birth_day   smallint check (birth_day between 1 and 31);

comment on column patient.birth_month is
  'Birthday month, with no year. The year is genuinely unknown for imported '
  'clients — see 0019. Use this for greetings; use dob only where a real date '
  'of birth was collected.';

create index if not exists patient_birthday_idx
  on patient (clinic_id, birth_month, birth_day)
  where birth_month is not null;

-- ------------------------------------------------------- who is this? ----
-- A face on the client list. The practitioner has thirty-five clients and sees
-- some of them twice a year; recognising someone at the door is the difference
-- between a practice that feels personal and one that does not.

alter table patient
  add column if not exists photo_path text;

comment on column patient.photo_path is
  'Object path in the PRIVATE client-media bucket. Never a public URL — this '
  'is the client''s likeness. Reached only through a short-lived signed URL.';

-- ----------------------------------------------------------- client_note ----

create table if not exists client_note (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  clinic_id       uuid not null references clinic(id) on delete cascade,
  patient_id      uuid not null references patient(id) on delete cascade,

  -- Who wrote it. Never null in practice; nullable only so that removing a
  -- staff member does not delete the clinical record they wrote.
  author_staff_id uuid references staff_user(id) on delete set null,
  author_name     text not null,          -- snapshot: staff leave, notes stay

  -- Optional links. A note usually belongs to a visit, but a phone call about
  -- a reaction three days later is also a note and has no appointment.
  appointment_id  uuid references appointment(id) on delete set null,
  treatment_record_id uuid references treatment_record(id) on delete set null,
  service_id      uuid references service(id) on delete set null,
  service_name    text,                   -- snapshot, same reasoning as above

  -- When the treatment happened, which is not when the note was typed.
  performed_at    timestamptz not null default now(),

  kind            text not null default 'soap'
                    check (kind in ('soap', 'note', 'amendment')),

  -- SOAP. Nullable individually because a quick note is not a full SOAP and
  -- forcing four empty headings on somebody makes them stop writing notes.
  subjective      text,
  objective       text,
  assessment      text,
  plan            text,
  -- For kind='note': one free-text body instead of the four headings.
  body            text,

  -- Practical details a med spa actually records.
  products_used   text,
  units_total     numeric(10,2),
  areas_treated   text,
  aftercare_given boolean not null default false,
  adverse_event   boolean not null default false,
  follow_up_on    date,

  /**
   * The note this one corrects. Set only on kind='amendment'.
   *
   * An amendment never replaces anything: both rows stay and both are shown,
   * in order, so the reader sees what was originally written and what was
   * added later. That is what makes a correction trustworthy rather than
   * suspicious.
   */
  amends_id       uuid references client_note(id) on delete restrict,

  synthetic       boolean not null default false,

  constraint client_note_amendment_shape
    check ((kind = 'amendment') = (amends_id is not null)),
  constraint client_note_has_content
    check (
      coalesce(subjective, objective, assessment, plan, body) is not null
    )
);

create index if not exists client_note_patient_idx
  on client_note (patient_id, performed_at desc);
create index if not exists client_note_amends_idx
  on client_note (amends_id) where amends_id is not null;

select app.standard_policies('client_note', 'patient_id');

-- ------------------------------------------------------- APPEND ONLY ----
-- The policies above grant `for all`, which includes update and delete. These
-- revokes are what actually make the table append-only, and they are the point
-- of this migration.
--
-- Note there is deliberately no `updated_at` and no app.add_touch(): a column
-- recording when a row last changed is meaningless on a table whose rows do not
-- change, and its presence would imply they do.

revoke update, delete on client_note from authenticated, anon;

-- Belt and braces: even a future policy or a mistaken grant cannot get past a
-- trigger that refuses the operation outright.
create or replace function app.refuse_note_rewrite()
returns trigger
language plpgsql
as $$
begin
  raise exception
    'Treatment notes cannot be % once written. Add an amendment instead — it '
    'is shown alongside the original, which is what makes a correction '
    'trustworthy.', lower(tg_op)
    using errcode = 'insufficient_privilege';
end;
$$;

drop trigger if exists client_note_append_only on client_note;
create trigger client_note_append_only
  before update or delete on client_note
  for each row execute function app.refuse_note_rewrite();

comment on table client_note is
  'Treatment notes. APPEND ONLY — update and delete are revoked and a trigger '
  'refuses them. Corrections are new rows with amends_id set, and both are '
  'displayed. See the header of 0019 for why.';

-- --------------------------------------------------- photos on a note ----
-- `photo` already exists for structured progress series with capture geometry.
-- A before-and-after pair attached to one treatment is the same kind of object
-- with a simpler life, so it reuses the table — and therefore reuses its RLS,
-- its tenant scoping and its private-storage discipline — rather than getting a
-- near-duplicate table that would need all three re-proved.

alter table photo
  add column if not exists note_id uuid references client_note(id) on delete cascade;

alter table photo alter column series_id drop not null;

alter table photo drop constraint if exists photo_belongs_somewhere;
alter table photo add constraint photo_belongs_somewhere
  check (series_id is not null or note_id is not null);

create index if not exists photo_note_idx on photo (note_id) where note_id is not null;

comment on column photo.note_id is
  'Set for a before/after frame attached to a treatment note. Mutually '
  'optional with series_id — one or the other must be present.';

-- ------------------------------------------------- private media bucket ----
-- The counterpart the brand bucket's comment in 0011 promised: private, signed
-- access only, and never confusable with the public one.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'client-media', 'client-media', false, 15728640,
  array['image/png', 'image/jpeg', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 15728640,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/heic'];

-- Objects are laid out client-media/<clinic_id>/<patient_id>/<filename>, so
-- every policy is a prefix check against the staff member's own clinics.
--
-- There is NO anon policy of any kind. A client photograph has no public read
-- path, and the absence of that policy is the control.

drop policy if exists client_media_staff_read on storage.objects;
create policy client_media_staff_read on storage.objects
  for select to authenticated
  using (
    bucket_id = 'client-media'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

drop policy if exists client_media_staff_write on storage.objects;
create policy client_media_staff_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'client-media'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

drop policy if exists client_media_staff_update on storage.objects;
create policy client_media_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'client-media'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

-- Deleting a photograph IS allowed, unlike a note. A client who asks for their
-- photographs to be removed should get that, and an accidental upload of the
-- wrong person's face must be removable immediately.
drop policy if exists client_media_staff_delete on storage.objects;
create policy client_media_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'client-media'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

commit;
