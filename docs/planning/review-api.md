# Project review: submission interface

"Review this project" (the sidebar entry inside Care Gap Explorer) builds a
review record in the browser. The site is a static export with no server, so
**nothing is sent until a feedback endpoint is configured**. Until then the
drawer tells the reviewer their review was not sent and offers to copy it. It
never reports a send that did not happen.

Code: `web/lib/review.ts` (record, validation, sending; tested in
`web/lib/review.test.ts`) and `web/components/review/ReviewDrawer.tsx` (UI).

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
  "version": 1,
  "submittedAt": "2026-10-06T21:14:03.512Z",
  "page": "/patients/[patient]",
  "role": "Data / Analytics",
  "clarity": 4,
  "responses": {
    "mostUseful": "The never-tested list and the evidence panel.",
    "improve": "Show more history per patient.",
    "healthcareUse": null
  },
  "contact": {
    "name": null,
    "organization": null,
    "email": "reviewer@example.org"
  }
}
```

| Field | Type | Rules |
|---|---|---|
| `version` | `1` | Record shape version. Accept old versions side by side when it changes. |
| `submittedAt` | string | ISO 8601, UTC, from the reviewer's clock. Record your own receive time too. |
| `page` | string | Application page the drawer was opened from. Query string and fragment removed; a patient segment is `[patient]`, any other id-like segment `[id]`. |
| `role` | string | One of: Physician, Nurse, Healthcare Operations, Health Informatics, Data / Analytics, Engineering, Student / Educator, Other. |
| `clarity` | integer | 1 (not clear) to 5 (very clear). |
| `responses.*` | string or null | Free text, at most 2,000 characters each. `null` when left blank. |
| `contact.*` | string or null | Optional. `null` when left blank. Name and organization at most 200 characters. |

The client already blocks: a missing role or rating, text over 2,000
characters, a malformed email, and free text containing something shaped like
a record identifier (an 8-character hex MRN or a UUID).

**Never collected:** patient identifiers, patient data, IP-derived location,
or anything from the page beyond its sanitised path. No cookies are set.

## Response

- `2xx` (body ignored): the drawer shows "Thank you. Your review was sent." and
  clears the draft.
- Any other status, or a network failure: the drawer says it could not be sent,
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
   IP addresses with the record. Contact details are optional and given for
   follow-up only; set a retention period and delete on request.
6. **Notify** the project owner however suits (email, Slack, a sheet).

Any small serverless function fits: a Cloudflare Worker, a Vercel or Netlify
function, or a Google Apps Script web app writing to a sheet.
