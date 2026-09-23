import { ReactNode } from "react";

export function Section({ title, lede, children }: { title: string; lede?: string; children: ReactNode }) {
  return (
    <section className="mt-14">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {lede && (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          {lede}
        </p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--rule)", background: "var(--surface)" }}
    >
      {children}
    </div>
  );
}

/** Wraps a table so it scrolls on a phone instead of blowing out the viewport (V5.9). */
export function Scroller({ children }: { children: ReactNode }) {
  return <div className="overflow-x-auto">{children}</div>;
}

export function Stat({ value, label, note, accent }: { value: string; label: string; note?: string; accent?: boolean }) {
  return (
    <div className="rounded-lg border p-5" style={{ borderColor: "var(--rule)", background: "var(--surface)" }}>
      <div className="num text-3xl font-semibold tracking-tight" style={{ color: accent ? "var(--orange)" : "var(--blue)" }}>
        {value}
      </div>
      <div className="mt-1 text-sm font-medium">{label}</div>
      {note && <div className="mt-1 text-xs leading-relaxed" style={{ color: "var(--muted)" }}>{note}</div>}
    </div>
  );
}

export const th = "px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider";
export const td = "px-3 py-2 text-sm align-top";
