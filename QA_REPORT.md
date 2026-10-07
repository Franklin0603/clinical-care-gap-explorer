# Care Gap Explorer — Final QA Report

Date: October 7, 2026 · Branch: `redesign/landing-review` · Build: static export (Next.js 16)

## Summary

The whole application was audited before public deployment: every public and
application route, at six screen widths, in headless Chrome. Each feature area
also had its own functional test, and the code was searched for inconsistencies.

The audit found **13 issues**: 2 High, 4 Medium and 7 Low. **9 are fixed** and
4 are accepted with reasons. The two High issues were:

- Ask AI gave a wrong answer to "Show me never-tested patients."
- The deliberately "injected defects" story was still visible in several places.

Lint (no errors), type checking, 97 unit tests and both production builds pass.
No console errors appeared on any tested route.

**How it was tested.** Everything below was run in headless Chrome 154 on
macOS, using scripted checks over the Chrome DevTools Protocol against the
production build.

**What was not tested.** Other browsers (Safari, Firefox), real phones and
tablets, screen readers, the deployed GitHub Pages site itself, and dark mode.
These are listed under limitations rather than claimed.

## Routes Tested

18 routes × 6 widths (1440, 1280, 1024, 768, 390, 375) = **108 page loads**. On
each load, the test checked for:

- horizontal overflow, with the overflowing element named
- console errors and warnings
- HTTP errors
- broken images
- the number of `h1` headings, and skipped heading levels
- controls without an accessible name, and images without an `alt` attribute
- empty or `#` links
- the presence of the synthetic-data notice

| Area | Routes |
|---|---|
| Public | `/` (landing page, Take a tour, first-visit welcome) |
| Application | `/home`, `/care-gaps`, `/patients`, `/patients/[id]` (sample patient), `/tasks`, `/analytics`, `/ask`, `/data-quality`, `/help`, `/settings` |
| Learn | `/learn`, `/learn/diabetes`, `/learn/care-gaps`, `/learn/using-the-app`, `/learn/care-teams` |
| Older routes still reachable | `/overview` (shown under Analytics), `/pipeline` (shown under Data & Quality) |

**Results**

- No horizontal overflow on any page at any width.
- No console errors, failed requests or broken images.
- Every page has exactly one `h1` and no skipped heading levels.
- The synthetic-data notice is present on all 108 loads.
- All **46 unique internal links** return 200, including the case-study PDF.
- 17 links were flagged as unnamed. All of them sit inside collapsed
  `<details>` sections and have visible names when expanded, so they are false
  positives.

## Data Reconciliation

The canonical values come from the pipeline's `gold_report.json`.

**116 total · 91 current · 25 open gaps · 21 never tested · 4 overdue ·
data through Aug 23, 2026**

| Where | Verified in the browser |
|---|---|
| Landing page hero, "Why this matters" cards, Data & Quality panel | 116 · 25 · 91 / 4 / 21 |
| Take a tour, slides 1 and 4 | 116, 25, 21, 91 · 91 / 4 / 21 · "25 open gaps = 21 never tested + 4 overdue" |
| Home cards | 116, 25, 21, 91 |
| Care Gaps segments | All 25 · Never tested 21 · Overdue 4 |
| Patients segments and filters | 116 · Current 91 · Open gap 25 · Never tested 21 · Overdue 4 |
| Tasks | 25 tasks, one per open gap |
| Analytics summary | 116 · 91 (78.4%) · 25 (21.6%) · 21 (84.0% of gaps) |
| Ask AI | 116 · 25 · 21 · 78.4% current · age 45–64 is 15 of 51 |
| Learn 365-day timeline | 91 current · 4 overdue · 21 never tested |
| Data & Quality | 116 = 91 + 25 PASS · 25 = 21 + 4 PASS |

Reconciliation is also checked against the patient rows on every build, by the
Data & Quality page and by unit tests.

**Typed-in numbers.** Cohort figures that were written into the text by hand
have been replaced with values read from the data:

- the glossary's cohort, as-of-date and denominator definitions
- the landing page's screenshot alt text
- the social-sharing image's alt text

The one claim in that text that came from outside the exports, "69 of 161
coded patients have a gap if the deceased are included", was re-checked
against the warehouse (`data/warehouse/clinical.duckdb`, read-only). It is
correct and is now recorded with the other audited figures in `lib/quality.ts`.

