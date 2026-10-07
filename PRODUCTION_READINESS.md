# Care Gap Explorer — Production Readiness

Audit date: October 7, 2026 · Branch audited: `redesign/landing-review` (`996569e`)
· Nothing was deployed or configured.

## Executive Summary

**READY WITH FIXES**

**What already works.** The web application builds as a fully static site. It
has no server code, needs no secrets and has no runtime dependency on
localhost. All the checks pass:

- lint (no errors)
- type checking
- 97 unit tests
- the local and GitHub Pages builds

It is compatible with Vercel as it stands. No secrets are tracked in git or
appear anywhere in its history. Every patient record is synthetic (Synthea).

**What blocks launch.** Three P0 issues:

1. **"Review this project" delivers nothing.** No feedback endpoint is
   configured, so every review is discarded. The modal says so honestly, but
   the project owner never receives anything.
2. **The repository's own deploy workflow fails on `main`.** The last two
   GitHub Pages runs (October 2 and 3) failed in the Python test step, so the
   live `github.io` site has been frozen since October 2.
3. **None of the redesign is on `main`.** It sits in 27 commits on
   `redesign/landing-review`, and both GitHub Pages and Vercel deploy from the
   production branch.

## Production Build

| Check | Result |
|---|---|
| Dependencies | `npm ci` installs cleanly from the lockfile (Node 22 in CI; 24 locally). No `engines` field. |
| Lint | 0 errors, 1 warning (TanStack Table is not memoised by the React Compiler; expected and harmless) |
| Type checking | Pass |
| Unit tests | 97 / 97 pass (`node --test lib/*.test.ts lib/ask/*.test.ts`) |
| `npm run build` | Pass. 136 static pages, including 116 patient records. Also passes with `NEXT_PUBLIC_BASE_PATH=/clinical-care-gap-explorer`. |
| `npm start` | **Not applicable.** Next.js refuses it with `output: "export"` ("Use `npx serve out` instead"). The built `out/` folder is what is served. |
| Console errors | None on 18 routes × 6 widths (Phase 11 QA, same code) |
| `npm audit --omit=dev` | 7 high. All come through the `shadcn` CLI (`braces` → `micromatch` → `fast-glob` → `ts-morph`). This is build-time tooling, listed as a runtime dependency only because `globals.css` imports `shadcn/tailwind.css`. None of it ships to the browser. |
| Deprecated | `eslint@9` carries an upstream support notice (dev-only) |
| Outdated | Minor versions available (`next` 16.4, `react` 19.3). Major versions (`typescript` 7, `eslint` 10, `@tanstack/react-table` 9) are not needed for launch. |
| **Python pipeline tests (CI deploy gate)** | **Fail.** `tests/test_guard.py` imports `caregap.agent.text_to_sql`, which imports `anthropic` and `dotenv`. Neither is declared in the committed `pyproject.toml`, so CI fails with `ModuleNotFoundError: anthropic` (runs 37033770259 and 37121042732). Your *uncommitted* `pyproject.toml` adds both. Your uncommitted working copy also deletes `src/caregap/agent/guard.py`, which the same test imports. |

## Routing

| Route | Type | Notes |
|---|---|---|
| `/` | Static (○) | Public landing page. No app shell. Take a tour, welcome dialog. |
| `/home`, `/care-gaps`, `/patients`, `/tasks`, `/analytics`, `/ask`, `/learn`, `/learn/{diabetes,care-gaps,using-the-app,care-teams}`, `/data-quality`, `/help`, `/settings`, `/overview`, `/pipeline` | Static (○) | Prerendered HTML, with client components hydrating on top |
| `/patients/[patientId]` | SSG (●), 116 pages | `dynamicParams = false`: an unknown ID gets the 404 page |
| `/404` | Static | App shell, `noindex` |

- **Client-rendered parts:**
  - Filters, sorting and the open drawer read the URL query on the client,
    inside `Suspense`. The prerendered default view shows first.
  - Tasks, Ask AI chats and the tour's first-visit flag are client-only,
    stored in `localStorage`.
