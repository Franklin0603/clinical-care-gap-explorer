import Link from "next/link";
import Image from "next/image";
import { gold, dq, layerTotals, fmt } from "@/lib/data";
import { Section, Stat, Card, Scroller, th, td } from "@/components/ui";

export default function Overview() {
  const neverPct = Math.round((gold.never_tested / gold.open_gaps) * 100);

  return (
    <div className="pt-12">
      <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Which diabetic patients have not had an A1c test in the last twelve months?
      </h1>
      <p className="mt-4 max-w-2xl text-base leading-relaxed" style={{ color: "var(--muted)" }}>
        The query is four lines of SQL. Trusting its answer is the hard part, and
        that is what this project is about. Every figure below is read from the
        pipeline output, not typed in.
      </p>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <Stat
          value={`${gold.open_gaps} of ${gold.cohort}`}
          label="have an open A1c gap"
          note={`${gold.gap_rate_pct}% of diabetic patients alive on ${gold.asof}`}
        />
        <Stat
          accent
          value={String(gold.never_tested)}
          label="have never been tested at all"
          note={`${neverPct}% of the gaps. These are the highest-risk patients on the list.`}
        />
        <Stat
          value={dq.catch_rate_types}
          label="defect types caught"
          note={`${dq.catch_rate_rows} injected rows, each caught by the check meant for it`}
        />
      </div>

      <Section
        title="Where the number comes from"
        lede="Each step is a decision recorded in a decisions log, not a filter chosen to make the number look better. Two of these steps are the most consequential lines in the project."
      >
        <Card>
          <Image
            src="/img/01_cohort_funnel.png"
            alt={`Funnel: 161 patients carry a diabetes code, ${gold.cohort} are alive on the as-of date, ${gold.open_gaps} have an open gap, ${gold.never_tested} have never been tested`}
            width={1680}
            height={760}
            className="w-full"
          />
        </Card>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm font-semibold">Diabetic patient</dt>
            <dd className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              Any of eight diabetes SNOMED codes ever recorded, on a patient alive
              on the as-of date. Not just the type 2 code: {gold.complication_only}{" "}
              patients carry a diabetic complication with no underlying diagnosis,
              and anchoring on one code drops {gold.complication_only_pct}% of the
              cohort.
            </dd>
          </div>
          <div>
            <dt className="text-sm font-semibold">Open A1c gap</dt>
            <dd className="mt-1 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
              No A1c result in the 365 days before the as-of date. Never tested
              counts as a gap. A test ordered but never resulted is invisible in
              this data and is counted the same as never ordered.
            </dd>
          </div>
        </dl>
      </Section>

      <Section
        title="The bug worth knowing about"
        lede="The highest-risk person on a care-gap list is the diabetic with no A1c on record. An inner join from the cohort to observations deletes exactly those people, and nothing errors."
      >
        <Card>
          <Image
            src="/img/02_inner_join.png"
            alt={`Left join keeps ${gold.cohort} patients; inner join keeps ${gold.inner_join_would_keep} and silently deletes ${gold.never_tested}`}
            width={1128}
            height={1012}
            className="mx-auto w-full max-w-md"
          />
        </Card>
      </Section>

      <Section title="How the data gets here">
        <p className="mb-5 max-w-2xl text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          Synthea generates the patients. Bronze is a faithful copy, all text.
          Silver is typed and validated, with every rejected row quarantined and a
          reason attached. Gold is the care-gap table the pages read.
        </p>
        <Card>
          <Scroller>
            <table className="w-full">
              <thead>
                <tr style={{ background: "var(--blue-wash)" }}>
                  <th className={th}>Layer</th>
                  <th className={th}>Rows</th>
                  <th className={th}>What it is</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["Bronze", fmt(layerTotals.bronze), "Raw Synthea CSVs, every column text, nothing cleaned"],
                  ["Silver", fmt(layerTotals.silver), "Typed and validated; rejects quarantined, not dropped"],
                  ["Gold", String(gold.cohort), "One row per diabetic patient — the care-gap list"],
                ].map(([layer, rows, what]) => (
                  <tr key={layer} className="border-t" style={{ borderColor: "var(--rule)" }}>
                    <td className={`${td} font-semibold`}>{layer}</td>
                    <td className={`${td} num`}>{rows}</td>
                    <td className={td} style={{ color: "var(--muted)" }}>{what}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Scroller>
        </Card>
        <p className="mt-5 text-sm">
          <Link href="/pipeline" className="font-medium" style={{ color: "var(--blue)" }}>
            See the data quality work →
          </Link>
        </p>
      </Section>

      <Section
        title="What this cannot tell you"
        lede="Stated here rather than discovered later."
      >
        <ul className="max-w-2xl space-y-2 text-sm leading-relaxed" style={{ color: "var(--muted)" }}>
          <li>
            <strong style={{ color: "var(--ink)" }}>Synthea patients are fictional</strong> and
            their care is more diligent than a real population&apos;s.
          </li>
          <li>
            <strong style={{ color: "var(--ink)" }}>No orders table</strong>, so &ldquo;we ordered
            it and the patient never went&rdquo; is indistinguishable from &ldquo;we never ordered
            it&rdquo; — different problems with different fixes.
          </li>
          <li>
            <strong style={{ color: "var(--ink)" }}>No phone or email</strong> in the source data,
            so whether a patient can actually be reached has no answer here.
          </li>
          <li>
            <strong style={{ color: "var(--ink)" }}>The defects are the ones injected</strong>, so
            the catch rate measures the checks against a known list, not against reality.
          </li>
        </ul>
      </Section>
    </div>
  );
}
