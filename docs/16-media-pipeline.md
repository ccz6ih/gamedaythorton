# 16 — Media Pipeline

Logos, clinician headshots, clinic photos, patient photos, and progress-photo series.

Photos are the **highest-sensitivity asset in this system** — higher than lab values. A
lab number attached to a name is a disclosure; a photograph attached to a name is a
disclosure that cannot be de-identified after the fact. This document is why the pilot
handles them the way it does.

---

## The pilot rule

> **In the pilot, no image ever leaves the browser. There is no upload endpoint. None.**

Images are downscaled on a canvas and held in `localStorage` inside the overlay
(`store.js`). They are not transmitted, not stored on a server, not backed up, and not
visible to anyone on another device.

That is what makes it safe to hand this demo to a client before Phase C. A client who
uploads their own logo and clinician headshots has uploaded them to their own browser and
nowhere else. If they clear site data, they are gone — and that is the correct trade for
this phase.

**Patient progress photos in the pilot are generated placeholders**, visibly watermarked
`PLACEHOLDER`. A real patient photograph must not enter this build (`09-compliance-register.md`).

---

## Key convention

```
brand:logo                     the clinic's logo
brand:logo-light               optional variant for light surfaces
clinic:exterior                the building from the street
clinic:parking                 where to park
clinic:room                    a consult room
clinic:lobby                   the entrance
provider:<providerId>          clinician headshot
patient:<patientId>:avatar     patient photo, staff-side identification
photo:<photoId>                a Game Film frame
```

Adding a kind means adding it here first. Ad-hoc keys are how an image ends up
unreferenced and un-deletable.

---

## Ingestion, and why it re-encodes

`GD.media.fromFile()` draws the image onto a canvas and re-encodes it as JPEG. That does
three jobs at once:

1. **Caps the size.** Max edge 1000px (600 for headshots, 900 for progress frames), JPEG
   quality 0.82. A 12MB phone photo becomes ~80KB.
2. **Strips EXIF — including GPS.** A canvas re-encode drops all metadata. Phone cameras
   write GPS coordinates by default, so a patient's progress photo can otherwise carry the
   location of his house. This is a Phase C requirement that costs nothing to do now, so
   it is done now.
3. **Normalises the format.** HEIC, PNG, WebP all arrive as JPEG.

Headshots and avatars pass `square: true` for a centred square crop, so a portrait photo
does not arrive as a stretched oval.

### Limits and failures

| | |
|---|---|
| Rejected | Non-images, files over 25MB, undecodable files |
| Soft limit | 3.6MB total across all images (`localStorage` is ~5MB) |
| Near the limit | Settings → Demo data shows usage; a warning fires at 80% |
| Over the limit | `store.js` emits `storage-full` and the UI says which action to take |

Every failure path returns a message a non-technical person can act on. "That image is
over 25MB. Please pick a smaller one." — not a stack trace.

---

## Placeholders: generated, never shipped

**No image bytes are committed to this repo.** Every placeholder is an inline SVG data URL
built at render time.

| Function | Produces |
|---|---|
| `media.personSvg(initials, seed)` | Neutral head-and-shoulders mark, hue varied by seed |
| `media.bodySvg({progress, pose, caption})` | Silhouette with the ghost-overlay guide, watermarked PLACEHOLDER |
| `media.placeSvg(kind)` | Neutral building / parking / room illustration |
| `brand.faviconDataUrl()` | Accent-coloured monogram tile |

`bodySvg` takes a `progress` value 0–1 and narrows the silhouette slightly as it rises.
That is there so the Game Film compare slider demonstrates its mechanic before any real
photo exists. It is unmistakably an illustration and it is watermarked, because a
placeholder that could be mistaken for a patient photo is worse than no placeholder.

---

## The Game Film capture guide

Without a guide you get a pile of unusable selfies. With one you get a comparable series.
That distinction is the entire feature.

**What makes frames comparable:** `pose_key` and `guide_version` on every photo. The
overlay draws a centre line, two horizontals, and a framing rectangle; the patient lines
himself up with them. Same room, same light, same distance, same posture, relaxed not
flexed — a flexed photo compared against a relaxed one tells you nothing and will make a
patient think he has gone backwards.

**`guide_version` matters more than it looks.** If the guide changes, old frames were
captured against different geometry and are not strictly comparable to new ones. Version
it, store it per photo, and never silently compare across versions.

**Consent is per-series and revocable.** `photo_series.consent_ref` links to the consent
record. Photography consent is optional in the intake and separate from treatment consent,
because it genuinely is.

---

## Production (Phase C)

The pilot's approach does not scale, and it is not supposed to. What replaces it:

| Concern | Implementation |
|---|---|
| Storage | Supabase Storage, **private bucket**, under a signed BAA |
| Access | Short-TTL signed URLs, generated per request. **Never public, never CDN-cached** |
| Encryption | Column encryption on `photo.storage_ref` |
| EXIF | Stripped server-side on upload as well as client-side. Do not trust the client |
| Audit | Every photo read logged to `audit_log` with actor and reason |
| Retention | Per-entity policy; photo deletion must actually delete, including from backups |
| Consent | Revoking photo consent must make the series inaccessible, and that path needs a test |
| Thumbnails | Generated server-side into the same private bucket. A thumbnail of a progress photo is still a progress photo |

**The hard one is the CDN.** The default instinct for images is to put them behind a CDN
for speed. Do not. A cached progress photo is a copy of PHI on infrastructure outside the
BAA, and cache invalidation is not deletion.

---

## What the client should be asked for

From `11-discovery-questions.md` §9, restated with why:

| Asset | Why it matters |
|---|---|
| **Clinician headshots** | The single most effective anxiety reducer on the pre-visit card. The corporate "Meet Your Thornton Clinicians" section currently renders **"No items found"** — an empty CMS collection. These are needed regardless of what we build |
| **Clinic exterior** | He is looking for the building while anxious and possibly late |
| **Parking** | The FAQ answers this, which tells us it is a real objection |
| **A consult room** | Proves the privacy claim instead of asserting it |
| **Logo, correct files** | Ideally SVG or high-res transparent PNG |
| **Exact accent hex** | From the franchise brand kit, not sampled from a screenshot |

The corporate location page currently uses a hero image filed as
`flatiron-clinic-default` — another location's stock photo. Real photography of the actual
Thornton suite is cheap, fixes that, and feeds directly into the highest-converting screen
in the patient app.

---

## Agent checklist for media work

- [ ] New image kind added to the key convention above **before** it is used
- [ ] Ingested through `media.fromFile()` — never a raw `FileReader` result. A raw
      `readAsDataURL` keeps EXIF, and that is the whole point of the canvas step
- [ ] Every render path has a placeholder fallback; no broken image icons, no grey boxes
- [ ] Failure messages are actionable and written for a non-technical reader
- [ ] Nothing added to `prototype/assets/uploads/` — it is gitignored on purpose
- [ ] No image bytes committed
- [ ] If it touches patient photos, re-read the Phase C table above and note what will
      have to change
