/**
 * lib/format.ts
 * Display helpers. Mirrors GD.fmt in the prototype so the two render identically
 * and a screen ported from one to the other does not quietly change its numbers.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function money(cents: number | null | undefined, opts: { compact?: boolean; cents?: boolean } = {}) {
  const n = (cents ?? 0) / 100;
  if (opts.compact && Math.abs(n) >= 1000) {
    return '$' + (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k';
  }
  return '$' + n.toLocaleString('en-US', {
    minimumFractionDigits: opts.cents ? 2 : 0,
    maximumFractionDigits: opts.cents ? 2 : 0
  });
}

/**
 * Price as it may honestly be shown. A med spa's "from $800" must not be
 * rendered as "$800", and a per-unit price must carry its unit — printing a
 * single number where the practice quotes a range is a misquote on the screen
 * where cost is the objection.
 */
export function priceLabel(service: {
  price_mode: string;
  price_cents: number | null;
  price_from_cents: number | null;
  unit_label: string | null;
}): string {
  switch (service.price_mode) {
    case 'flat': return money(service.price_cents);
    case 'free': return 'Complimentary';
    case 'from': return `from ${money(service.price_from_cents)}`;
    case 'per_unit':
      return `${money(service.price_from_cents)}+ / ${service.unit_label ?? 'unit'}`;
    case 'quoted':
    default: return 'Quoted';
  }
}

function parseDate(value: string): Date {
  return new Date(value.length === 10 ? value + 'T00:00:00Z' : value);
}

export function dateLabel(value: string | null | undefined, style: 'short' | 'long' | 'dow' | 'md' = 'short') {
  if (!value) return '—';
  const d = parseDate(value);
  const mon = MONTHS[d.getUTCMonth()] ?? '';
  if (style === 'long') return `${DAYS[d.getUTCDay()]} ${mon} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
  if (style === 'dow') return `${DAYS[d.getUTCDay()]} ${mon} ${d.getUTCDate()}`;
  if (style === 'md') return `${mon} ${d.getUTCDate()}`;
  return `${mon} ${d.getUTCDate()}, ${d.getUTCFullYear()}`;
}

/** Clinic-local time. Appointments are wall-clock events at a physical place. */
export function timeLabel(value: string | null | undefined, timeZone = 'America/Denver') {
  if (!value) return '';
  return new Date(value)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone })
    .replace(':00', '')
    .replace(' AM', 'am')
    .replace(' PM', 'pm');
}

export function dayKey(value: string, timeZone = 'America/Denver') {
  return new Date(value).toLocaleDateString('en-CA', { timeZone });
}

export function relative(value: string | null | undefined) {
  if (!value) return '—';
  const then = parseDate(value).getTime();
  const days = Math.round((Date.now() - then) / 864e5);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days === -1) return 'tomorrow';
  if (days < 0) return `in ${Math.abs(days)} days`;
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.round(days / 7)} weeks ago`;
  return `${Math.round(days / 30.4)} months ago`;
}

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  return Math.round((parseDate(value).getTime() - Date.now()) / 864e5);
}

export function initials(name: string | null | undefined) {
  return (name ?? '?')
    .split(/[\s,]+/).filter(Boolean).slice(0, 2)
    .map(w => (w[0] ?? '').toUpperCase()).join('');
}

export function titleCase(value: string | null | undefined) {
  return (value ?? '').replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function num(value: number | null | undefined, dp?: number) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return Number(value).toFixed(dp ?? (Math.abs(value) < 10 ? 1 : 0));
}

export function signed(value: number, dp?: number) {
  const s = num(Math.abs(value), dp);
  return (value > 0 ? '+' : value < 0 ? '−' : '') + s;
}

export function phone(value: string | null | undefined) {
  const digits = (value ?? '').replace(/\D/g, '').slice(-10);
  return digits.length === 10
    ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
    : (value ?? '—');
}
