/**
 * app/api/cron/reminders/route.ts
 * The day-before reminder.
 *
 * ===========================================================================
 * WHY THIS IS A CRON AND NOT A TRIGGER
 * ===========================================================================
 * A reminder is not caused by anything happening — it is caused by time
 * passing. There is no write to hang it off, so something has to come looking.
 * Vercel calls this once a day; it finds the appointments that start tomorrow
 * and have not been reminded, and sends.
 *
 * ===========================================================================
 * SENDING TWICE IS THE FAILURE TO AVOID
 * ===========================================================================
 * A cron that runs twice — a retry, a redeploy, somebody curling it — must not
 * text the same person twice. There is no "reminded_at" column to set, and
 * adding one would be a second source of truth about something automation_run
 * already records.
 *
 * So the record IS the lock: automation_run rows carry payload_ref = the
 * appointment id, and an appointment with a row for this rule is skipped. It is
 * written BEFORE the send rather than after, so a crash mid-send means one
 * missed reminder rather than a loop of duplicates. A person who does not get a
 * reminder still has their confirmation email; a person who gets four at 3am
 * unsubscribes.
 *
 * ===========================================================================
 * AUTHENTICATION
 * ===========================================================================
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Without CRON_SECRET
 * set this route refuses everything — an open endpoint that emails a practice's
 * clients is not something to leave running by default.
 */

import { NextResponse } from 'next/server';
import { serviceClient, serviceRoleConfigured } from '@/lib/supabase/service';
import { sendAppointmentReminder } from '@/lib/notify';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const RULE = 'appointment_reminder';

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not set; refusing to run.' },
      { status: 503 }
    );
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Not authorised.' }, { status: 401 });
  }

  if (!serviceRoleConfigured()) {
    return NextResponse.json(
      { error: 'SUPABASE_SERVICE_ROLE_KEY is not set; cannot read the calendar.' },
      { status: 503 }
    );
  }

  const supabase = serviceClient();

  /**
   * A generous window rather than exactly 24 hours.
   *
   * The job runs once a day, so "starting tomorrow" has to mean a whole day's
   * worth or the ones either side of a precise cutoff are missed forever. The
   * already-reminded check is what stops the overlap mattering.
   */
  const from = new Date(Date.now() + 12 * 3600_000).toISOString();
  const to = new Date(Date.now() + 36 * 3600_000).toISOString();

  const { data: due, error } = await supabase
    .from('appointment')
    .select(`
      id, starts_at, duration_min, clinic_id,
      patient:patient_id ( first_name, last_name, email ),
      service:service_id ( name ),
      clinic:clinic_id ( name, phone_voice, pilot_mode )
    `)
    .gte('starts_at', from)
    .lte('starts_at', to)
    .in('status', ['booked', 'confirmed'])
    .order('starts_at');

  if (error) {
    console.error('[reminders] could not read the calendar', error.message);
    return NextResponse.json({ error: 'Could not read the calendar.' }, { status: 500 });
  }

  const appointments = (due ?? []) as unknown as {
    id: string; starts_at: string; clinic_id: string;
    patient: { first_name: string; last_name: string; email: string | null } | null;
    service: { name: string } | null;
    clinic: { name: string; phone_voice: string | null; pilot_mode: boolean } | null;
  }[];

  // Which of these already have a reminder logged.
  const ids = appointments.map(a => a.id);
  const alreadySent = new Set<string>();

  if (ids.length) {
    const { data: logged } = await supabase
      .from('automation_run')
      .select('payload_ref')
      .eq('rule_key', RULE)
      .in('payload_ref', ids);

    for (const row of logged ?? []) alreadySent.add(String(row.payload_ref));
  }

  let sent = 0, skipped = 0, failed = 0;

  for (const appt of appointments) {
    if (alreadySent.has(appt.id)) { skipped++; continue; }
    if (!appt.patient?.email) { skipped++; continue; }

    // A practice still in pilot does not send mail to real people.
    if (appt.clinic?.pilot_mode) { skipped++; continue; }

    const result = await sendAppointmentReminder({
      appointmentId: appt.id,
      clinicId: appt.clinic_id,
      clinicName: appt.clinic?.name ?? 'the practice',
      practicePhone: appt.clinic?.phone_voice ?? null,
      clientName: `${appt.patient.first_name} ${appt.patient.last_name}`,
      clientEmail: appt.patient.email,
      serviceName: appt.service?.name ?? 'your appointment',
      whenText: new Date(appt.starts_at).toLocaleString('en-US', {
        timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short'
      })
    });

    if (result.delivered) sent++; else failed++;
  }

  console.info(`[reminders] ${appointments.length} due, ${sent} sent, ${skipped} skipped, ${failed} failed`);
  return NextResponse.json({ due: appointments.length, sent, skipped, failed });
}
