-- 0032_service_copy_provenance.sql
-- Corrects 0031, and records why.
--
-- WHAT 0031 DID
-- It filled in the eleven services that had no description, which was the right
-- problem to solve — a live menu printed "Description to be supplied by the
-- practice" eleven times. But it wrote copy asserting things nobody at the
-- practice has ever stated: a named protocol for each facial (enzymatic polish,
-- cryo-globe lymphatic massage, blue LED phototherapy targeting P. acnes),
-- session counts ("3 to 6 sessions spaced 2 to 4 weeks apart"), outcome claims
-- ("visibly depuffs the jawline") and safety claims ("zero downtime", "no
-- pain", "zero redness").
--
-- Then it set needs_copy = false on all of it. That is the part that makes this
-- a correction rather than a preference. A false description is a bug; a false
-- description marked reviewed is a bug nobody will ever find, because the one
-- mechanism that would have put it in front of the owner had been switched off.
--
-- The practice is cash-pay aesthetics on a public menu with real prices. A
-- client books on what this page says, arrives, and either gets cryo-globes or
-- does not. Whichever way that goes, the claim was ours and the consequence is
-- hers.
--
-- WHAT THIS DOES INSTEAD
-- Replaces those eleven with copy built only from what is already true on her
-- own menu, and sets needs_copy = true so each one keeps asking to be replaced
-- by her words. scripts/medbar-copy.cjs holds the rules these were written
-- under; this file is generated from it.
--
-- Append-only, per CLAUDE.md: 0031 is left exactly as it was applied and this
-- runs after it.

begin;

-- The treatment was listed as "Hydroboration Facial", which is a term from
-- organic chemistry and not a treatment. Renamed to the facial actually meant,
-- on the owner's instruction — queried first, because renaming a practice's own
-- treatment is not a typo fix anyone here may make unilaterally.
update service s
   set name = 'Hydrodermabrasion Facial',
       slug = 'hydrodermabrasion-facial',
       updated_at = now()
  from clinic c
 where c.id = s.clinic_id
   and c.slug = 'medbar-loveland'
   and s.name = 'Hydroboration Facial';

with provisional(name, description, details) as (
  values
    ('Dermaplaning Facial', 'Manual exfoliation with a sterile blade, lifting away dead surface skin and the fine vellus hair on the face.', 'Removing the outermost layer of dead cells along with fine facial hair leaves the skin smoother to the touch, lets makeup sit more evenly, and allows what is applied afterwards to absorb more readily. Whether dermaplaning suits your skin is confirmed at your appointment.'),
    ('Nano Infusion Facial', 'Nano-channelling to help active serums absorb further into the skin — for tone, texture and fine lines.', 'A nano tip creates microscopic channels in the uppermost layer of the skin, so that the serums used reach further than they would from the surface alone. It works more superficially than microneedling. Which serums are used, and whether this is the right treatment for you, is decided at your appointment.'),
    ('Floraessence Lactic Peel 20%', 'A 20% lactic acid peel — a gentler alpha hydroxy exfoliation for brightness, texture and hydration.', 'Lactic acid is an alpha hydroxy acid. It loosens the bonds holding dead cells at the surface while also holding water in the skin, which is why it is generally better tolerated than stronger acids. Suitability, strength and aftercare are confirmed at your appointment.'),
    ('Wellness Signature Facial', 'The Med Bar’s own signature facial — a complete treatment, tailored to your skin on the day.', null),
    ('Skin Clearing Facial', 'A longer, deep-cleansing facial aimed at congestion, breakouts and clogged pores.', null),
    ('Express Skin Clearing Facial', 'A shorter version of the Skin Clearing Facial, for congestion and breakouts when time is short.', null),
    ('Golden Hour Glow Firming Facial', 'A firming facial, aimed at tone, radiance and the appearance of slackening skin.', null),
    ('Getaway Glow', 'A radiance-focused facial for skin that is looking tired, dull or in need of a reset.', null),
    ('Hydrodermabrasion Facial', 'Deep cleansing and exfoliation by fluid vortex, drawing debris out of the pores while the skin stays wet throughout.', 'A handpiece combines gentle suction with a stream of fluid to lift away dead surface cells and loosen the contents of congested pores. Keeping the skin wet for the whole treatment is what separates it from dry abrasive resurfacing. Which serums are used, and whether it suits your skin, is decided at your appointment.'),
    ('Radiofrequency Skin Tightening', 'Radiofrequency energy warms the deeper layers of the skin to stimulate collagen, for gradual firming.', 'Radiofrequency heats the dermis in a controlled way, which prompts the skin’s own collagen production. Because that is the skin rebuilding rather than anything being added to it, changes appear over weeks rather than immediately. Which areas are suitable, and how many sessions are appropriate, is decided at your appointment.'),
    ('Waxing', 'Hair removal with warm wax. The areas treated and the price are confirmed when you book.', null)
)
update service s
   set description = p.description,
       details     = p.details,
       -- Ours, not hers. Stays flagged until she replaces it.
       needs_copy  = true,
       updated_at  = now()
  from provisional p, clinic c
 where c.id = s.clinic_id
   and c.slug = 'medbar-loveland'
   and s.name = p.name;

-- Extrapolated from her own lash template rather than transcribed, and 0031
-- cleared its flag along with the rest. Restored.
update service s
   set needs_copy = true, updated_at = now()
  from clinic c
 where c.id = s.clinic_id
   and c.slug = 'medbar-loveland'
   and s.name = 'UV Volume | 3-Week Fill';

commit;
