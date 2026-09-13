-- 0011_storefront_selfserve.sql
--
-- Everything a practice needs to run its own public page without a developer:
-- where enquiries go, which payment account takes the money, and somewhere to
-- put images.
--
-- ------------------------------------------------------------------------
-- WHY THERE IS NO stripe_secret_key COLUMN HERE
-- ------------------------------------------------------------------------
-- The obvious design is "give each clinic a field for its Stripe keys". Do not
-- do that. A secret key in a database row is a secret at rest, readable by
-- anyone with database access, present in every backup, and printed by any
-- careless select *. It also means WE hold the ability to move money for three
-- separate businesses.
--
-- These are separate legal entities — a franchise LLC and a med spa LLC cannot
-- share a payout account, which docs/22 already flagged. Stripe Connect exists
-- for exactly this: each practice connects its own Stripe account, Stripe keeps
-- their credentials, money settles to their bank, and we store nothing but the
-- account id (acct_...), which is an identifier rather than a secret.
--
-- So: stripe_account_id is safe to store and is stored. Secret keys stay in the
-- platform environment and belong to one account — ours.

begin;

-- ------------------------------------------------------- where leads go ----

alter table clinic
  add column if not exists lead_email      citext,
  add column if not exists lead_sms_to     text,
  add column if not exists stripe_account_id  text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists logo_path       text,
  add column if not exists hero_path       text;

comment on column clinic.lead_email is
  'Where storefront enquiries are sent. While PILOT_MODE is on nothing is '
  'actually sent — automation_run records what would have gone out.';

comment on column clinic.stripe_account_id is
  'Stripe Connect account id (acct_...) for THIS practice. An identifier, not a '
  'secret. Separate legal entities need separate payout accounts; no secret key '
  'is ever stored in this database.';

comment on column clinic.logo_path is
  'Public marketing asset. A leading slash means /public; otherwise a path in '
  'the brand storage bucket. Never patient media.';

alter table service
  add column if not exists image_path text;

comment on column service.image_path is
  'Optional image for the storefront menu. Marketing asset, public by design. '
  'A service with none falls back to a drawn line-art mark.';

-- ------------------------------------------------------- brand storage ----
-- ONE bucket, public, for marketing assets only: logos, hero images, service
-- photography, practitioner headshots.
--
-- Patient media does NOT go here and cannot be made to by accident: photo and
-- photo_series carry their own storage_path pointing at a private bucket that
-- does not exist yet and will be created with signed-URL access only when it
-- does. docs/16-media-pipeline.md. The separation is the point — a public
-- bucket is the correct home for a logo and a catastrophic one for a progress
-- photograph.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'brand', 'brand', true, 5242880,
  array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']
)
on conflict (id) do update
  set public = true,
      file_size_limit = 5242880,
      allowed_mime_types = array['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

-- Objects are laid out as brand/<clinic_id>/<filename>, so a clinic's write
-- policy is a prefix check. Staff may write only inside their own folder; the
-- world may read, because that is what a logo is for.

drop policy if exists brand_public_read on storage.objects;
create policy brand_public_read on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'brand');

drop policy if exists brand_staff_write on storage.objects;
create policy brand_staff_write on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'brand'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

drop policy if exists brand_staff_update on storage.objects;
create policy brand_staff_update on storage.objects
  for update to authenticated
  using (
    bucket_id = 'brand'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

drop policy if exists brand_staff_delete on storage.objects;
create policy brand_staff_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'brand'
    and (storage.foldername(name))[1]::uuid in (select app.staff_clinic_ids())
  );

-- --------------------------------------------------------- anon access ----
-- 0009 revoked everything on these tables from anon and grants columns by name,
-- so a new column is invisible until it is named here. That is the safe
-- direction, and it is why this block exists.

grant select (logo_path, hero_path) on clinic to anon;
grant select (image_path) on service to anon;

-- lead_email, lead_sms_to, stripe_account_id and stripe_charges_enabled are
-- deliberately NOT granted. Where a practice's enquiries land and which payment
-- account it uses are operational details, not storefront content.

commit;
