/**
 * lib/supabase/client.ts
 * Browser client. Uses the publishable key and therefore only ever sees what RLS
 * allows the signed-in user to see.
 */

'use client';

import { createBrowserClient } from '@supabase/ssr';

export function browserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
