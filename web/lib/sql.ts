// Running SQL in the browser (Day 7).
//
// Decision D9 made this a static site, so there is no server to run queries on.
// DuckDB-WASM loads the same Parquet files the pipeline exported and runs the
// SQL here, which means the statement shown above an answer is the statement
// that actually produced it — not a pretty-printed approximation.

import * as duckdb from "@duckdb/duckdb-wasm";
import type { Role } from "@/lib/data";

/* ------------------------------------------------------------------ guard */

export type Guard = { ok: true; sql: string } | { ok: false; reason: string };

/**
 * Only a single SELECT is allowed to run.
 *
 * This is an allowlist on the statement's leading keyword, not a blocklist of
 * dangerous words, and the difference matters:
 *
 *   - A blocklist on "DROP" rejects `SELECT * FROM t WHERE note LIKE '%drop%'`,
 *     which is harmless, while `DEL/**]/ETE` slips past a regex entirely.
 *   - An allowlist asks what the statement *is* rather than what it contains.
 *     A statement that begins with SELECT or WITH cannot be a DROP.
 *
 * The second half is rejecting stacked statements. `SELECT 1; DROP TABLE x`
 * begins with SELECT, so a check that looks only at the first statement passes
 * it. Comments are stripped first, because `SELECT 1 --;` and `/* ; *​/` are
 * both ways to hide a separator from a naive scan.
 *
 * Underneath this, the DuckDB instance holds read-only views over Parquet files
 * fetched from a static host. Even a bypass has nothing to damage: the browser
 * cannot write back to the origin.
 */
export function guardSelectOnly(raw: string): Guard {
  const sql = raw.trim();
  if (!sql) return { ok: false, reason: "Nothing to run — type a question or a SELECT statement." };

  // Strip comments before looking for separators, so they cannot hide one, then
  // mask string literals so a semicolon *inside* a value is not mistaken for a
  // statement separator. `WHERE note = 'a;b'` is legitimate and must still run.
  const bare = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/--[^\n]*/g, " ")
    .trim()
    .replace(/;+\s*$/, "");
  const masked = bare.replace(/'(?:[^']|'')*'/g, "''");

  if (masked.includes(";")) {
    return {
      ok: false,
      reason:
        "That is more than one statement. Only a single SELECT runs here, so a second statement after a semicolon is refused even when the first one is harmless.",
    };
  }

  const verb = mainVerb(masked);
  if (verb !== "SELECT") {
    return {
      ok: false,
      reason: `This runs SELECT statements only, and that one is a ${
        verb ?? "statement of another kind"
      }. Nothing here can write, delete or alter data.`,
    };
  }
  return { ok: true, sql: bare };
}

/**
 * The operation a statement actually performs.
 *
 * For most statements that is the first word. For `WITH` it is not: DuckDB
 * accepts `WITH x AS (SELECT 1) DELETE FROM patients`, which begins with WITH,
 * contains SELECT, and deletes rows. So the CTE list is walked past — tracking
 * parenthesis depth, and skipping string literals — and the keyword that follows
 * it is the one that counts. Checking merely that a statement "contains SELECT"
 * lets that case through; this was caught by a test, not by reading the code.
 */
function mainVerb(sql: string): string | undefined {
  const first = sql.match(/^\s*([a-z]+)/i)?.[1]?.toUpperCase();
  if (first !== "WITH") return first;

  let i = sql.search(/\bwith\b/i) + 4;
  if (/^\s*recursive\b/i.test(sql.slice(i))) i += sql.slice(i).search(/\brecursive\b/i) + 9;

  let depth = 0;
  while (i < sql.length) {
    const ch = sql[i];
    if (ch === "'") {
      i++;
      while (i < sql.length && sql[i] !== "'") i++;
    } else if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth--;
      if (depth === 0) {
        let j = i + 1;
        while (j < sql.length && /\s/.test(sql[j])) j++;
        if (sql[j] === ",") {
          i = j; // another CTE follows
        } else {
          return sql.slice(j).match(/^([a-z]+)/i)?.[1]?.toUpperCase();
        }
      }
    }
    i++;
  }
  return undefined;
}

/* ------------------------------------------------------------------ engine */

let dbPromise: Promise<duckdb.AsyncDuckDB> | null = null;