- **Direct links and refresh:** every route exists as `out/<route>/index.html`
  (checked: 17 routes plus 116 patient pages), so direct navigation and refresh
  work on any static host. With `trailingSlash: true`, `/home` is served as
  `/home/`.
- **Query-string deep links** (`/care-gaps/?status=never`,
  `/tasks/?open=<id>`) work after hydration.
- **Back and Forward:** verified in Phase 11 (Patients URL state, the
  landing → app → landing journey).
- **Landing page versus app Home:** separate. `/` is the landing page, outside
  the app shell. `/home` is the dashboard. The app's logo and its "Project
  overview" link go to `/`.
- **localhost:** no route or code assumes it (see the next section).

## Localhost & Development Dependencies

Search: `localhost`, `127.0.0.1`, absolute URLs, local paths, debug flags,
mock or test endpoints.

| Occurrence | Where | Production relevance |
|---|---|---|
| `https://franklin0603.github.io/clinical-care-gap-explorer` | `web/app/layout.tsx` (`SITE`: `metadataBase`, OG `url`, OG and Twitter image) | **Relevant.** Every share card and OG URL points at the GitHub Pages site. On another host or domain, links shared from it would point back to the stale Pages site. |
| `https://github.com/Franklin0603/clinical-care-gap-explorer` | `app/(app)/help/page.tsx`, `app/(app)/data-quality/page.tsx` | Fine: source links, correct as long as the repository keeps its name |
| `https://cdn.jsdelivr.net/npm/@duckdb/...` (via `duckdb.getJsDelivrBundles()`) | `web/lib/sql.ts` | **Runtime third-party dependency.** Downloaded only when a visitor types a `SELECT` into Ask AI. Works in production; fails offline or if jsdelivr is blocked. |
| `localhost`, `127.0.0.1` | — | None in `web/app`, `web/components`, `web/lib`, config or the workflow |
| Local file path | `notebooks/01_profile.ipynb` (one saved output line) | Shows your macOS username in a public notebook. Cosmetic. |
| Debug flags, mock or test endpoints | — | None. The review endpoint is deliberately unset (see below). |

## Environment Variables

