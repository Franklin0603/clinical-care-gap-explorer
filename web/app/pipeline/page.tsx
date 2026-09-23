import Image from "next/image";
import {
  dq, gold, recon, checks, quarantineRows, identityRows, remediationRows, fmt,
} from "@/lib/data";
import { Section, Card, Scroller, Stat, th, td } from "@/components/ui";

export default function Pipeline() {
  const reasons = [...new Set(quarantineRows.map((r) => r.failure_reason))];
  const example = remediationRows[0];

  return (
    <div className="pt-12">
      <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        The data quality work, shown rather than claimed
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--muted)" }}>
        A care-gap list gets handed to a nurse who picks up a phone, so a wrong
        list costs something in both directions. To find out whether the checks
        work, {dq.catch_rate_rows.split(" of ")[1]} rows were deliberately damaged
        in six realistic ways and logged, then the checks were scored against
        that log.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat value={dq.catch_rate_types} label="defect types caught" note={`${dq.catch_rate_rows} rows, each by its own check`} />
        <Stat accent value={String(dq.quarantine_by_check ? Object.values(dq.quarantine_by_check as Record<string, number>).reduce((a, b) => a + b, 0) : 0)} label="rows quarantined" note="Each with a reason a non-technical reader can follow" />
        <Stat value={String(dq.identity_review_pending ?? identityRows.length)} label="sent to a human" note="Suspected duplicate patients. Nothing was auto-merged." />
      </div>

      <Section
        title="Nothing is silently dropped"
        lede="For every table, bronze rows must equal silver rows plus quarantined rows. The pipeline asserts this on every run and stops if it does not balance. Remediated rows stay in Silver and are also listed in the remediation log, so they count once."
      >
        <Card>
          <Scroller>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--blue-wash)" }}>
                  <th className={th}>Table</th>
                  <th className={th}>Bronze</th>
                  <th className={th}>Silver</th>
                  <th className={th}>Quarantined</th>
                  <th className={th}>Balances</th>
                </tr>
              </thead>
              <tbody>
                {recon.map((r) => (
                  <tr key={r.name} className="border-t" style={{ borderColor: "var(--rule)" }}>
                    <td className={`${td} font-medium`}>{r.name}</td>
                    <td className={`${td} num`}>{fmt(r.bronze)}</td>
                    <td className={`${td} num`}>{fmt(r.silver)}</td>
                    <td className={`${td} num`}>{r.quarantined || "—"}</td>
                    <td className={td} style={{ color: r.balances ? "var(--blue)" : "var(--orange)" }}>
                      {r.balances ? "✓ yes" : "✗ no"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Card>
      </Section>

      <Section
        title="The six checks, and what each one caught"
        lede="Each defect has a real operational cause. Knowing the cause is the difference between 'duplicate rows' and 'an interface replayed the message'. A defect counts as caught only if the check meant for it caught it — a coincidence is not a working check."
      >
        <Card>
          <Scroller>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--blue-wash)" }}>
                  <th className={th}>Check</th>
                  <th className={th}>Rule</th>
                  <th className={th}>Real cause of the defect</th>
                  <th className={th}>Injected</th>
                  <th className={th}>Caught</th>
                </tr>
              </thead>
              <tbody>
                {checks.map((c) => (
                  <tr key={c.id} className="border-t" style={{ borderColor: "var(--rule)" }}>
                    <td className={td}>
                      <div className="font-semibold">{c.id}</div>
                      <div style={{ color: "var(--muted)" }}>{c.name}</div>
                    </td>
                    <td className={td} style={{ color: "var(--muted)" }}>{c.rule}</td>
                    <td className={td} style={{ color: "var(--muted)" }}>{c.cause}</td>
                    <td className={`${td} num`}>{c.injected}</td>
                    <td className={`${td} num font-semibold`} style={{ color: c.caught === c.injected ? "var(--blue)" : "var(--orange)" }}>
                      {c.caught}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Card>
      </Section>

      <Section
        title="The quarantine"
        lede="Every rejected row is here with the reason it was rejected. Showing the rows is the argument — a count would be the claim, not the evidence. Someone will eventually ask why a patient is missing from a report, and this is how that question gets answered."
      >
        <p className="mb-4 text-sm" style={{ color: "var(--muted)" }}>
          {quarantineRows.length} rows, {reasons.length} distinct reasons. First 25 shown.
        </p>
        <Card>
          <Scroller>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--blue-wash)" }}>
                  <th className={th}>Check</th>
                  <th className={th}>From</th>
                  <th className={th}>Row</th>
                  <th className={th}>Why it was held back</th>
                </tr>
              </thead>
              <tbody>
                {quarantineRows.slice(0, 25).map((r, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--rule)" }}>
                    <td className={`${td} font-medium`}>{r.check_id}</td>
                    <td className={td} style={{ color: "var(--muted)" }}>
                      {r.source_table.replace("bronze_", "")}
                    </td>
                    <td className={`${td} font-mono text-xs`} style={{ color: "var(--faint)" }}>
                      {r.source_row_id.slice(0, 18)}…
                    </td>
                    <td className={td}>{r.failure_reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Card>
      </Section>

      <Section
        title="Suspected duplicate patients go to a person"
        lede="These records look like the same human registered twice. Nothing downstream merges them, and both patients continue to exist separately in Silver. That restraint is a choice, not a missing feature: a wrong merge combines two people's medication lists, which is a patient safety event rather than a data bug."
      >
        <Card>
          <Scroller>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--blue-wash)" }}>
                  <th className={th}>Record A</th>
                  <th className={th}>Record B</th>
                  <th className={th}>Fields that match</th>
                  <th className={th}>Confidence</th>
                  <th className={th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {identityRows.map((r, i) => (
                  <tr key={i} className="border-t" style={{ borderColor: "var(--rule)" }}>
                    <td className={`${td} font-mono text-xs`}>{r.candidate_a_mrn.slice(0, 8)}</td>
                    <td className={`${td} font-mono text-xs`}>{r.candidate_b_mrn.slice(0, 8)}</td>
                    <td className={td} style={{ color: "var(--muted)" }}>
                      {r.match_fields.split(",").join(", ").replace(/_/g, " ")}
                    </td>
                    <td className={`${td} num`}>{r.confidence.toFixed(2)}</td>
                    <td className={td}>
                      <span
                        className="rounded px-2 py-0.5 text-xs font-medium"
                        style={{ background: "var(--orange-wash)", color: "var(--orange)" }}
                      >
                        awaiting review
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Card>
      </Section>

      <Section
        title="One correction, in full"
        lede="Not every bad value is thrown away. An A1c is a percentage, so 250 is impossible — but blood glucose in mg/dL lands there routinely, which makes this a unit error rather than nonsense. It is converted with a published formula, the original is kept, and the row is flagged, so a reviewer who disagrees can exclude every corrected row with one filter."
      >
        <Card>
          <div className="grid gap-px sm:grid-cols-3" style={{ background: "var(--rule)" }}>
            <div className="p-5" style={{ background: "var(--surface)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                As it arrived
              </div>
              <div className="num mt-2 text-2xl font-semibold" style={{ color: "var(--orange)" }}>
                {example.original_value}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                percent — biologically impossible
              </div>
            </div>
            <div className="p-5" style={{ background: "var(--surface)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                After correction
              </div>
              <div className="num mt-2 text-2xl font-semibold" style={{ color: "var(--blue)" }}>
                {example.corrected_value}
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                percent — a poorly controlled diabetic
              </div>
            </div>
            <div className="p-5" style={{ background: "var(--surface)" }}>
              <div className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--faint)" }}>
                Rule applied
              </div>
              <div className="mt-2 font-mono text-xs leading-relaxed">
                A1c = (value + 46.7) / 28.7
              </div>
              <div className="mt-1 text-xs" style={{ color: "var(--muted)" }}>
                The ADA mapping between A1c and estimated average glucose.
                Applied to {remediationRows.length} rows.
              </div>
            </div>
          </div>
        </Card>
      </Section>

      <Section
        title="The check that was wrong before any defect was injected"
        lede={`The specification proposed rejecting any A1c below 3.0 percent. Profiling the clean data first showed that would flag ${gold.a1c_clean_below_3} perfectly good results — an 11% false-positive rate on untouched data, which would have made the catch rate meaningless. The floor was revised to 2.0.`}
      >
        <Card>
          <Image src="/img/04_a1c_floor.png" alt={`A1c distribution with ${gold.a1c_clean_below_3} clean results below the proposed 3.0 floor`} width={1680} height={880} className="w-full" />
        </Card>
      </Section>

      <Section
        title="Why the date is frozen"
        lede={`Every figure on this site is computed as of ${gold.asof}, the day the simulated data ends. With a run-time date the gap count would climb every day the site is read, not because anything changed but because the calendar moved.`}
      >
        <Card>
          <Image src="/img/06_asof_drift.png" alt={`Open gaps climb from ${gold.open_gaps} to ${gold.cohort} as the assumed date moves forward`} width={1416} height={928} className="w-full" />
        </Card>
      </Section>
    </div>
  );
}
