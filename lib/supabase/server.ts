/**
 * lib/supabase/server.ts
 * Server-side Supabase clients.
 *
 * Everything that reads PHI goes through `serverClient()`, which carries the
 * signed-in user's session — so RLS is doing the access control on every query
 * and a screen cannot accidentally read another tenant's data by forgetting a
 * where clause. That is deliberate: the alternative (a service-role client with
 * hand-written tenant filters) makes every query a place where a leak can be
 * introduced.
 *
 * There is no service-role client in the request path at all. If one is ever
 * needed for a background job, it belongs in a route handler that does not take
 * user input, and it must never be imported into a page.
 */

import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieToSet = { name: string; value: string; options?: CookieOptions };

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill it in ` +
      `(see docs/19-environment.md).`
    );
  }
  return value;
}

/** Session-scoped client for server components and server actions. */
export async function serverClient() {
  const cookieStore = await cookies();

  return createServerClient(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(toSet: CookieToSet[]) {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Server components cannot set cookies. The middleware refreshes the
            // session instead, so this is expected rather than an error.
          }
        }
      }
    }
  );
}

/** The signed-in auth user, or null. */
export async function currentUser() {
  const supabase = await serverClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

export type StaffContext = {
  kind: 'staff';
  authId: string;
  staffId: string;
  name: string;
  role: 'owner' | 'provider' | 'front_desk' | 'admin';
  clinicId: string;
};

export type PatientContext = {
  kind: 'patient';
  authId: string;
  patientId: string;
  name: string;
  clinicId: string;
};

export type Viewer = StaffContext | PatientContext | null;

/**
 * Who is looking, and at which clinic.
 *
 * Resolved from the database rather than from a JWT claim so that revoking
 * someone's access (setting staff_user.active = false) takes effect on their
 * next request instead of whenever their token happens to expire.
 */
export async function currentViewer(): Promise<Viewer> {
  const supabase = await serverClient();
  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return null;

  const { data: staff } = await supabase
    .from('staff_user')
    .select('id, name, role, clinic_id')
    .eq('auth_user_id', user.id)
    .eq('active', true)
    .maybeSingle();

  if (staff) {
    return {
      kind: 'staff',
      authId: user.id,
      staffId: staff.id,
      name: staff.name,
      role: staff.role,
      clinicId: staff.clinic_id
    };
  }

  const { data: patient } = await supabase
    .from('patient')
    .select('id, first_name, last_name, clinic_id')
    .eq('auth_user_id', user.id)
    .maybeSingle();

  if (patient) {
    return {
      kind: 'patient',
      authId: user.id,
      patientId: patient.id,
      name: `${patient.first_name} ${patient.last_name}`,
      clinicId: patient.clinic_id
    };
  }

  // Signed in but attached to nothing. Happens if an account was created before
  // its staff or patient row, and it must not be treated as either.
  return null;
}