| Variable | Purpose | Client / server | Required in production? | Secret? | Current fallback |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_BASE_PATH` | Path prefix for hosting under a sub-path (GitHub Pages project site) | Build time; inlined into client and HTML | Only for `github.io/clinical-care-gap-explorer`. **Leave unset on Vercel or a custom domain.** | No | `""` (served at the root) |
| `NEXT_PUBLIC_REVIEW_ENDPOINT` | URL that "Review this project" POSTs JSON to | Client (inlined at build) | **Yes**, for feedback to be delivered | No. It is a public form URL by design and must never carry a key. | `""`. The modal says the review was not sent and offers Copy. |
| `ANTHROPIC_API_KEY` | Python text-to-SQL agent in `src/caregap/agent/` (pipeline work, not the web app) | Local Python only | **No.** Do not set it on the host. | **Yes** | In `.env`, which is untracked, git-ignored and never committed. `.env.example` (tracked) holds an empty placeholder. |
| *(proposed)* `NEXT_PUBLIC_SITE_URL` | Production origin for `metadataBase`, OG and Twitter URLs | Build time | Yes, once a domain is chosen (P1) | No | Not implemented; currently hard-coded to `github.io` |

- **Secrets in the client:** none. No `NEXT_PUBLIC_*` variable holds a secret,
  and the web app reads no secret at all.
- **Missing `web/.env.example`.** Recommended contents:
  ```
  # Sub-path when hosted under one (GitHub Pages project site). Empty for Vercel or a domain root.
  NEXT_PUBLIC_BASE_PATH=
  # Public form endpoint for "Review this project" (e.g. https://formspree.io/f/xxxxxxx). Not a secret.
  NEXT_PUBLIC_REVIEW_ENDPOINT=
  # Production origin for share cards and canonical URLs, no trailing slash.
  NEXT_PUBLIC_SITE_URL=
  ```

## Review Submission Architecture

**Current flow, traced:**

1. **Where the form is:** `components/review/ReviewDialog.tsx`, a centred
   modal opened from "Review this project" in the app sidebar
   (`components/shell/AppSidebar.tsx`). It is only on app routes, never shown
   automatically, and not on the landing page.
2. **Fields:**
   - Required: role (8 options), clarity rating 1–5, usefulness rating 1–5,
     the part that stood out (7 options).
   - Optional: "What would you improve or add?" (up to 2,000 characters) and
     email.
   - Added automatically: `submittedAt` (ISO time) and `page`, the path it was
     opened from with any patient ID replaced by `[patient]` and query and
     fragment removed.
   - Not collected: name or organization. An earlier brief removed them; this
     one asks for them back (see P1-5).
3. **Validation, client-side** (`lib/review.ts`): the four required answers;
   ratings within 1–5; text at most 2,000 characters; email format if given.
   Free text containing something shaped like an MRN or UUID is blocked. Unit
   tested.
4. **On Submit:** `sendReview()` POSTs the version-2 JSON record if
   `NEXT_PUBLIC_REVIEW_ENDPOINT` is set. **It is not set**, so it returns
   `not-configured` without making a network request. The modal shows "Thank
   you… this review was not sent or stored" with Copy review and Done.
5. **Storage and services in use:**
   - Browser state only: React state in `ReviewProvider`.
   - No localStorage, API route, server action, external service, database or
     email.
   - Nothing mocked: it never claims a send it did not make.
6. **Survives refresh?** No. The draft lives in memory: it survives closing the
   modal and moving between app pages, but not a reload.
7. **Does the owner receive it?** **No.**
8. **Will it work after deployment?** Not as configured. It will keep
   discarding reviews, honestly, until an endpoint is set.
9. **Secrets needed?** None for the recommended design.
10. **Abuse and spam protection:** none, beyond client-side validation, which
    does not count.

**Recommended production architecture (smallest reliable).**

The app is a static export, so it cannot host an API route without giving up
static export. Keep it static and point the existing hook at a form backend.
Recommendation: **Formspree** (or an equivalent hosted form endpoint).

```
Reviewer → Review this project (modal) → POST JSON → https://formspree.io/f/<id>
                                                   ├─ email notification to project owner
                                                   ├─ stored in Formspree dashboard (CSV export)
                                                   └─ spam filtering
