'use server';

/**
 * Writing a treatment note, amending one, and attaching photographs.
 *
 * Everything here runs as the signed-in staff member through the
 * session-scoped client, so RLS decides what they may touch. Nothing uses the
 * service role: a note is written by a person, about a client of their own
 * practice, and the database is perfectly capable of checking both.
 *
 * THERE IS NO UPDATE ACTION AND THERE MUST NOT BE. `client_note` revokes UPDATE
 * and a trigger refuses it, so an edit action could not work even if somebody
 * wrote one — but the more useful statement is why nobody should try. See the
 * header of migration 0019.
 */

import { revalidatePath } from 'next/cache';
import { serverClient, currentViewer } from '@/lib/supabase/server';
import { uploadClientPhoto, deleteClientPhoto } from '@/lib/client-media';

export type NoteResult = { ok: true } | { ok: false; error: string };

function text(form: FormData, key: string): string | null {
  const value = String(form.get(key) ?? '').trim();
  return value === '' ? null : value;
}

/**
 * A new treatment note.
 *
 * The four SOAP headings are individually optional. Forcing all of them turns a
 * thirty-second record of "touched up the left brow, 4 units" into a form nobody
 * fills in — and a practice that stops writing notes because the form is
 * tedious has worse records than one with short ones.
 */
export async function addNote(patientId: string, form: FormData): Promise<NoteResult> {
  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') return { ok: false, error: 'Not signed in as staff.' };

  const supabase = await serverClient();

  const subjective = text(form, 'subjective');
  const objective = text(form, 'objective');
  const assessment = text(form, 'assessment');
  const plan = text(form, 'plan');
  const body = text(form, 'body');

  if (!subjective && !objective && !assessment && !plan && !body) {
    return { ok: false, error: 'The note is empty — write something before saving.' };
  }

  const performedRaw = text(form, 'performed_at');
  const units = text(form, 'units_total');

  const { data: note, error } = await supabase
    .from('client_note')
    .insert({
      clinic_id: viewer.clinicId,
      patient_id: patientId,
      author_staff_id: viewer.staffId ?? null,
      // Snapshotted, because a note has to still say who wrote it after that
      // person has left the practice.
      author_name: viewer.name,
      service_id: text(form, 'service_id'),
      service_name: text(form, 'service_name'),
      appointment_id: text(form, 'appointment_id'),
      performed_at: performedRaw ? new Date(performedRaw).toISOString() : new Date().toISOString(),
      kind: body && !subjective && !objective && !assessment && !plan ? 'note' : 'soap',
      subjective, objective, assessment, plan, body,
      products_used: text(form, 'products_used'),
      units_total: units ? Number(units) : null,
      areas_treated: text(form, 'areas_treated'),
      aftercare_given: form.get('aftercare_given') === 'on',
      adverse_event: form.get('adverse_event') === 'on',
      follow_up_on: text(form, 'follow_up_on'),
      synthetic: false
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  // Photographs are attached to the note, so they arrive with the same save
  // rather than as a second step somebody forgets.
  const photos = form.getAll('photos').filter((f): f is File => f instanceof File && f.size > 0);
  const poses = String(form.get('photo_pose') ?? 'before');

  for (const file of photos) {
    try {
      const path = await uploadClientPhoto(file, viewer.clinicId, patientId, poses);
      if (!path) continue;
      await supabase.from('photo').insert({
        clinic_id: viewer.clinicId,
        patient_id: patientId,
        note_id: note.id,
        captured_at: new Date().toISOString().slice(0, 10),
        pose_key: poses,
        storage_path: path,
        placeholder: false,
        synthetic: false
      });
    } catch (err) {
      // The note is already saved and is the important half. Say what failed
      // rather than rolling back a written clinical record over an image.
      return {
        ok: false,
        error: `The note was saved, but a photo did not upload: ${err instanceof Error ? err.message : 'unknown error'}`
      };
    }
  }

  revalidatePath(`/console/clients/${patientId}`);
  return { ok: true };
}

/**
 * An amendment: a new note that points at the one it corrects.
 *
 * Both stay visible. That is the whole design — a correction anybody can see
 * next to the original is credible, and one that replaces the original is not.
 */
export async function amendNote(
  patientId: string,
  amendsId: string,
  form: FormData
): Promise<NoteResult> {
  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') return { ok: false, error: 'Not signed in as staff.' };

  const body = text(form, 'body');
  if (!body) return { ok: false, error: 'An amendment needs to say something.' };

  const supabase = await serverClient();

  // The note being amended must belong to this client. RLS already scopes to
  // the clinic; this stops an amendment being filed against the wrong person's
  // note inside the same practice.
  const { data: target } = await supabase
    .from('client_note')
    .select('id, patient_id, performed_at')
    .eq('id', amendsId)
    .maybeSingle();

  if (!target || target.patient_id !== patientId) {
    return { ok: false, error: 'That note does not belong to this client.' };
  }

  const { error } = await supabase.from('client_note').insert({
    clinic_id: viewer.clinicId,
    patient_id: patientId,
    author_staff_id: viewer.staffId ?? null,
    author_name: viewer.name,
    kind: 'amendment',
    amends_id: amendsId,
    body,
    // Filed against the visit it corrects, not against today, so the timeline
    // keeps the amendment next to what it is about.
    performed_at: target.performed_at,
    synthetic: false
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/console/clients/${patientId}`);
  return { ok: true };
}

/** The face on the client list, so the practitioner knows who is walking in. */
export async function setClientPhoto(patientId: string, form: FormData): Promise<NoteResult> {
  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') return { ok: false, error: 'Not signed in as staff.' };

  const file = form.get('photo');
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: 'Choose a photo first.' };
  }

  const supabase = await serverClient();

  try {
    const { data: existing } = await supabase
      .from('patient').select('photo_path').eq('id', patientId).maybeSingle();

    const path = await uploadClientPhoto(file, viewer.clinicId, patientId, 'face');
    const { error } = await supabase
      .from('patient').update({ photo_path: path }).eq('id', patientId);
    if (error) return { ok: false, error: error.message };

    // Remove the old one only once the new one is safely in place and pointed
    // at. The other order loses the photo if the upload fails.
    if (existing?.photo_path) {
      await deleteClientPhoto(existing.photo_path).catch(() => {});
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Upload failed.' };
  }

  revalidatePath(`/console/clients/${patientId}`);
  return { ok: true };
}

/**
 * Removes a photograph.
 *
 * Allowed, unlike editing a note: a client asking for their pictures to be
 * deleted should get that immediately, and the wrong person's face uploaded by
 * accident must be removable now.
 */
export async function removePhoto(patientId: string, photoId: string): Promise<NoteResult> {
  const viewer = await currentViewer();
  if (!viewer || viewer.kind !== 'staff') return { ok: false, error: 'Not signed in as staff.' };

  const supabase = await serverClient();
  const { data: photo } = await supabase
    .from('photo').select('id, patient_id, storage_path').eq('id', photoId).maybeSingle();

  if (!photo || photo.patient_id !== patientId) {
    return { ok: false, error: 'That photo does not belong to this client.' };
  }

  if (photo.storage_path) await deleteClientPhoto(photo.storage_path).catch(() => {});
  const { error } = await supabase.from('photo').delete().eq('id', photoId);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/console/clients/${patientId}`);
  return { ok: true };
}
