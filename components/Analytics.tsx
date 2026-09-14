/**
 * components/Analytics.tsx
 * The practice's own analytics tag, on the practice's own public pages.
 *
 * ===========================================================================
 * WHERE THIS MAY BE RENDERED, AND WHERE IT MAY NOT
 * ===========================================================================
 * The storefront: yes. Those are public marketing pages with no session, no
 * client records and nothing a stranger could not already see by visiting.
 *
 * The console, the portal, the sign-in page, the gate: NEVER. That is rule 3 in
 * this project and it is not a style preference — a third-party script behind
 * login can read the whole page, and the page has client names on it. The
 * relevant regulator has published guidance on exactly this and there is active
 * litigation in this vertical.
 *
 * The enforcement is not this comment. It is that only the storefront layout
 * imports this file, and scripts/analytics-test.cjs fails if anything else
 * does — or if the tag ever appears in the HTML of an authenticated route.
 *
 * ===========================================================================
 * WHY NOT next/script
 * ===========================================================================
 * `next/script` with afterInteractive would be the idiomatic choice and is
 * slightly better for performance. It also injects the tag from client-side
 * JavaScript, which means the "is this script on an authenticated page" test
 * cannot see it in the server-rendered HTML — the check would pass while being
 * blind. Rendering the tag server-side keeps it visible to the thing that
 * polices it.
 */

type Props = {
  /** GA4 measurement id from the practice's own record. Absent means no tag. */
  measurementId: string | null | undefined;
};

export function Analytics({ measurementId }: Props) {
  // Shape-checked again here, not only in the database. This value is
  // interpolated into a <script>, so it gets the same treatment as anything
  // else that crosses that boundary — the column CHECK could be dropped by a
  // migration and this would still hold.
  if (!measurementId || !/^G-[A-Z0-9]{6,16}$/.test(measurementId)) return null;

  return (
    <>
      <script async src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} />
      <script
        dangerouslySetInnerHTML={{
          __html: [
            'window.dataLayer = window.dataLayer || [];',
            'function gtag(){dataLayer.push(arguments);}',
            "gtag('js', new Date());",
            // anonymize_ip is GA4's default; stated explicitly so it survives a
            // property being reconfigured in the Google console.
            `gtag('config', '${measurementId}', { anonymize_ip: true });`
          ].join('\n')
        }}
      />
    </>
  );
}