```

- **Why:**
  - It works unchanged on GitHub Pages and Vercel.
  - It accepts JSON from the browser, with CORS handled.
  - No secret is needed: the form URL is public by design.
  - It stores and emails each submission, and filters spam.
  - The free tier is ample for portfolio feedback.
- **Ruled out: Google Apps Script.** A JSON POST triggers a CORS preflight it
  does not answer.
- **Ruled out: a Vercel route handler.** It would mean dropping
  `output: "export"`, a larger change.
- **Small code changes for 12B, about 15 lines:**
  - Send `Accept: application/json` (Formspree replies with JSON rather than a
    redirect).
  - Add a hidden honeypot field (`_gotcha`).
  - Optionally re-add optional Name and Organization fields.
  - Set `NEXT_PUBLIC_REVIEW_ENDPOINT` in the host's build environment.
- **Then:** the existing success state ("Your feedback has been received…")
  appears only on a 2xx response. A failure keeps the answers and offers Try
  again or Copy. The contract is documented in `docs/planning/review-api.md`.
- **Privacy:** the email is reviewer contact information, optional and labelled
  as such. No patient information is collected, and identifiers are blocked in
  free text.

## Media Assets

| File | Type | Size | Where used |
|---|---|---|---|
| `videos/using-care-gap-explorer.mp4` | MP4 1080p, 81.6 s | 16.0 MB | Learn hub, Using Care Gap Explorer |
| `videos/understanding-a1c.mp4` | MP4 1080p, 53.1 s | 14.9 MB | Learn hub, Understanding Diabetes |
| `videos/understanding-a1c-care-gap.mp4` | MP4 1080p, 60.9 s | 3.3 MB | Learn hub, Understanding A1C Care Gaps |
| `videos/*.vtt` (3) | WebVTT captions | 1–2 KB each | All three videos |
| `case-study/Care-Gap-Explorer-Case-Study.pdf` | PDF, 14 pages | 1.1 MB | Landing case-study panel, tour slide 6 |
| `og.png` | PNG 1200×630 | 387 KB | Open Graph and Twitter card |
| `img/data-pipeline-lineage.png` | PNG | 348 KB | Data & Quality |
| `img/left-vs-inner-join.png` | PNG | 273 KB | Data & Quality |
| `img/landing/app-home-full.webp` | WebP | 115 KB | Landing hero (eager), tour slide 1 |
| `img/learn/app-*.webp` (7) | WebP screenshots | 42–74 KB | Landing, Using Care Gap Explorer, tour |
| `img/learn/{bloodstream,insulin,red-cells,food-to-glucose}.webp` | WebP illustrations | 35–59 KB | Understanding Diabetes, landing, tour |
| `img/landing/{case-study-cover,learn-care-gaps}.webp` | WebP | 59 / 20 KB | Landing |
| `img/video-posters/*.webp` (3) | WebP | 32–36 KB | Video posters |
| `img/04_a1c_floor.png` | PNG | 66 KB | `/pipeline` |
| `img/01_cohort_funnel.png`, `02_inner_join.png`, `06_asof_drift.png`, `img/hero.webp` | PNG / WebP | 279 KB total | **Unused by the app** (the docs use their own copies in `docs/img/`) |
| `app/favicon.ico` | ICO | 25.9 KB | **Stock create-next-app favicon** |
| Fonts | — | — | None downloaded: system font stack |

- **Videos** are bundled in the repository (35 MB, tracked in git) and served
  from the same origin. They use `preload="none"`, with poster images and no
  autoplay, so no MP4 is downloaded until play is pressed (verified).
- **Images:** all non-hero images are lazy-loaded.
- **Optional:** re-encode the two large videos at a lower bitrate or 720p
  (likely 50–60% smaller, little visible loss at the player's size). This only
  affects people who press play. P2.

## Technical Case Study

| Check | Result |
|---|---|
| File exists | `web/public/case-study/Care-Gap-Explorer-Case-Study.pdf` (PDF 1.6, 14 pages, 1.1 MB) |
| Public path / links | `${BASE}/case-study/Care-Gap-Explorer-Case-Study.pdf` from the landing page and tour slide 6. The link returned 200 in the Phase 11 link check. |
| In the production build | Yes: `out/case-study/…pdf`, with the base path applied in the Pages build |
| Direct URL | Works (static file) |
| Filename | Professional |
| Display / download | Browsers display it inline. The link opens in the same tab; the browser's own controls download it. |
| Note | Rendered by LibreOffice with substitute fonts for IBM Plex. Readable, but a PowerPoint export with Plex installed would be sharper. Content was not changed in this phase. |

## Synthetic Data & Privacy

- **Patient records:** all generated by Synthea. MRNs are truncated synthetic
  UUIDs. Every page and the share card say "Synthetic data". No real PHI.
- **Secrets:**
  - No API keys, tokens, private keys or passwords in any tracked file.
    Patterns checked: Anthropic, AWS, GitHub, Slack, Google, PEM, and
    `password=`/`secret=`/`token=` assignments.
  - None anywhere in git history.
  - The only env file ever committed is `.env.example`, with an empty value.
- **Local secret:** `.env` holds `ANTHROPIC_API_KEY`. It is untracked and
  ignored by both `.gitignore` files. No rotation is needed: it was never
  exposed.
- **Personal data:** no personal emails or phone numbers in tracked files. One
  local path, with your macOS username, in `notebooks/01_profile.ipynb` output.
- **Local files that must never be committed** (untracked): `.venv.icloud-evicted/`
  (350 MB), `docs/videos/` (34 MB, duplicates `web/public/videos`),
  `docs/presentation/`, and the `-DO_NOT_USE` and agent work in progress.
  Never use `git add -A` here.

## Client Data Exposure

**What ships publicly**, in `web/public/data/` (1.5 MB):

- the patient-level Gold measure (`care_gap_a1c`, `care_gap_full`)
- `patient_detail.json` (911 KB: A1C history, medications and procedures for
  the 116 cohort patients)
- reports: `gold_report`, `dq_report`, `reconciliation`, `manifest`,
  `age_bands`
- audit trails: `quarantine` (164 KB of rejected rows with reasons),
  `remediation_log`, `identity_review`
- Parquet copies for DuckDB SQL

**What does not ship:**

- raw CSVs and the Bronze or Silver warehouse (`data/raw/`, `*.duckdb`)
- `data/` source files, apart from small committed reports

All of these are git-ignored.

**Shipped but unused by the app:** the role-scoped exports `care_gap_nurse`,
`care_gap_physician` and `care_gap_pct` (`.json` and `.parquet`, about
160 KB). They demonstrate the pipeline's role-based export design (ADR 0016
chose patient detail over role views), but no page reads them.

All data is synthetic, so this is a tidiness issue, not a privacy one: either
remove them from `public/` or keep them deliberately as published artefacts
(P2).

**Client bundle:** the landing page no longer bundles patient rows (fixed in
Phase 11). App pages bundle the Gold rows (61 KB) by design.

## Ask AI

- **Runs entirely client-side.** `lib/ask/engine.ts` is a rule-based
  interpreter over the bundled Gold rows and `patient_detail.json`.
- **No API, no LLM and no key.** It needs no environment variable. The page
  says "computed in this browser by rules, not a language model".
- **SQL mode:** a typed `SELECT` runs read-only in DuckDB-WASM against the
  published Parquet. The WebAssembly comes from `cdn.jsdelivr.net` (several
  MB, on first SQL use only).
- **Storage:** conversations are kept in `localStorage`.
- **Production behaviour** matches local exactly. The only external
  requirement is reaching jsdelivr for SQL mode.

## Browser Storage

| Key / mechanism | What | Scope |
|---|---|---|
| `localStorage` `care-gap-explorer.tasks.v1` | Task status, assignee, due date, workflow notes, activity history | This browser only |
| `localStorage` `care-gap-explorer.ask.v1` | Ask AI conversations, pins, groups, names | This browser only |
| `localStorage` `care-gap-explorer.visited.v1` | First-visit flag (the welcome shows once) | This browser only |
| Cookie `sidebar_state` | Sidebar expanded or collapsed (shadcn) | This browser only; functional, not tracking |
| Review draft | React memory only | Lost on reload |
| `sessionStorage`, IndexedDB | Not used by app code | — |

Workflow data is labelled throughout as **demo workflow data**:

- "Not a clinical note. Saved in this browser."
- Tasks says completion never changes the clinical status.
- The landing page says tasks are "saved only in your browser".

Nothing is represented as server-persisted clinical information.

## SEO & Social Sharing

| Item | Current |
|---|---|
| `<title>` | Landing: "Care Gap Explorer · Find the patients behind the care gap". App: "%s · Care Gap Explorer". |
| Description | Landing: "An explainable A1C monitoring workflow on synthetic healthcare data… A portfolio project." Root: an older description ("Finds diabetic patients overdue…"). |
| Favicon | **Stock Next.js favicon** |
| Open Graph / Twitter | Present (`summary_large_image`). The image is the regenerated `og.png`, 1200×630, marked synthetic. URLs are hard-coded to `github.io`. |
| Canonical | None |
| robots.txt / sitemap | None. 404 pages emit `noindex`. |

**Recommended values** (applied once the domain is known; no domain is invented
here):

- **Title:** "Care Gap Explorer". The landing page keeps its tagline.
- **Description:** "An explainable healthcare data application for
  identifying and exploring A1C monitoring gaps in a synthetic diabetes cohort.
  A portfolio project; not for clinical use."
- **Favicon:** the heart-pulse mark used in the app.
- **Canonical and URLs:** `metadataBase` from `NEXT_PUBLIC_SITE_URL`, plus
  `alternates.canonical` per page.
- **Crawling:** add `app/robots.ts` (allow all) and `app/sitemap.ts`. Both are
  supported with static export.

## Error Handling

- **404:** `out/404.html` with the app shell, a plain message, "Go to Home"
  and `noindex`. GitHub Pages and Vercel both serve it for unknown paths.
- **Unknown patient ID:** `dynamicParams = false`, so it gets the 404 page.
- **Runtime errors:** `app/(app)/error.tsx` covers every app route with a plain
  message and "Try again". **The landing page (`/`) has no error boundary**, and
  there is no `global-error.tsx`. The landing page is mostly static, so the
  risk is low, but a client error there would show Next's generic message.
- **Failed data loads:** the patient workspace and Analytics testing history
  show "unavailable" with Try again (tested in Phase 11).
- **Failed media:** videos show their poster, with fallback text if the
  browser can't play the file. A failed image shows its alt text.
- **Failed review:** answers are kept, with Try again and Copy review.
  Unit-tested; not reachable in the browser until an endpoint exists.

## Performance

Measured from the uncompressed local server; hosts compress, so real transfers
are smaller.

| Page | First load | Note |
|---|---|---|
| `/` | about 2.1 MB, 530 KB of initial JS | Next prefetches the linked app routes in idle time, including Recharts at 438 KB |
| `/home` | about 2.9 MB, 2.1 MB of JS | |
| `/analytics` | about 3.8 MB | Includes `patient_detail.json` (911 KB) for one chart |

**Meaningful improvements, in priority order:**

1. **`patient_detail.json` (911 KB)** is fetched for the Analytics testing
   chart and each patient workspace. A host's gzip or brotli shrinks JSON
   roughly 5–8×, so it is acceptable for launch. Splitting the yearly counts
   out for Analytics would cut most of that page's weight (P2).
2. **Video re-encode** (P2, as above).
3. **Self-host the DuckDB WASM** only if offline or CDN independence matters
   (P2).

Fonts: none. Charts: Recharts loads only on chart pages. PDF: loaded on click
only.

## Hosting Compatibility

**The architecture:** a static export (`output: "export"`, `trailingSlash`,
`images.unoptimized`). There are no API routes, server actions, middleware or
ISR, and no server runtime.

**GitHub Pages** (current workflow, `.github/workflows/deploy.yml`):

- It works once the Python test step passes (P0-2).
- It is a project site under `/clinical-care-gap-explorer`, which is why
  `NEXT_PUBLIC_BASE_PATH` exists.

**Vercel: compatible, and appropriate.** Vercel builds a static export
natively and serves `out/` from its CDN, including `404.html`. Settings:

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework | Next.js (auto-detected) |
| Build command | `npm run build` |
| Install command | `npm ci` |
| Node | 22 |
| `NEXT_PUBLIC_BASE_PATH` | **unset** (served at the root) |
| `NEXT_PUBLIC_REVIEW_ENDPOINT` | set |

**Things that complicate it:**

- **Hard-coded share URLs.** `metadataBase` and the OG/Twitter URLs point at
  `github.io` (P1-1).
- **Two public URLs.** If GitHub Pages also stays live, the two sites will
  diverge. Pages is already stale (P1-3).
- **Python tests aren't run by Vercel.** The repository's CI would still be
  red on GitHub, which hiring managers can see.
- **Videos and the PDF** are well within Vercel's static file limits.
- **Hobby plan:** intended for personal, non-commercial projects, which suits
  a portfolio.

## Repository Hygiene

- **`.gitignore`:** covers raw data, warehouses, `.venv`, `node_modules`,
  `.next`, `web/out`, `.env*` (except `.example`) and `.vercel`.
- **Tracked files:** no generated build output; 314 tracked files.
- **Large tracked binaries:**
  - the three MP4s (35 MB; each under GitHub's 100 MB limit)
  - the PDF (1.1 MB)
  - `og.png`, `tools/assets/og_background.webp`, PNG figures
- **Untracked local artefacts to keep out of git:** see Synthetic Data &
  Privacy.
- **Working copy:** your in-progress Python agent changes are uncommitted
  (`pyproject.toml`, `text_to_sql.py`, the deleted `guard.py`, `evals/`,
  notebooks). They directly affect the CI test gate (P0-2).
- **iCloud:** the repository lives in `~/Documents`, which iCloud syncs. It
  has already evicted `node_modules` and `.venv` once; a local reliability
  risk, not a deploy one.
- **Safe to push publicly?** **Yes**: no secrets, no real data, and nothing
  sensitive tracked. Continue staging explicit paths only.

## Required Fixes Before Deployment

### P0 — blocks deployment

| # | Issue | Why it matters | Recommended fix | Files | Priority |
|---|---|---|---|---|---|
| P0-1 | "Review this project" sends nowhere | Real reviewers' feedback is discarded; the owner receives nothing | Create a Formspree form. Add the `Accept: application/json` header and a honeypot. Set `NEXT_PUBLIC_REVIEW_ENDPOINT` in the build environment. Test one live submission end to end. | `web/lib/review.ts`, `web/components/review/ReviewDialog.tsx`, host env | P0 |
| P0-2 | Deploy workflow fails on `main` (`ModuleNotFoundError: anthropic` in the pipeline tests) | No GitHub Pages deploy can succeed; the repository shows red CI | Commit the `anthropic` and `python-dotenv` dependencies (your pending `pyproject.toml` change). Make sure `tests/test_guard.py` matches whether `guard.py` stays, so collection doesn't break. Alternatively, mark the agent tests as optional in CI. Your decision, as these are your Python files. | `pyproject.toml`, `tests/test_guard.py`, `src/caregap/agent/*`, `.github/workflows/deploy.yml` | P0 |
| P0-3 | The redesign is not on `main` (27 commits on `redesign/landing-review`) | Both hosts deploy the production branch | Open a PR from `redesign/landing-review` into `main`, review it, merge | — | P0 |

### P1 — should fix before public launch

| # | Issue | Why it matters | Recommended fix | Files | Priority |
|---|---|---|---|---|---|
| P1-1 | `metadataBase`, OG and Twitter URLs hard-coded to `github.io` | Share cards and canonical links point at the wrong (and stale) site after a host or domain change | Read `NEXT_PUBLIC_SITE_URL`, defaulting to the Pages URL | `web/app/layout.tsx` | P1 |
| P1-2 | Stock Next.js favicon | Looks unfinished in every browser tab and bookmark | Replace with the heart-pulse mark (`app/icon.svg` or `.png`) | `web/app/favicon.ico` | P1 |
| P1-3 | Live `github.io` site frozen at the October 2 version, and the README's "Live demo" points to it | Reviewers may find the old app | Either fix and keep Pages (P0-2) or retire it once the new host is live. Update the README link. | `README.md`, Pages settings | P1 |
| P1-4 | README describes an earlier app and leads with the injected-defects / "6 of 6 defect types caught" story removed from the site | It's the first thing a hiring manager reads on GitHub; it contradicts the app. The narrative is accurate about the pipeline, so whether to keep it is your call. | Refresh the README: current screenshots, landing and app links, the review link, and a decision on the defect narrative | `README.md`, `docs/` | P1 |
| P1-5 | The form lacks the optional Name and Organization this brief describes | Mismatch with the desired reviewer flow | Re-add two optional fields to the form, validation and record (`version: 3`), and update the API doc | `web/lib/review.ts`, `ReviewDialog.tsx`, `docs/planning/review-api.md` | P1 |
| P1-6 | No `web/.env.example` | Deployers can't see which variables exist | Add the file shown under Environment Variables | `web/.env.example` | P1 |

### P2 — improvements, not launch blockers

| # | Issue | Recommended fix | Files |
|---|---|---|---|
| P2-1 | `shadcn` CLI in runtime dependencies (7 high audit findings, build-time only) | Move to `devDependencies` (`npm ci` still installs it for the build) | `web/package.json` |
| P2-2 | No `robots.txt`, sitemap or canonical | Add `app/robots.ts` and `app/sitemap.ts`, with canonical via `metadataBase` | `web/app/` |
| P2-3 | Landing page has no error boundary | Add `app/error.tsx` (root) or `global-error.tsx` | `web/app/` |
| P2-4 | Unused public files: 4 images (279 KB); role-scoped data exports (about 160 KB) | Remove, or keep deliberately and document | `web/public/img`, `web/public/data` |
| P2-5 | Large videos (16 MB and 15 MB) | Re-encode at a lower bitrate or 720p | `web/public/videos` |
| P2-6 | `patient_detail.json` (911 KB) loaded for one Analytics chart | Export a small yearly-counts file for Analytics | pipeline export, `TestingOverTime.tsx` |
| P2-7 | DuckDB WASM from jsdelivr at runtime | Self-host only if CDN independence matters | `web/lib/sql.ts` |
| P2-8 | Local path in notebook output | Clear that cell's output | `notebooks/01_profile.ipynb` |
| P2-9 | No `engines` field; Node 22 in CI, 24 locally | Add `"engines": { "node": ">=22" }` | `web/package.json` |
| P2-10 | Case-study PDF rendered with substitute fonts | Re-export from PowerPoint with IBM Plex installed | `web/public/case-study/` |
| P2-11 | Repository in iCloud Drive | Move the working copy out of `~/Documents` | — |

## Proposed Deployment Architecture

This matches what the repository actually is: a static Next.js export with no
server code, and a hosted form endpoint as the only service.

```
GitHub (main)
   │  push / merge
   ▼
Vercel  — root dir: web/, `npm ci && npm run build`, static export → out/
   │
   ▼
Vercel CDN (static files only; no server functions)
   ├── /                      Public landing page, Take a tour, case-study PDF
   ├── /home … /settings      Care Gap Explorer (client components)
   ├── /patients/<id>/        116 prerendered patient pages
   ├── /data/*.json|parquet   Synthetic Gold exports + audit reports
   ├── /videos, /img          Learn media (videos load on play only)
   │
   ├── Review this project ──POST JSON──►  Formspree form endpoint
   │                                          ├─► email to project owner
   │                                          └─► stored submissions (CSV export)
   │
   └── Ask AI (SQL mode only) ──►  cdn.jsdelivr.net (DuckDB-WASM)

Visitor's browser: tasks, notes, Ask AI chats, first-visit flag (localStorage)
```

Keeping GitHub Pages instead is equally viable. The diagram is the same with
"GitHub Actions → Pages" in place of Vercel and
`NEXT_PUBLIC_BASE_PATH=/clinical-care-gap-explorer`. Pick one host so only one
public URL exists.

## Deployment Checklist (Phase 12B)

- [ ] Decide the host: Vercel (recommended) or GitHub Pages; and the URL or
      domain
- [ ] Resolve the Python CI gate (P0-2) and confirm a green workflow run
- [ ] Create the Formspree form; note its endpoint URL
- [ ] Review integration: `Accept: application/json`, honeypot, optional Name
      and Organization (P0-1, P1-5); update `docs/planning/review-api.md`
- [ ] Add `NEXT_PUBLIC_SITE_URL`; derive `metadataBase` and OG URLs from it
      (P1-1)
- [ ] Replace the favicon (P1-2)
- [ ] Add `web/.env.example` (P1-6)
- [ ] Refresh the README and update the "Live demo" link (P1-3, P1-4)
- [ ] Run lint, type checking, unit tests and `npm run build` locally
- [ ] Open a PR `redesign/landing-review` → `main`; review; merge (P0-3)
- [ ] Vercel project: root `web`, Node 22, env `NEXT_PUBLIC_REVIEW_ENDPOINT`
      and `NEXT_PUBLIC_SITE_URL`; **leave `NEXT_PUBLIC_BASE_PATH` unset**
- [ ] First deploy to a preview URL. Smoke test:
  - landing page, Take a tour and the welcome
  - every app route; refresh on a nested route; an unknown patient ID (404)
  - a video plays; the PDF opens; the share card previews correctly
- [ ] Submit one real review from the preview and confirm it arrives by email
      and in Formspree
- [ ] Promote to production. If moving off GitHub Pages, disable the Pages
      workflow or point it at the new site.
- [ ] Optional P2 items (move `shadcn` to dev dependencies, robots and sitemap,
      landing error boundary, unused assets)
- [ ] Open the live site once in Safari and on a phone (not covered by
      automated QA)
