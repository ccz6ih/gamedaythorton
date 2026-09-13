/**
 * lib/supabase/service.ts
 * The service-role client. There is exactly one legitimate caller.
 *
 * ===========================================================================
 * READ THIS BEFORE IMPORTING IT
 * ===========================================================================
 * lib/supabase/server.ts says, correctly, that there is no service-role client
 * in the request path — every query carries the signed-in user's session so RLS
 * does the access control, and a service-role client with hand-written tenant
 * filters turns every query into a place a leak can be introduced.
 *
 * That rule has exactly one exception, and it is the one that file anticipated:
 * "a route handler that does not take user input". The Stripe webhook is that
 * handler. It has no session because Stripe is not a user; it is authenticated
 * by an HMAC signature over the raw body, verified before this client is ever
 * constructed; and it must write to tables that anon and authenticated are both
 * correctly forbidden from touching.
 *
 * The blast radius is kept small in two ways:
 *
 *   1. This client's only reachable writes go through security-definer
 *      functions granted to service_role and nothing else — mark_paid and
 *      mark_failed. It does not write tables directly, so "service role" here
 *      means "may settle an order", not "may do anything".
 *
 *   2. scripts/shop-test.cjs asserts the set of files importing this module.
 *      Adding an import anywhere else fails the suite. That is the actual
 *      enforcement; this comment is only the explanation.
 *
 * If you are here because you want to read data a page cannot see, the answer
 * is almost always a policy or a column grant, not this file.
 *
 * (There is no `import 'server-only'` here because the package is not a
 * dependency of this project. The import-allowlist test is the real guard and
 * catches strictly more — `server-only` would only fail a client component,
 * while the test fails any new importer at all, server or client.)
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cached: SupabaseClient | null = null;

/** True when this deployment can settle payments at all. */
export function serviceRoleConfigured(): boolean {
  return !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

export function serviceClient(): SupabaseClient {
  if (cached) return cached;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is not set on this deployment, so paid orders ' +
      'cannot be recorded. Set it in Vercel (server-side only — it must never ' +
      'appear in a NEXT_PUBLIC_ variable). See docs/19-environment.md.'
    );
  }

  cached = createClient(url, key, {
    auth: {
      // No session, no refresh, no storage. This client is a one-shot writer in
      // a webhook, and persisting anything about it would mean a token sitting
      // in a serverless instance's memory between two unrelated requests.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
  return cached;
}