No measure definition, cohort rule or data file was changed.

## Navigation

The full journey was tested:

1. Landing page → Take a tour → "Explore Care Gap Explorer" → `/home`
2. → Care Gaps → patient → Tasks → Analytics → Ask AI → Learn → Data & Quality
3. → Project overview → `/`

**Results**

- **Back:** from the landing page, it returns through `/care-gaps`, `/home`
  and `/` in order.
- **Forward and deep links:** tested on Patients, including filters held in
  the URL and refreshing the page.
- **Active navigation and breadcrumbs:** correct on every application route.
  Older routes show under the item that adopted them.
- **Home versus Project overview:** "Home" opens `/home`. The logo and
  "Project overview" both open `/`, by mouse and by keyboard (Enter).
- **Mobile:** the sidebar opens from the header button, and both "Project
  overview" and the logo link work. The menu closes after a link is followed.
- **Landing header:** its section links are shown from 1024px up. They were
  wrapping onto two lines at 768px (fixed below).

## Responsive Design

- All 108 route × width loads were free of horizontal overflow.
- Screenshots were reviewed by eye at:
  - 1024 and 768: landing page
  - 768: Home, task drawer, Ask AI, Data & Quality
  - 1024: Care Gaps
  - 375: patient workspace, Analytics, Learn module
  - 1280: Help, Settings
- **Tour:** at 820px and 390px it stays centred, the slide body scrolls, and
  the controls stay visible.
- **Review modal:** 358px wide on a 390px phone, centred, scrolling inside.
- **Tables:** Care Gaps, Patients and Tasks switch to cards on phones. The
  patient tabs scroll sideways if needed.
- **Videos:** 16:9 at every width; 356px wide on a phone.
- **Data & Quality:** the lineage diagram stacks vertically on phones.

Fixed in this phase:

- breadcrumb collisions in the app header
- the landing header wrapping at 768px
- the patient tabs being clipped at 375px

## Accessibility

**Tested**

- **Headings and names:** semantic heading order on every route, and
  accessible names on every visible control (see Routes Tested).
- **Dialogs:**
  - The Review modal, tour and welcome all have dialog roles, a title and
    `aria-modal`.
  - Focus moves in on open and stays inside. After each Tab press settled,
    focus left the dialog 0 times in 60 presses, both forwards and backwards.
  - Escape, a backdrop click and the X all close them, and focus returns to
    the button that opened them. The page's scroll position is kept.
- **Statuses:** Current, Overdue and Never tested always carry text and an
  icon, never colour alone.
- **Contrast**, measured in the browser against WCAG:

  | Pair | Ratio |
  |---|---|
  | Muted text on background / card / sidebar / muted fill | 5.45 / 5.51 / 5.27 / 4.90 |
  | Blue link on background | 4.62 |
  | White on blue button | 4.56 |
  | Body text | 17.5 |
  | Status text on its own tinted badge (danger / warning / success / info) | 5.10 / 4.85 / 4.80 / 5.15 |

  All meet AA (4.5:1).
- **Videos:** English captions are present, and Space plays and pauses a
  focused video.
- **Reduced motion:** the tour opens paused, with no slide animation and
  numbers shown at their final value.

**Not tested**

- Real screen readers (VoiceOver, NVDA).
- Contrast of the few text styles that also lower opacity (for example
  `text-muted-foreground/80`).

## Media

| Video | Module | Poster | Length shown / actual | Captions | Plays |
|---|---|---|---|---|---|
| Understanding A1C | Understanding Diabetes | ✓ | 0:53 / 53.1 s | ✓ | ✓ 1920×1080 |
| Understanding an A1C Care Gap | Understanding A1C Care Gaps | ✓ | 1:01 / 60.9 s | ✓ | ✓ 1920×1080 |
| Using Care Gap Explorer | Using Care Gap Explorer | ✓ | 1:22 / 81.6 s | ✓ | ✓ 1920×1080 |

- **Players:** `preload="none"`, no autoplay, native controls. No MP4 is
  downloaded on any page until play is pressed.
- **Illustrations:** all four on Understanding Diabetes and all six screenshots
  on Using Care Gap Explorer load. The Data & Quality images load.
- **Not reviewed:** the wording of the captions themselves; only their
  presence and loading were checked.

## Performance

