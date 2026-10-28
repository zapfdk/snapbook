# Security review

Review of the Snapbook repository — 28 October 2026 — covering the service
worker, the import paths for untrusted `.snapbook.json` and `.pbc` files, the
dependencies, the GitHub Actions workflow, the Dropbox sign-in path and the git
history, as the reminder in the README asked.

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
| 2 | jsPDF 3.x carries published advisories | Low in practice | Open — needs a major upgrade |
| 3 | No Content-Security-Policy | Low | Open — recommendation below |
| 4 | Workflow actions pinned by major tag, not commit SHA | Low | Open — recommendation below |
| 5 | Dropbox refresh token lives in `localStorage` | Accepted risk | Unchanged, noted below |
| 6 | Dev-only `tinypool` advisories through vitest | None for users | Open — cleared by a vitest upgrade |

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

### 2. jsPDF advisories — open

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

The fix is `jspdf@4`, which `npm audit fix --force` installs as a breaking
change. That was left out of the review because printouts are the app's main
output and the repository has no automated check that a PDF still renders: the
upgrade deserves its own pass that opens a wrist-coach sheet and a route tree
afterwards.

### 3. Content-Security-Policy — recommendation

There is no CSP. GitHub Pages cannot set response headers, so the only option is
a `<meta http-equiv="Content-Security-Policy">` in [index.html](../index.html)
and [public/privacy.html](../public/privacy.html). A working policy needs at
least `default-src 'self'`, `style-src 'self' 'unsafe-inline'` (the app uses
inline style attributes for player colours), `img-src 'self' data:` (the icon
sprite and generated images), `connect-src 'self' https://api.dropboxapi.com
https://content.dropboxapi.com` and `base-uri 'none'`. It has to be verified
against the Dropbox sign-in return and the service worker before shipping, since
a wrong policy breaks both quietly.

Why it matters more than it first seems: with no injection sink in the source
today, a CSP is not closing a known hole — it is the layer that keeps one bug,
or one compromised dependency, from reaching the Dropbox refresh token in
`localStorage`.

### 4. Workflow pinning — recommendation

[.github/workflows/deploy.yml](../.github/workflows/deploy.yml) uses
`actions/checkout@v4`, `actions/setup-node@v4`, `actions/upload-pages-artifact@v3`
and `actions/deploy-pages@v4`. A tag can be moved and a tag can be mistyped;
pinning each action to a commit SHA removes that supply-chain step. The rest of
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

### 6. Development dependencies — noted

`tinypool` advisories (through `vitest`) describe prototype pollution in worker
options that can lead to code execution in the test runner. It is a dev
dependency: it never reaches the built site. It clears with a vitest major
upgrade.

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

## Recommended next steps

1. Upgrade to `jspdf@4` and check a wrist-coach sheet and a route tree by eye.
2. Add and verify a meta CSP, including the Dropbox return and offline reload.
3. Pin the four workflow actions to commit SHAs.
4. Upgrade `vitest` when convenient to clear the dev-only advisories.
