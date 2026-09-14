/**
 * components/ActivityFeed.tsx
 * What has landed while nobody was looking.
 *
 * This is the answer to "has anything happened?" — the question a practice
 * opens the console to ask when the whole point of the website is that bookings
 * and orders arrive unattended.
 *
 * DELIBERATELY NOT A READ/UNREAD INBOX. A notifications table with a seen flag
 * has to be written on every page view, drifts from the things it describes,
 * and turns into a chore of dismissing rather than a picture of the business.
 * This is a query over what actually exists, newest first, which cannot be out
 * of date. Recency does the work a read flag would.
 *
 * A server component: it renders a list and links. Nothing here needs to be
 * interactive, and making it a client component would ship a bundle to do less.
 */

import Link from 'next/link';
import type { ActivityItem } from '@/lib/db/calendar';

const ICON: Record<ActivityItem['kind'], string> = {
  booking: '✚',
  cancellation: '✕',
  order: '⬓',
  enquiry: '✉'
};

/** "12 minutes ago" down to the hour, then the day. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function ActivityFeed({ items, hours }: { items: ActivityItem[]; hours: number }) {
  if (items.length === 0) {
    return (
      <section className="card">
        <header className="card-head"><h2 style={{ margin: 0 }}>Since you last looked</h2></header>
        <div className="card-body">
          <p className="muted">
            Nothing new in the last {hours} hours. Bookings taken on the website
            and paid orders appear here on their own.
          </p>
        </div>
      </section>
    );
  }

  const needsDoing = items.filter(i => i.actionable).length;

  return (
    <section className="card">
      <header className="card-head">
        <h2 style={{ margin: 0 }}>Since you last looked</h2>
        <div className="spacer" />
        {needsDoing > 0 && (
          <span className="pill" data-tone="warn">
            <i className="dot" />{needsDoing} need{needsDoing === 1 ? 's' : ''} doing
          </span>
        )}
      </header>

      <div className="card-body">
        <ul className="feed">
          {items.map(item => (
            <li className={`feed-item k-${item.kind}${item.actionable ? ' is-actionable' : ''}`} key={item.id}>
              <span className="feed-ico" aria-hidden="true">{ICON[item.kind]}</span>
              <Link href={item.href} className="feed-main">
                <span className="feed-what">{item.what}</span>
                {item.detail && <span className="feed-detail">{item.detail}</span>}
              </Link>
              <time className="feed-when" dateTime={item.at}>{ago(item.at)}</time>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
