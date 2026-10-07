# Project review: submission interface

"Review this project" (the sidebar entry inside Care Gap Explorer) opens a
centred modal and builds a review record in the browser. The site is a static
export with no server, so **nothing is sent until a feedback endpoint is
configured**. Until then the
modal thanks the reviewer, says the review was not sent, and offers to copy
it. "Your feedback has been received" appears only after the endpoint accepts
the review: the modal never reports a send that did not happen.

Code: `web/lib/review.ts` (record, validation, sending; tested in
`web/lib/review.test.ts`) and `web/components/review/ReviewDialog.tsx` (UI).

## Turning it on

Set the endpoint at build time:

```
NEXT_PUBLIC_REVIEW_ENDPOINT=https://<your-endpoint>/reviews npm run build
```

For GitHub Pages, add it to the build step's `env` in
`.github/workflows/deploy.yml`. The value is public (it ships in the page), so
the endpoint must be safe to call from any browser.

## Request

`POST <NEXT_PUBLIC_REVIEW_ENDPOINT>` with `Content-Type: application/json`:

```json
{
  "version": 2,
  "submittedAt": "2026-10-06T21:14:03.512Z",
  "page": "/patients/[patient]",
  "role": "Recruiter / hiring manager",
  "clarity": 5,
  "usefulness": 4,
  "standout": "Data & Quality",
  "improve": "A short tour for first-time visitors.",
  "email": "reviewer@example.org"
}
```

| Field | Type | Rules |
|---|---|---|
| `version` | `2` | Record shape version. Version 1 (an earlier draft, never sent) had separate free-text answers and name and organization fields. |
| `submittedAt` | string | ISO 8601, UTC, from the reviewer's clock. Record your own receive time too. |
| `page` | string | Application page the modal was opened from. Query string and fragment removed; a patient segment is `[patient]`, any other id-like segment `[id]`. |
| `role` | string | One of: Physician / clinician, Nurse / care team, Healthcare leader, Health informatics / data, Data / software engineer, Recruiter / hiring manager, Student / educator, Other. |
| `clarity` | integer | How clear the purpose was: 1 (not clear) to 5 (very clear). |
| `usefulness` | integer | How useful or relevant: 1 (not useful) to 5 (very useful). |
| `standout` | string | One of: Care-gap workflow, Patient workspace, Analytics, Ask AI, Data & Quality, Learn / educational content, Technical case study. |
| `improve` | string or null | Free text, at most 2,000 characters. `null` when left blank. |
| `email` | string or null | Optional, for a follow-up conversation. At most 200 characters. |

The client already blocks: an unanswered choice or rating, text over 2,000
characters, a malformed email, and free text containing something shaped like
a record identifier (an 8-character hex MRN or a UUID).

**Never collected:** patient identifiers, patient data, IP-derived location,
or anything from the page beyond its sanitised path. No cookies are set.

## Response

- `2xx` (body ignored): the modal shows "Thank you for reviewing Care Gap
  Explorer. Your feedback has been received and will help improve the
  project." with a Done button, and clears the draft.
- Any other status, or a network failure: the modal says it could not be sent,
  keeps every answer, and offers Try again and Copy review.

## What the endpoint must do

1. **Re-validate everything server-side.** The client checks are a courtesy,
   not a control: enforce the field rules above and reject unknown fields.
2. **CORS.** Allow `POST` and `OPTIONS` from the site's origin
   (`https://franklin0603.github.io`) with the `Content-Type` header.
3. **Abuse controls.** Rate-limit per IP, cap the body size (16 KB is ample),
   and consider a CAPTCHA or proof-of-work if spam appears.
4. **Screen for health information** before storing, as a backstop for the
   in-form warning, and discard rather than store anything that looks like it.
5. **Store minimally.** Keep the record and a receive timestamp. Do not store
   IP addresses with the record. The email is optional and given for a
   follow-up conversation only; set a retention period and delete on request.
6. **Notify** the project owner however suits (email, Slack, a sheet).

Any small serverless function fits: a Cloudflare Worker, a Vercel or Netlify
function, or a Google Apps Script web app writing to a sheet.
