/**
 * app/console/products/page.tsx — the shop's catalogue.
 *
 * Exists because the descriptions are empty and there was nowhere to write
 * them. The shop has eighteen products and none of them say what they are,
 * which is the single biggest thing standing between the page and a sale.
 *
 * Nothing here writes copy on the practice's behalf. The supplier publishes
 * compliant descriptions for its stockists; this is somewhere to put them.
 */

import { getClinic } from '@/lib/db/queries';
import { serverClient } from '@/lib/supabase/server';
import { ProductEditor, type ProductRow } from '@/components/ProductEditor';

export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  const clinic = await getClinic();
  if (!clinic) return <div className="view"><p>No clinic visible.</p></div>;

  const supabase = await serverClient();

  const [{ data: products }, { data: images }] = await Promise.all([
    supabase.from('product')
      .select('id, name, brand, category, slug, description, details, price_cents, online, image_path')
      .eq('clinic_id', clinic.id)
      .eq('active', true)
      .order('brand')
      .order('name'),
    supabase.from('product_image').select('product_id').eq('clinic_id', clinic.id)
  ]);

  const extraByProduct = new Map<string, number>();
  for (const i of images ?? []) {
    const key = String(i.product_id);
    extraByProduct.set(key, (extraByProduct.get(key) ?? 0) + 1);
  }

  const rows: ProductRow[] = (products ?? []).map(p => ({
    id: String(p.id),
    name: String(p.name),
    brand: p.brand ? String(p.brand) : null,
    category: String(p.category),
    slug: p.slug ? String(p.slug) : null,
    description: p.description ? String(p.description) : null,
    details: p.details ? String(p.details) : null,
    price_cents: Number(p.price_cents),
    online: p.online === true,
    image_path: p.image_path ? String(p.image_path) : null,
    imageCount: (p.image_path ? 1 : 0) + (extraByProduct.get(String(p.id)) ?? 0)
  }));

  const withCopy = rows.filter(r => r.description).length;

  return (
    <>
      <header className="topbar">
        <div>
          <div className="crumb">{clinic.name}</div>
          <h1>Shop products</h1>
        </div>
        <div className="spacer" />
        <span className="pill" data-tone={withCopy === rows.length ? 'ok' : 'warn'}>
          <i className="dot" />{withCopy} of {rows.length} written up
        </span>
      </header>

      <div className="view wide">
        <ProductEditor products={rows} shopBase={`/c/${clinic.slug}/shop`} />
      </div>
    </>
  );
}
