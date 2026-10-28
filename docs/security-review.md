# Security review

Review of the Snapbook repository — 28 October 2026 — covering the service
worker, the import paths for untrusted `.snapbook.json` and `.pbc` files, the
dependencies, the GitHub Actions workflow, the Dropbox sign-in path and the git
history, as the reminder in the README asked.

A second pass the same day closed the four open recommendations: jsPDF 4, a meta
CSP, workflow pins and vitest 5. That pass is written up in
[Follow-up pass](#follow-up-pass) at the end, and the findings below are marked
with what actually shipped.

## What the app is

Snapbook is a static site. There is no backend, no account and no telemetry: the
build produces HTML, JavaScript, CSS, icons and a service worker, and GitHub
Pages serves them. Playbook data lives in `localStorage` in the browser.
The only network traffic the app itself makes is to Dropbox, and only after the
user connects cloud sync.

That shapes the threat model. The valuable things are the coach's playbook data
and, if cloud sync is connected, the Dropbox refresh token. The untrusted input
is anything that arrives from outside: a share link, an imported file, a
Dropbox file written by another device, or a response from Dropbox.

## How it was checked

Read the service worker template and its build step, both importers end to end,
the Dropbox client and the cloud-sync state machine, the workflow, and the
`.gitignore`. Searched the source for HTML injection sinks (`innerHTML`,
`dangerouslySetInnerHTML`, `document.write`, `eval`, `new Function`),
`Object.assign` on untrusted data, external links and third-party asset loads.
Ran `npm audit` for the runtime and dev dependency trees, and scanned every
commit in the history for key-like strings and for files that should never be
committed. Ran the test suite, which includes the malformed-file cases below.

## Findings

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Imported files were read into memory with no size limit | Low | Fixed — a 10 MB cap rejects the file before it is read |
| 2 | jsPDF 3.x carries published advisories | Low in practice | Fixed — upgraded to 4.2.1, with a PDF test to catch a break |
| 3 | No Content-Security-Policy | Low | Fixed — build-injected meta policy, verified in the built app |
| 4 | Workflow actions pinned by major tag, not commit SHA | Low | Fixed — all four pinned to commit SHAs |
| 5 | Dropbox refresh token lives in `localStorage` | Accepted risk | Unchanged, noted below |
| 6 | Dev-only `tinypool` advisories through vitest | None for users | Fixed — vitest 5 no longer depends on tinypool |

Nothing was found that lets a file, a share link or a Dropbox response run code,
reach the network or overwrite another playbook.

### 1. Import size — fixed

`importNative` called `File.text()` and the `.pbc` path `File.arrayBuffer()`
before looking at the file at all, so a mistyped or hostile multi-gigabyte file
would be read into the tab before failing. `assertImportSize` in
[src/lib/files.ts](../src/lib/files.ts) now rejects anything over
`MAX_IMPORT_BYTES` (10 MB) with a readable message, from a plain JSON import and
from the `.pbc` path. A real playbook is a few hundred kilobytes, so the cap is
generous. Covered by a test in
[src/lib/__tests__/snapbookFile.test.ts](../src/lib/__tests__/snapbookFile.test.ts).

### 2. jsPDF advisories — fixed

`npm audit` reports seven advisories against `jspdf@3.x`, aggregated as one
critical vulnerability. They concern areas Snapbook does not use: the `addJS`
plugin, AcroForm radio buttons and text fields, `html()` rendering, GIF
dimensions, and XMP metadata handling.

What the app does call is `setProperties`, `text`, `line`, `rect`, `triangle`
and `save`, with strings from the coach's own playbook — including a playbook
name that a share link or an imported file could supply. The XMP metadata
advisory is therefore the one that could apply: a crafted playbook name could
end up in the exported PDF's metadata. The effect is limited to the file the
coach exports and opens themselves.

The fix is `jspdf@4`. The upgrade was held back because printouts are the app's
main output and nothing in the repository checked that a PDF still renders, so
the pass that took it did two things: it added
[src/lib/pdf/__tests__/pdf.test.ts](../src/lib/pdf/__tests__/pdf.test.ts), which
asserts both exports produce a valid header and trailer, one page object per
sheet, and no markup from a hostile playbook name in the file; and it rendered a
wrist-coach sheet and a route tree with 4.2.1 and looked at them. Nothing in the
app's API surface changed — `setProperties`, `text`, `line`, `rect`, `triangle`,
`output` and `save` all behave as before — and `npm audit --omit=dev` is now
clean.

### 3. Content-Security-Policy — fixed

GitHub Pages cannot set response headers, so the policy lives in the document.
It is not written into [index.html](../index.html) because `vite dev` needs an
inline preamble script and a WebSocket for HMR, both of which the policy
forbids; a small plugin in [vite.config.ts](../vite.config.ts) injects the meta
tag into the built page instead. Development runs without a policy, the deployed
build enforces one:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
img-src 'self' data: blob:; font-src 'self';
connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com;
worker-src 'self'; manifest-src 'self'; object-src 'none';
base-uri 'none'; form-action 'none'
```

`style-src` needs `'unsafe-inline'` because React writes player colours into
style attributes, which the CSP treats as inline styles. `img-src` needs `data:`
and `blob:` for the icon sprite and generated images. [public/privacy.html](../public/privacy.html)
is a static file with no scripts, so it carries its own much tighter policy:
`default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:`.

One build setting exists for the policy: `assetsInlineLimit` keeps `.woff2`
files out of the CSS as `data:` URIs. Vite would otherwise inline the 1.6 kB
JetBrains Mono subset, and `font-src 'self'` would then refuse it at runtime —
which is how the first attempt at this policy failed in the browser.

Verified against the built site, not the dev server: the app loads with no
policy violations, every font arrives as a file, an off-origin `fetch` and an
off-origin image are refused with the expected directive named, a `POST` to
`api.dropboxapi.com` is allowed through (it answers 400 rather than being
blocked), the OAuth return URL still opens the shell under the service worker,
a PDF exports, and the privacy page renders with its styles intact.

Why it matters more than it first seems: with no injection sink in the source
today, a CSP is not closing a known hole — it is the layer that keeps one bug,
or one compromised dependency, from reaching the Dropbox refresh token in
`localStorage`.

### 4. Workflow pinning — fixed

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) used
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`
and `actions/deploy-pages@v4`. A tag can be moved and a tag can be mistyped, so
each action is now pinned to a commit SHA read from the action's own repository,
with the version in a trailing comment: checkout and setup-node `v4.4.0`,
upload-pages-artifact `v3.0.1` and deploy-pages `v4.0.5`. The rest of
the workflow is in good shape: `permissions` grants only `contents: read`,
`pages: write` and `id-token: write`; `npm ci` installs from the lockfile; and
the Dropbox app key comes from `vars`, a public repository variable, not from a
secret. No secret is available to the build at all, which is the right answer
because the Dropbox client is a public OAuth client with PKCE and no secret.

### 5. Token storage — accepted

The Dropbox access token is kept in `sessionStorage` and the refresh token in
`localStorage`, both scoped to the site's origin and to the app's own key. A
refresh token is long-lived, so any script running on the origin could read it.
The alternative — keeping sync connected across reloads without asking for
sign-in again — is what the feature is for, and the token is limited to the
`app_folder` scope it was granted. The mitigation that matters is finding 3.
Tokens never appear in URLs, logs or the exported files.

### 6. Development dependencies — fixed

`tinypool` advisories described prototype pollution in worker options that could
lead to code execution in the test runner. It was a dev dependency, never part
of the built site, and it cleared with the move to `vitest@5`, which no longer
depends on `tinypool` at all. All 301 existing tests pass on the new runner, and
`npm audit` is clean for the whole tree.

## What checked out

### Service worker

[scripts/service-worker.js](../scripts/service-worker.js) intercepts same-origin
`GET` requests only and returns early for anything cross-origin, so Dropbox
traffic is never cached or rewritten. Navigations are served from the versioned
cache with `ignoreSearch`, which is what keeps the OAuth `?code=…&state=…`
return working without caching a query-specific document. Precaching bypasses
the HTTP cache (`cache: 'reload'`) so a fresh deployment cannot be precached
from a stale `index.html`; the cache name carries a hash of the build output;
and old caches are deleted on activate. A new worker waits (`skipWaiting` only
on the page's request), so a reload cannot swap the app out mid-session. The
cache holds only files from the build's own precache list plus same-origin
assets fetched at runtime, which are static by construction.

### Import validation

Both readers validate rather than guess. `parseSnapbook` rejects bad JSON,
unsupported formats and unknown versions, and checks every field's type, unique
names, formation/player/route counts, route points and tag references, with a
message naming the offending entry. The `.pbc` reader bounds every collection
count, caps string lengths, refuses data that runs past the end of the file, and
rejects unknown Boost class ids instead of interpreting them. Neither path uses
`eval` or writes HTML; imported text reaches the page only through React, which
escapes it. Share links are a stricter layer on top: base64url only, fatal
UTF-8 decoding, then the same validation, and the payload lives in the URL
fragment, which browsers never send to a server.

### Git history

Every commit was scanned for key-like assignments and for files that should not
be tracked. The only match is a test fixture token (`'access-token'`) and
`.env.example`, which is a template with an empty value. `.env`, `.env.*`,
`dist/`, `node_modules/` and local `.pbc` files are ignored, and no `.pbc` file
or key material has ever been committed.

### Third-party code at runtime

No external scripts, fonts or stylesheets: the fonts are in the repository and
everything else is bundled at build time. The two external links
(the Dropbox App Console and the GitHub issue tracker) are ordinary links, and
the App Console one carries `rel="noreferrer"`.

## Follow-up pass

The same day, the four open recommendations were closed rather than carried:

| Finding | Change | Verified by |
| --- | --- | --- |
| 2 | `jspdf@4.2.1` | a new PDF structure test, plus a rendered wrist-coach sheet and route tree |
| 3 | meta CSP injected at build, own policy on the privacy page | the built site loaded in a browser, with positive and negative checks above |
| 4 | four actions pinned to commit SHAs | the SHAs read from `git ls-remote` of each action repository |
| 6 | `vitest@5.0.5` | the existing suite, 301 tests |

What is deliberately still open: finding 5, the refresh token in
`localStorage`, which is an accepted trade for sync surviving a reload. The CSP
is now the control that limits what a script on the origin could reach.

Two things to keep in mind for later changes. The policy in
[vite.config.ts](../vite.config.ts) has to grow with any new origin the app
talks to — a second sync provider, an AI endpoint, analytics — otherwise it
fails closed and the feature looks broken. And the PDF test is structural, not
visual: it catches a library upgrade that stops producing pages, not one that
moves a line, so a printout still deserves a look after touching the exporters.
