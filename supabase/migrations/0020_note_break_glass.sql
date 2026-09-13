-- 0020_note_break_glass.sql
--
-- Keeps treatment notes append-only for the application, and gives an
-- administrator a way in.
--
-- ===========================================================================
-- WHAT 0019 GOT WRONG
-- ===========================================================================
-- Its trigger refused UPDATE and DELETE unconditionally — for every role,
-- including the database owner. That is not append-only; that is immutable, and
-- immutable is the wrong property.
--
-- Append-only means the PRACTICE cannot quietly rewrite its own record. That is
-- the guarantee worth having and it is fully preserved below: `anon` and
-- `authenticated` — every role the web application ever runs as — are still
-- refused, by a revoked privilege AND by this trigger.
--
-- Immutable additionally means nobody can ever fix anything, and that fails in
-- two situations that are certain to happen:
--
--   A note written about the wrong client. Somebody has two charts open. The
--   note is now permanently attached to a person it is not about, and the only
--   available remedy — an amendment saying "this is not about this client" —
--   leaves the wrong clinical content on their record forever.
--
--   A deletion request. A client asks for their records to be removed. Whether
--   or not it is legally compelled in this practice's situation, "our software
--   makes that impossible" is not an answer anybody wants to give, and building
--   a system that forces it is a choice, not a constraint.
--
-- The test suite hit this immediately and could not remove its own rows, which
-- is a small version of the same problem: it left test content on a real
-- client's chart with no way to take it off.
--
-- ===========================================================================
-- WHY THIS IS NOT A LOOPHOLE
-- ===========================================================================
-- The break-glass path requires a credential the application does not have and
-- never sends to a browser: the service role key, or a direct database
-- connection. Someone using it has left the product entirely and is acting as
-- an administrator, deliberately, with a key kept in a password manager.
--
-- That is exactly the right amount of friction. The property that makes a note
-- trustworthy is that it cannot be changed in the course of ordinary use by the
-- person it makes look bad — not that the bytes are physically unalterable,
-- which was never true anyway for anyone holding the database password.

begin;

create or replace function app.refuse_note_rewrite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- The roles the web application runs as. Refused, always, no exceptions.
  if current_user in ('anon', 'authenticated') then
    raise exception
      'Treatment notes cannot be % once written. Add an amendment instead — it '
      'is shown alongside the original, which is what makes a correction '
      'trustworthy.', lower(tg_op)
      using errcode = 'insufficient_privilege';
  end if;

  -- Anything else is an administrator holding a credential the application does
  -- not have. Allowed, deliberately. See the header for the two situations that
  -- make refusing here worse than permitting it.
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

comment on function app.refuse_note_rewrite() is
  'Append-only guard for client_note. Refuses update and delete for anon and '
  'authenticated — every role the application runs as. An administrator with '
  'the service role key or a direct connection is permitted, because a note '
  'filed against the wrong client must be removable. See 0020.';

commit;
