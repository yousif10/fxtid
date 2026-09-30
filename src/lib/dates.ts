// Date helpers. Card dates are calendar dates (YYYY-MM-DD) interpreted in UK time.

export const APP_TIME_ZONE = "Europe/London";
const MONTHS = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

/** Today's calendar date in the UK, as YYYY-MM-DD. */
export function todayIso(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function isIsoDate(v: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

const toIso = (dt: Date) => dt.toISOString().slice(0, 10);

/** Adds whole months, clamping to the last day of the target month (31 Jan + 1m = 28/29 Feb). */
export function addMonthsIso(iso: string, months: number): string {
  const { y, m, d } = parts(iso);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return toIso(target);
}

export function addDaysIso(iso: string, days: number): string {
  const { y, m, d } = parts(iso);
  return toIso(new Date(Date.UTC(y, m - 1, d + days)));
}

/** Whole days from `from` to `to` (positive if `to` is later). */
export function daysBetween(from: string, to: string): number {
  const a = parts(from);
  const b = parts(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** "01 JAN 2028" - unambiguous for card artwork. */
export function formatCardDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")} ${MONTHS[m - 1]} ${y}`;
}

/** "01/01/2028" - UK numeric format for tables. */
export function formatUkDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { y, m, d } = parts(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y}`;
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const dt = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(dt);
}

export function formatRelative(value: Date | string, now: Date = new Date()): string {
  const dt = typeof value === "string" ? new Date(value) : value;
  const sec = Math.round((now.getTime() - dt.getTime()) / 1000);
  if (sec < 45) return "just now";
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr} hr${hr === 1 ? "" : "s"} ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? "" : "s"} ago`;
  return formatDateTime(dt);
}
