# 05 — Data Model

PHI classification is on every entity **now**, even though compliance controls land in
Phase C. The point is that Phase C becomes a hardening pass, not a migration.

`PHI` = protected health information. `IDENT` = identifying but not clinical.
`OPS` = neither.

---

## Core entities

### patient — PHI
```
id, created_at
first_name, last_name, dob, email, phone            IDENT
address_*                                            IDENT
preferred_name, communication_prefs                  IDENT
emergency_contact_*                                  IDENT
status: lead|consulted|active|paused|churned         OPS
acquisition_source, acquisition_campaign             OPS
external_emr_id                                      IDENT   -- link out, never duplicate clinical record
privacy_flags: biometric_lock, hide_sensitive        OPS
```

### lead — IDENT
```
id, created_at, name, email, phone
source (16 values, mirrors corporate form)
consent_transactional_sms, consent_marketing_sms, consent_email
consent_captured_at, consent_ip, consent_text_shown  -- TCPA evidence, non-negotiable
first_response_at                                     -- speed-to-lead measurement
status, converted_patient_id
```
Separate from `patient` on purpose: a lead is not yet a patient, and treating it as one
pollutes clinical counts and complicates deletion.

### appointment — PHI
`reason` is PHI. "ED consult" attached to a named person is a diagnosis disclosure.
```
id, patient_id, provider_id, service_id
starts_at, ends_at, status: booked|confirmed|arrived|complete|no_show|cancelled
booking_channel, deposit_payment_id
reason_code                                          PHI
intake_submission_id, created_by
```

### service — OPS
```
id, name, category, duration_min, price_cents
requires_labs, requires_consent, is_membership, active
```
Seed from the catalogue in `01-audit-findings.md`.

### intake_submission — PHI
```
id, patient_id, appointment_id, template_version
submitted_at, signed_at, signature_ref
answers (jsonb)                                      PHI
```
Version the template. A consent signed against v3 must be reproducible as v3 forever.

### lab_panel / lab_result — PHI
```
lab_panel:  id, patient_id, drawn_at, source: in_clinic|external,
            entered_by, document_ref

lab_result: id, panel_id, analyte, value_numeric, unit,
            ref_low, ref_high, target_low, target_high, flag
```
Two range pairs on purpose. **Reference range** is the lab's population normal;
**target range** is what this clinic optimises toward. They differ, and conflating them
is how a patient panics over a value his provider is happy with.

Analytes to seed: total_testosterone, free_testosterone, shbg, estradiol_sensitive,
hematocrit, hemoglobin, psa, lh, fsh, tsh, a1c, glucose_fasting, ldl, hdl,
triglycerides, alt, ast, creatinine, vitamin_d.

### protocol / protocol_change — PHI
```
protocol:        id, patient_id, status, started_at, ended_at
protocol_item:   id, protocol_id, medication_name, dose_amount, dose_unit,
                 route, frequency, notes
protocol_change: id, protocol_id, changed_at, changed_by,
                 field, old_value, new_value,
                 reason_clinical, reason_patient_facing
```
`protocol_change` is what plots the dose markers on the Stat Sheet. Two reason fields:
the clinical note and the plain-language version published to the patient. Never show a
patient a raw clinical note.

**Hard rule:** this table records what was prescribed elsewhere. It is not a
prescribing system. No transmission to any pharmacy, ever.

### checkin — PHI
```
id, patient_id, week_of, submitted_at
energy, libido, sleep_quality, mood, gym_performance, mental_clarity   -- 1-10
weight_lbs, notes_free_text                                            PHI
missed_doses_count
```
Fixed 1–10 scales across all dimensions so they chart on one axis. Keep the free-text
field short and label it clearly — patients will write clinically significant things in
it and someone must read them.

### photo_series / photo — PHI (highest sensitivity)
```
photo_series: id, patient_id, series_type: hair|body|face, capture_guide_ref
photo:        id, series_id, captured_at, storage_ref,
              pose_key, guide_version, reviewed_by
```
Never in a public bucket. Never CDN-cached. Signed URLs, short TTL, no EXIF geotags —
strip EXIF on upload. `pose_key` + `guide_version` are what make the ghost-overlay
comparison actually align.

### message_thread / message — PHI
```
thread:  id, patient_id, triage_tag: clinical|scheduling|billing|other,
         status, assigned_to
message: id, thread_id, sender_type: patient|staff, sender_id,
         body, sent_at, read_at
```

### membership / payment — IDENT + OPS
```
membership: id, patient_id, plan_id, status: active|paused|cancelled,
            started_at, paused_at, cancelled_at,
            cancel_reason_code, cancel_reason_text, mrr_cents

payment:    id, patient_id, amount_cents, type, processor_ref,
            status, created_at
```
`cancel_reason_code` is what makes churn cohorts useful instead of decorative. Enumerate
it: cost, no_perceived_benefit, side_effects, moved, went_elsewhere, life_event, other.

**Hard rule:** no PHI in any payment-processor field — not metadata, not descriptors,
not line-item names. "Monthly membership," never "TRT — testosterone cypionate."

### inventory_item / inventory_transaction — OPS
```
item:        id, name, category, is_controlled, schedule, unit, reorder_threshold
lot:         id, item_id, lot_number, expiry_date, qty_received, qty_remaining
transaction: id, lot_id, type: received|administered|wasted|expired,
             qty, patient_id, performed_by, occurred_at, witness_id
```

### Supporting
```
provider:        id, name, credentials, npi, photo_ref, bio, active
staff_user:      id, name, email, role: owner|provider|front_desk, active, mfa_enabled
audit_log:       id, actor_id, actor_role, action, entity_type, entity_id,
                 occurred_at, ip, user_agent          -- append-only, Phase C enforced
automation_run:  id, rule_key, patient_id, triggered_at, channel, status, payload_ref
consent_record:  id, patient_id, type, granted, text_version, captured_at, ip
```

---

## Relationships that matter

```
patient 1—n appointment 1—1 intake_submission
patient 1—n lab_panel 1—n lab_result
patient 1—n protocol 1—n protocol_item
                     1—n protocol_change     -> Stat Sheet dose markers
patient 1—n checkin                          -> Stat Sheet score lines
patient 1—n photo_series 1—n photo
patient 1—1 membership 1—n payment
lead    0—1 patient                          -> attribution chain
```

The **Stat Sheet** is a single query joining `checkin`, `lab_panel`, and
`protocol_change` on `patient_id` ordered by date. Building the schema around that one
query is the right call, because it is the feature the whole retention thesis rests on.

## Phase C hardening (schema already ready for it)

- RLS on every PHI table keyed to `patient_id` / staff role
- `audit_log` triggers on all PHI reads and writes
- Column-level encryption on `photo.storage_ref`, `intake_submission.answers`,
  `checkin.notes_free_text`
- Soft-delete + retention policy per entity
- PHI/non-PHI schema separation so analytics can query ops data without touching PHI
- Break-glass access flow with mandatory justification
