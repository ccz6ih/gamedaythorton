/**
 * app/offline/page.tsx
 * What the installed app shows when the network is gone.
 *
 * It says the connection is missing and offers to retry — and deliberately
 * shows nothing else. The temptation is to cache "just the day's appointments"
 * so this screen is useful, and that is the trade this whole design refuses:
 * a stale list sends her to an appointment that moved, and the data would be
 * sitting unencrypted on the phone afterwards. See the header of public/sw.js.
 *
 * Statically rendered with no data of any kind, so it is safe to precache.
 */

export const dynamic = 'force-static';

export const metadata = {
  title: 'Offline',
  robots: { index: false, follow: false }
};

export default function OfflinePage() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        background: '#EFE7DA',
        color: '#16201A',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif'
      }}
    >
      <div style={{ maxWidth: '26rem', textAlign: 'center' }}>
        <img
          src="/icons/icon-192.png"
          alt=""
          width={72}
          height={72}
          style={{ borderRadius: 16, marginBottom: '1.25rem' }}
        />
        <h1 style={{ fontFamily: 'Georgia, serif', fontWeight: 400, fontSize: '1.6rem', margin: '0 0 .6rem' }}>
          No connection
        </h1>
        <p style={{ margin: '0 0 1.5rem', lineHeight: 1.6, color: '#5C6560' }}>
          This app needs to be online — appointments and client records are never
          stored on the device, so there is nothing to show until the connection
          is back.
        </p>

        {/*
          A plain link to the console rather than history.back(): coming back
          from offline usually means she wants today's screen, and back would
          return her to whatever failed to load.
        */}
        <a
          href="/console/today"
          style={{
            display: 'inline-block',
            padding: '.85rem 1.6rem',
            background: '#16201A',
            color: '#fff',
            borderRadius: 10,
            textDecoration: 'none',
            fontWeight: 600
          }}
        >
          Try again
        </a>
      </div>
    </div>
  );
}
