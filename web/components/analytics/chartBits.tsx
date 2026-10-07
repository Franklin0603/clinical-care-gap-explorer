import Link from "next/link";

import { DataTip } from "./ChartCard";

/**
 * Small pieces every analytics chart shares: the tooltip box Recharts renders
 * into, and the screen-reader table each chart carries, because an SVG chart
 * is invisible to assistive technology and its links unreachable by keyboard.
 */

export function TipBox(props: Parameters<typeof DataTip>[0]) {
  return (
    <div className="rounded-lg border bg-popover px-3 py-2 text-popover-foreground shadow-md">
      <DataTip {...props} />
    </div>
  );
}

export function SrTable({
  caption, head, rows,
}: {
  caption: string;
  head: string[];
  rows: { cells: string[]; href?: string; linkLabel?: string }[];
}) {
  return (
    // The wrapper, not the table, is sr-only: a table ignores the 1px box
    // and pushed the page wider than a phone screen.
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead><tr>{head.map((h) => <th key={h} scope="col">{h}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.cells[0]}>
            <th scope="row">{r.cells[0]}</th>
            {r.cells.slice(1).map((c, i) => <td key={i}>{c}</td>)}
            {r.href && <td><Link href={r.href}>{r.linkLabel ?? "View"}</Link></td>}
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

/** Recharts fills take colours, not classes: the theme tokens as CSS vars. */
export const FILL = {
  current: "var(--status-success)",
  gap: "var(--status-danger)",
  series: "var(--chart-1)",
};
