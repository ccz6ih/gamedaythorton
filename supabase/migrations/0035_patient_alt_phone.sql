-- 0035_patient_alt_phone.sql
-- A second number, for the cases where somebody has two.
--
-- ===========================================================================
-- WHY NOT emergency_contact_phone
-- ===========================================================================
-- Because that column means something specific: the number to ring when the
-- person in the chair cannot answer for themselves. Putting a client's own
-- second mobile in it is the kind of shortcut that works fine until the day it
-- matters, and then it is a number that nobody at the other end expects.
--
-- ===========================================================================
-- WHY IT IS NEEDED AT ALL
-- ===========================================================================
-- Merging two records for the same person. The practice's previous system held
-- Carlos Hernandez twice, with a different phone on each, and there is no way
-- to tell from here which one he answers — so both are kept and the practitioner
-- can find out.
--
-- It is also searchable: the roster search matches on digits, and a client who
-- rings from the number that was NOT kept should still be findable.

begin;

alter table patient
  add column if not exists phone_alt text;

comment on column patient.phone_alt is
  'A second number for the same person, e.g. recovered from merging duplicate '
  'records. NOT an emergency contact — that is emergency_contact_phone.';

commit;