async function getDb(): Promise<duckdb.AsyncDuckDB> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const bundles = duckdb.getJsDelivrBundles();
      const bundle = await duckdb.selectBundle(bundles);

      // The worker script lives on jsDelivr, and `new Worker(crossOriginUrl)`
      // is a SecurityError in every browser — a worker must come from this
      // origin. So load it from a same-origin blob that importScripts the CDN
      // copy, which is the pattern duckdb-wasm's own CDN example uses.
      // Without this the engine never starts and the Ask page answers nothing.
      const workerUrl = URL.createObjectURL(
        new Blob([`importScripts("${bundle.mainWorker!}");`], { type: "text/javascript" }),
      );
      const worker = new Worker(workerUrl);
      const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.ERROR), worker);
      await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
      URL.revokeObjectURL(workerUrl);
      return db;
    })();
  }
  return dbPromise;
}

const registered = new Set<string>();

/**
 * Register the Parquet files this role is allowed to see.
 *
 * The role's own export is registered as `patients`, so a question that asks for
 * a restricted column fails because the column genuinely is not there — the same
 * restriction as on the patient page, enforced by the data rather than the UI.
 */
export async function connect(role: Role, basePath: string) {
  const db = await getDb();
  const files: [string, string][] = [
    ["patients", `care_gap_${role}.parquet`],
    ["quarantine", "quarantine.parquet"],
    ["identity_review", "identity_review.parquet"],
    ["remediation_log", "remediation_log.parquet"],
  ];
  const conn = await db.connect();
  for (const [view, file] of files) {
    const key = `${role}:${file}`;
    if (!registered.has(key)) {
      const res = await fetch(`${basePath}/data/${file}`);
      if (!res.ok) throw new Error(`Could not load ${file}`);
      await db.registerFileBuffer(`${role}_${file}`, new Uint8Array(await res.arrayBuffer()));
      registered.add(key);
    }
    await conn.query(
      `CREATE OR REPLACE VIEW ${view} AS SELECT * FROM parquet_scan('${role}_${file}')`,
    );
  }
  return conn;
}

export type QueryResult =
  | { ok: true; columns: string[]; rows: unknown[][]; ms: number }
  | { ok: false; reason: string };

/** Turn DuckDB's exception text into one sentence a non-SQL reader can act on. */
export function explain(message: string): string {
  const m = message.replace(/\s+/g, " ").trim();
  const missingCol = m.match(/column "?([\w.]+)"? not found|Referenced column "?([\w.]+)"?/i);
  if (missingCol) {
    const col = missingCol[1] ?? missingCol[2];
    return `There is no column called "${col}" in the data this role can see. It may be restricted for this role, or it may not exist at all — the column list above the results shows what is available.`;
  }
  if (/Table with name (\w+) does not exist|does not exist!/i.test(m)) {
    const t = m.match(/Table with name (\w+)/i)?.[1];
    return `There is no table called "${t ?? "that"}" here. Four tables are available: patients, quarantine, identity_review and remediation_log.`;
  }
  if (/Parser Error|syntax error/i.test(m)) {
    return "That is not valid SQL, so nothing was run. The statement is shown above exactly as it was submitted.";
  }
  if (/Conversion Error|Binder Error/i.test(m)) {
    return "The query is valid SQL but does not fit the data — usually comparing a date to a number, or a column used in the wrong place.";
  }
  return "The query could not be completed. Nothing was changed; this database is read-only.";
}

export async function run(
  conn: Awaited<ReturnType<typeof connect>>,
  sql: string,
): Promise<QueryResult> {
  const t0 = performance.now();
  try {
    const table = await conn.query(sql);
    const columns = table.schema.fields.map((f) => f.name);
    const rows = table.toArray().slice(0, 200).map((r) => {
      const o = r.toJSON() as Record<string, unknown>;
      return columns.map((c) => {
        const v = o[c];
        if (v === null || v === undefined) return null;
        if (typeof v === "bigint") return Number(v);
        if (typeof v === "object") return String(v);
        return v;
      });
    });
    return { ok: true, columns, rows, ms: Math.round(performance.now() - t0) };
  } catch (e) {
    return { ok: false, reason: explain(e instanceof Error ? e.message : String(e)) };
  }
}
