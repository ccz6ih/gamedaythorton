'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serverClient } from '@/lib/supabase/server';
import { requireRole, pilotFields, requiredText, text, decimal, formMessage } from '@/lib/actions';

export async function createInventoryItem(formData: FormData) {
  const staff = await requireRole(['owner', 'admin']);
  try {
    const supabase = await serverClient();
    const { error } = await supabase.from('inventory_item').insert({
      clinic_id: staff.clinicId,
      name: requiredText(formData, 'name'),
      category: text(formData, 'category'),
      unit: requiredText(formData, 'unit'),
      unit_label: text(formData, 'unit_label'),
      reorder_threshold: decimal(formData, 'reorder_threshold') ?? 0,
      active: true
    });
    if (error) throw new Error(error.message);
    revalidatePath('/console/inventory');
    redirect('/console/inventory?saved=item');
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect(`/console/inventory?error=${encodeURIComponent(formMessage(err))}`);
  }
}

export async function receiveLot(formData: FormData) {
  const staff = await requireRole(['owner', 'admin']);
  try {
    const supabase = await serverClient();
    const qty = decimal(formData, 'qty_received');
    if (!qty || qty <= 0) throw new Error('Quantity received must be greater than zero.');
    const { data: lot, error } = await supabase.from('inventory_lot').insert({
      clinic_id: staff.clinicId,
      item_id: requiredText(formData, 'item_id'),
      lot_number: requiredText(formData, 'lot_number'),
      expiry_date: text(formData, 'expiry_date'),
      qty_received: qty,
      qty_remaining: qty,
      received_at: text(formData, 'received_at') || new Date().toISOString().slice(0, 10)
    }).select('id').single();
    if (error || !lot) throw new Error(error?.message ?? 'Could not receive that lot.');
    const { error: txError } = await supabase.from('inventory_transaction').insert({
      clinic_id: staff.clinicId,
      lot_id: lot.id,
      type: 'received',
      qty,
      performed_by: staff.staffId,
      note: text(formData, 'note'),
      ...await pilotFields(staff.clinicId)
    });
    if (txError) throw new Error(txError.message);
    revalidatePath('/console/inventory');
    redirect('/console/inventory?saved=lot');
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect(`/console/inventory?error=${encodeURIComponent(formMessage(err))}`);
  }
}

export async function adjustLot(formData: FormData) {
  const staff = await requireRole(['owner', 'admin']);
  try {
    const supabase = await serverClient();
    const lotId = requiredText(formData, 'lot_id');
    const quantity = decimal(formData, 'quantity');
    if (!quantity || quantity <= 0) throw new Error('Adjustment quantity must be greater than zero.');
    const type = text(formData, 'type');
    if (!['wasted', 'expired', 'adjusted'].includes(type ?? '')) throw new Error('Choose a valid adjustment type.');
    const { data: lot } = await supabase.from('inventory_lot').select('id, qty_remaining').eq('id', lotId).eq('clinic_id', staff.clinicId).maybeSingle();
    if (!lot) throw new Error('That lot is not in this practice.');
    if (quantity > Number(lot.qty_remaining)) throw new Error('The adjustment is larger than the remaining stock.');
    const { error: updateError } = await supabase.from('inventory_lot').update({ qty_remaining: Number(lot.qty_remaining) - quantity }).eq('id', lotId).eq('clinic_id', staff.clinicId);
    if (updateError) throw new Error(updateError.message);
    const { error } = await supabase.from('inventory_transaction').insert({
      clinic_id: staff.clinicId,
      lot_id: lotId,
      type,
      qty: quantity,
      performed_by: staff.staffId,
      note: text(formData, 'note'),
      ...await pilotFields(staff.clinicId)
    });
    if (error) throw new Error(error.message);
    revalidatePath('/console/inventory');
    redirect('/console/inventory?saved=adjustment');
  } catch (err) {
    if (err && typeof err === 'object' && 'digest' in err) throw err;
    redirect(`/console/inventory?error=${encodeURIComponent(formMessage(err))}`);
  }
}
