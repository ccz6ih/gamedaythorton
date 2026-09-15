'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { requireRole, pilotFields, requiredText, text, int, money, formMessage } from '@/lib/actions';

function expiryDate(days: number | null): string | null {
  if (!days) return null;
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function sellPackage(formData: FormData) {
  const staff = await requireRole(['owner', 'admin']);
  const patientId = requiredText(formData, 'patient_id');
  const packageId = requiredText(formData, 'package_id');

  try {
    const supabase = await serverClient();
    const pilot = await pilotFields(staff.clinicId);
    const [{ data: patient }, { data: pack }] = await Promise.all([
      supabase.from('patient').select('id').eq('id', patientId).eq('clinic_id', staff.clinicId).maybeSingle(),
      supabase.from('service_package').select('id, name, sessions, price_cents, expiry_days').eq('id', packageId).eq('clinic_id', staff.clinicId).eq('active', true).maybeSingle()
    ]);
    if (!patient) throw new Error('That client is not in this practice.');
    if (!pack) throw new Error('That package is no longer available.');

    const { data: payment, error: paymentError } = await supabase.from('payment').insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      amount_cents: pack.price_cents,
      type: 'package',
      status: 'paid',
      descriptor: 'Package purchase',
      processor: text(formData, 'processor') || 'manual',
      paid_at: new Date().toISOString(),
      ...pilot
    }).select('id').single();
    if (paymentError || !payment) throw new Error(paymentError?.message ?? 'Could not record payment.');

    const { error } = await supabase.from('package_purchase').insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      package_id: pack.id,
      package_name: pack.name,
      sessions_total: pack.sessions,
      price_paid_cents: pack.price_cents,
      expires_on: expiryDate(pack.expiry_days),
      payment_id: payment.id,
      status: 'active',
      ...pilot
    });
    if (error) throw new Error(error.message);

    revalidatePath('/console/packages');
    revalidatePath(`/console/clients/${patientId}`);
    redirect(`/console/clients/${patientId}?saved=package`);
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect(`/console/packages/new?patient=${encodeURIComponent(patientId)}&error=${encodeURIComponent(formMessage(err))}`);
  }
}

export async function redeemPackage(formData: FormData) {
  const staff = await requireRole(['owner', 'admin', 'provider']);
  const patientId = requiredText(formData, 'patient_id');
  const purchaseId = requiredText(formData, 'purchase_id');

  try {
    const supabase = await serverClient();
    const { error } = await supabase.from('package_redemption').insert({
      clinic_id: staff.clinicId,
      patient_id: patientId,
      purchase_id: purchaseId,
      appointment_id: text(formData, 'appointment_id'),
      treatment_record_id: text(formData, 'treatment_record_id'),
      sessions: int(formData, 'sessions', 1),
      note: text(formData, 'note'),
      redeemed_by: staff.staffId,
      ...await pilotFields(staff.clinicId)
    });
    if (error) throw new Error(error.message);

    revalidatePath(`/console/clients/${patientId}`);
    revalidatePath('/console/packages');
    redirect(`/console/clients/${patientId}?saved=redemption`);
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect(`/console/clients/${patientId}?error=${encodeURIComponent(formMessage(err))}`);
  }
}