Measured on a cold cache from the local static server, which does not compress
files. GitHub Pages compresses them, so real transfers will be smaller.

| Page | Total | JavaScript | Notes |
|---|---|---|---|
| `/` | 2.1 MB → initial JS cut from ~0.82 MB to 0.53 MB | see fix | Remaining JS includes Next.js prefetching the app routes it links to |
| `/home` | 2.9 MB | 2.1 MB | |
| `/learn/using-the-app` | 3.1 MB | 2.1 MB | 317 KB of lazy-loaded WebP screenshots |
| `/analytics` | 3.8 MB | 2.1 MB | 912 KB `patient_detail.json` for the testing-history chart |

- **Fixed:** the landing page's JavaScript bundled every patient row (293 KB)
  because the tour imported the shared data module for five numbers. The tour
  now imports only the summary report.
- **Images:** screenshots and illustrations are WebP, lazy-loaded except the
  landing hero.
- **Videos:** 35 MB in total, never preloaded.

## Functional Testing

| Area | Tested | Result |
|---|---|---|
| Care Gaps | status tabs, MRN search, setting/age/insulin filters with counts, sort orders, empty result ("No open gaps match these filters"), patient review drawer, tablet/mobile layouts | Pass |
| Patients | all filters and combinations, search, an empty search, URL state with Back/Forward/refresh, pagination, sort, record pages | Pass |
| Patient workspace | Overview/A1C/Medications/Procedures tabs, never-tested, overdue and current patients, patient with no medications or procedures (explained empty states), load-error state and retry | Pass |
| Tasks | quick actions to Completed, status history, filters, reload persistence, "Completed does not close the gap" note, clinical numbers unchanged by tasks, mobile drawer | Pass |
| Analytics | summary, charts, links to filtered lists, small-group notes, chart load-error state and retry | Pass |
| Ask AI | the five questions from the brief (see below), follow-ups, read-only SELECT, write statements refused, off-topic questions, chat history (pin, group, rename, search, delete, reload), mobile | Pass after one fix |
| Learn | four modules, pager, videos, Go deeper sections, glossary term tooltips | Pass |
| Data & Quality | lineage, reconciliation, measure, 29 checks, decisions (LEFT JOIN, grain, fixed date, A1C floor), drift table, reproducibility, limitations, links | Pass |
| Take a tour | first-visit welcome (Take the tour / Explore on my own / X, not shown again after dismissal, a visit to the app counts as a visit); timings measured at 7.0, 9.0, 10.0, 11.0, 15.9, 9.1 s; progress bar fills over each slide's own time; Pause/Play, Previous/Next, markers and arrow keys; manual navigation pauses; final call to action; reduced motion; tablet and phone | Pass |
| Review this project | in the sidebar; centred; required-question validation; record identifier blocked in free text; success screen (with no endpoint it says plainly that the review was not sent); Done, Escape, backdrop, X; new form after Done; mobile | Pass |

**Ask AI, the five questions from the brief:**

- **Which age group has the highest gap rate?** 45–64, 29.4% (15 of 51). The
  18–44 band is excluded as too small (1 of 5).
- **How many patients have an open A1C gap?** 25, which is 21.6% of 116.
- **Show me never-tested patients.** 21 patients, after the fix below.
- **How did you calculate this?** Population 116, filter Never tested, result
  21, denominator 116.
- **Show me the SQL.** It is labelled as "an equivalent representation, not the
  query that was run". The input footer says answers are computed "by rules,
  not a language model".

**Review error state.** The "could not be sent" screen is covered by unit tests
of the send logic (failure status, network failure). With no endpoint
configured it can't be reached in the browser, so it was not seen there.

## Issues Found

