/**
 * Dates as the data stores them: ISO calendar days, no time, no zone.
 *
 * Nothing here goes through `new Date(iso).toLocaleDateString()`. A date-only
 * ISO string parses as midnight UTC, which is still the previous day anywhere
 * west of Greenwich, so the obvious version prints "Aug 22" for the 23rd to
 * every reader in the Americas.
 */

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-08-23" -> "Aug 23, 2026". Returns null for a missing date. */
export function longDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

/** A workflow timestamp in the reader's own time zone: "Oct 4, 2026 · 11:15 PM".
 *  Only for application events, which carry a real time; clinical dates are
 *  calendar days and go through longDate. Call it in the browser only. */
export function eventTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const day = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${day} · ${time}`;
}
