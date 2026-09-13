-- 0018_retail_module.sql
--
-- A `retail` module flag, so the shop-orders screen appears for a practice that
-- sells products and not for one that does not.
--
-- The module map is how this system says "these two tenants are different
-- businesses" without branching on practice_type everywhere. A men's health
-- clinic with no retail line should not carry a permanently empty "Shop orders"
-- item in its navigation — an empty screen in a rail reads as a broken feature,
-- and it teaches staff to ignore a section of the menu.
--
-- Set from the shape of the catalogue rather than asserted: a practice has
-- retail if it has products. That way a second med spa added next month gets
-- the right answer without anyone remembering to write a migration.

begin;

update clinic c
   set modules = c.modules || jsonb_build_object(
         'retail',
         exists (select 1 from product p where p.clinic_id = c.id and p.active)
       );

commit;
