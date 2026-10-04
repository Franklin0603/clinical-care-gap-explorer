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
