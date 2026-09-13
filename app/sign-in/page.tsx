/**
 * app/sign-in/page.tsx — kept as a redirect to /admin.
 *
 * The staff sign-in moved to /admin so that a customer on the practice's own
 * domain does not read "sign in" as an account of their own. See app/admin for
 * the reasoning.
 *
 * This file stays rather than being deleted because bookmarks, an old link in
 * somebody's notes, and any redirect issued by a deployment that has not
 * restarted yet all still point here. A 404 on the sign-in page during a
 * cutover is a support call; a redirect is invisible.
 *
 * `next` is carried through so a deep link like /sign-in?next=/console/today
 * still lands where it was going.
 */

import { redirect } from 'next/navigation';

export default async function SignInRedirect({
  searchParams
}: {
  searchParams: Promise<{ next?: string; bad?: string }>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  if (params.next) query.set('next', params.next);
  if (params.bad) query.set('bad', params.bad);

  const qs = query.toString();
  redirect(`/admin${qs ? `?${qs}` : ''}`);
}