| # | Issue | Severity | Status |
|---|---|---|---|
| 1 | Ask AI: "Show me never-tested patients." listed all 116 patients as never-tested ("Filters: None"). The parser only recognised "never tested" with a space. | High | Fixed |
| 2 | The injected-defects story was still visible: an "Inject defects" stage and "6 of 6 caught" badge on `/pipeline`, "249 rows damaged on purpose" on `/overview`, the "Catch rate" glossary entry, "6 of 6 defect types caught" on the social-sharing image and its alt text, and the A1C floor chart subtitle and caption | High | Fixed |
| 3 | Two lint errors (`react-hooks/refs`) in the tour component, missed in the previous phase's report | Medium | Fixed |
| 4 | App header breadcrumb overlapped the date or the Synthetic data badge at 768px and on phones | Medium | Fixed |
| 5 | "A1c" (about 390 places) and "A1C" (about 60) were mixed across the interface | Medium | Fixed in the interface; see #11 |
| 6 | The landing page shipped the full patient dataset in its JavaScript | Medium | Fixed |
| 7 | Landing header section links and product name wrapped at 768px | Low | Fixed |
| 8 | Patient workspace "Procedures" tab clipped at 375px | Low | Fixed |
| 9 | Cohort figures typed into the glossary and alt text instead of read from the data | Low | Fixed |
| 10 | At 768px with the sidebar open, Home summary cards are narrow and "Open A1C gaps" wraps to three lines | Low | Accepted |
| 11 | A few "A1c" strings come from the pipeline's data files (a remediation formula and a check name on `/pipeline`) and from the A1C floor chart's axis label | Low | Remaining |
| 12 | The landing page lets Next.js prefetch the app routes it links to (including the charting library) in idle time | Low | Accepted |
| 13 | Data & Quality lists 1 check as "Not evaluated" (procedures without a patient), and warns about 2,646 child rows of quarantined patients | Low | Accepted |

## Issues Fixed

1. **Ask AI parser** now accepts hyphenated forms ("never-tested",
   "never-been-tested"). A regression test covers three phrasings, the list
   length and the calculation answer (`lib/ask/engine.ts`,
   `lib/ask/engine.test.ts`).
2. **Injected-defects wording removed:**
   - `/pipeline`:
     - The stages are now Ingest, Validate, Correct and Gold.
     - The badge shows "223 rows quarantined".
     - The caption describes "20 values keyed in the wrong unit".
   - `/overview`: its data-quality cards now show checks, rows quarantined and
     A1C values corrected.
   - The "catch rate" glossary entry is removed.
   - The social-sharing image is regenerated with "223 rows quarantined, with a
     reason" (`tools/build_og.py`), and its alt text is updated.
   - The subtitle is cropped from the A1C floor chart image.
3. **Tour lint errors:** focus returns to the tour button by its id instead of
   a ref passed through context.
4. **App header:**
   - The breadcrumb clips and truncates its last item.
   - The section name and "Data through…" date appear from 1024px.
5. **"A1C" spelling** is used throughout the interface. Code identifiers
   (`A1cCharts`) and the full name "HbA1c" are unchanged. All 97 tests pass.
6. **Tour data:** the tour imports only `gold_report.json`.
7. **Landing header:** section links appear from 1024px, and the product name
   no longer wraps.
8. **Patient tabs:** the tab list sizes to its content, with tighter padding
   on phones.
9. **Glossary and alt text** read their figures from `gold` and the audited
   constants.

## Remaining Known Limitations

- **Browsers and assistive technology:** only Chrome was tested. Not tested:
  Safari, Firefox, real mobile devices, screen readers, or the deployed site.
- **Feedback:** the review form is not connected to a feedback service. It says
  so and offers to copy the review (`docs/planning/review-api.md`).
- **Browser-only data:** tasks, chats and the first-visit flag live only in the
  visitor's browser.
- **Ask AI** is rule-based. Questions outside its patterns get an honest "I
  can't answer that from the data I have".
- **Older routes:** `/overview` and `/pipeline` remain as reachable older
  routes under Analytics and Data & Quality.
- **Data-derived "A1c" strings:** a few strings from the pipeline's data and
  one chart axis label keep "A1c". Changing them means re-running the pipeline
  or notebook, which this phase did not touch.
- **Lint warning:** one expected warning remains (TanStack Table is not
  memoised by the React Compiler).
- **Data & Quality findings:** the accepted warnings (#13) are recorded in
  `docs/planning/redesign-backlog.md`.

## Production Readiness

- **Build:** lint passes with no errors (1 expected warning). Type checking
  passes, and 97 of 97 tests pass.
- **Static export:** builds both locally and with
  `NEXT_PUBLIC_BASE_PATH=/clinical-care-gap-explorer`.
- **Runtime:** no console errors on any tested route.

**Ready for deployment to GitHub Pages**, with one recommended check after it
goes live: open the deployed site once in Safari and on a phone, since only
Chrome was tested here.
