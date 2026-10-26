# Snapbook

A 5v5 flag football playbook studio. Design formations and routes on a 25-yard
field, print wrist-coach cards, and print a numbered route tree poster.

## Run it

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually <http://localhost:5173>). Everything is stored
in the browser with `localStorage`; there is no account or server.

```bash
npm test        # format, archive, library, formation and route tree tests
npm run build   # typecheck and production build
```

## What it does

- **Playbooks** — keep several playbooks side by side and pick the one you are
  editing from the header button, which also duplicates or deletes them. Each
  playbook has its own plays, formations, routes, tags and roster. Browse plays
  in a visual grid with quick previews, search and filter them, and open any
  play in the designer.
- **Team** — set the playbook and squad name, plus each player's name, marker
  label, number and colour once for every formation and play.
- **Route library** — start with 18 coaching presets, then add, edit and
  delete your own. Each route has a full-field preview, group, colour and
  coaching note, and its points are editable on the field.
- **Formation library** — browse every starting alignment, create new ones,
  rename them, and drag players to realign them. Editing a formation also
  re-aligns the plays already built from it while leaving their routes intact.
- **Designer** — drag five players, apply library routes, draw custom
  route points, adjust labels/numbers/colours, tag plays, and save alignments as
  reusable formations. The experimental **Sketch** mode turns a hand-drawn
  stroke into the closest library route, or a freehand route when nothing fits.
- **Wrist coach** — choose the card order, paper insert size, grid, margins and
  ink options, then export a vector PDF at the exact insert dimensions.
- **Route tree** — print a landscape or portrait numbered route tree (1–9 plus
  the 0 wheel) with a colour-coded route index. Field lines, the legend, title
  and monochrome mode are optional; monochrome uses solid, dashed and dotted
  line depths instead of colour.
- **Share** — generate a read-only link that carries the whole playbook in the
  URL, with no upload and no account. Recipients can merge it into their own
  playbook or use it as an editable copy.
- **Cloud sync** — optionally keep every playbook in a Dropbox app folder,
  with automatic uploads, downloads, merging of playbooks that only one side
  changed, and a conflict dialog when the same playbook changed in both places.
- **Backup** — export a readable `.snapbook.json` file, import one back
  (including older backups), or export a password-protected `.pbc` file for
  Playbook Creator.

## Saving and opening

Every change is written to this browser's `localStorage` automatically, so your
whole library of playbooks, the wrist-coach settings and the route-tree options
are restored when you come back. The **Saved locally** badge in the playbook
header confirms this. Nothing leaves the browser unless you connect cloud sync
below.

The playbook button at the left of the header lists everything in the library
and switches which one you are editing. **New playbook** adds an entry instead
of replacing the open one, **Duplicate** copies a playbook with fresh ids, and
deleting asks first — at least one playbook always stays.

## Offline and updates

The first visit caches the built app — shell, scripts, styles, fonts, icons and
the privacy page — with a service worker, so an installed copy opens without a
signal. The playbook was already local, so nothing else is needed to draw up a
play at practice.

Every build gets a cache name derived from a hash of everything it ships, so a
new deployment is always distinct. A new version downloads in the background
and then shows **“A new version of Snapbook is ready”** with a **Reload**
button. Nothing switches until that button is pressed, so an open playbook is
never replaced mid-edit; reloading activates the new build and deletes the
previous cache. Dismissing the notice keeps the current version until the next
launch or deployment.

Because navigations come from the cache, reloading is the only thing that moves
the app to a new version — that is the deliberate trade for instant, offline
starts. Requests are only cached when they are same-origin, so Dropbox API calls
are never stored or intercepted.

`npm run dev` does not register the worker, leaving hot reload untouched.
`npm run build` generates `dist/sw.js` after Vite finishes, so use the npm
script rather than `vite build` alone; a bare Vite build ships without offline
support.

## Cloud sync

**Sync** in the header keeps your playbooks in step through Dropbox. Snapbook
uses an **App folder** app, so it can only see a single file it creates,
`snapbook.json`, under `Apps → <your app name>`, which holds every playbook in
the library. It cannot browse the rest of your Dropbox. There is no server in the middle: the browser signs in with OAuth
PKCE and talks to Dropbox directly.

Google Drive, OneDrive and iCloud are not supported yet.

### Configure the Dropbox app

Cloud sync is disabled until a Dropbox app key is present at build time:

1. In the [Dropbox App Console](https://www.dropbox.com/developers/apps), create
   a **Scoped access** app with **App folder** access.
2. On **Permissions**, enable `account_info.read`, `files.content.read`,
   `files.content.write` and `files.metadata.read`.
3. On **OAuth 2**, add the exact redirect URI shown in the Sync dialog. It is
   the directory the app is served from, including the trailing slash, e.g.
   `https://zapfdk.github.io/snapbook/` or `http://localhost:5173/`.
4. Put the app key in `.env.local` for local development:

   ```bash
   VITE_DROPBOX_APP_KEY=your_app_key
   ```

   For the GitHub Pages build, add `VITE_DROPBOX_APP_KEY` as a repository
   variable under **Settings → Secrets and variables → Actions → Variables**.
   The deploy workflow passes it to `npm run build`.

App name, description, icon files and the rest of the authorization-screen
branding are in [branding/dropbox](branding/dropbox/README.md).

Then open **Sync → Connect Dropbox**. The app key is a public client
identifier; the app has no client secret in the repository or in the browser.

### How syncing behaves

- Edits are uploaded automatically about 1.5 seconds after they settle, and
  Dropbox is checked when the window regains focus.
- Every playbook is compared on its own. One that only this browser changed is
  uploaded, one that only Dropbox changed is downloaded, and one that only
  exists on the other side is added here — so two devices can edit different
  playbooks at the same time without colliding.
- Only a playbook changed in *both* places stops the sync. The conflict dialog
  lists those playbooks with their play counts; choose **Keep this browser’s
  copies** to overwrite Dropbox, or **Use the Dropbox copies** to take the
  other side. Download a backup first if unsure.
- Adding or deleting a playbook travels too: a new entry appears on the other
  device, and a deleted one goes from Dropbox on the next sync.
- Everything inside a playbook syncs: plays, formations, routes, tags, roster
  and team names. Wrist-coach and route-tree settings stay on each device.
- The Dropbox refresh token is kept in this browser’s `localStorage` so the
  connection survives a reload. **Disconnect** removes the tokens from this
  browser; revoke the app from Dropbox if you want to remove the grant too.
- In an installed iOS Home Screen app, Dropbox may open in Safari and the
  return trip may not land back in the standalone app. Open Snapbook in Safari
  to connect or resolve a sign-in there.

## Share links

**Share** in the header builds a link with the complete playbook base64 encoded
in the URL fragment. Opening it shows a read-only copy of the plays, route
library, formations, tags and team roster. Nothing is uploaded. The shared view
never writes to the playbook saved in the recipient’s browser until they choose
**Edit a copy**. They can merge the shared plays, formations, routes and tags
into their current playbook — skipping exact duplicate plays — or replace it
after a confirmation that offers a backup download. **Open my playbook** returns to their own copy without changing
anything. Long playbooks create long links, so send the complete link in one
piece.

## Experimental sketch

In the Designer, choose **Sketch** (the wand button) and draw a route from a
player marker with a mouse or finger. When you release, Snapbook compares the
shape with the routes in this playbook's library and applies the closest match.
If the line is too different, it is kept as a simplified freehand route instead. Recognition
is best-effort: clear the route or refine it with the normal route tools
whenever the snap is not what you meant.

**New playbook** starts a blank playbook with the six starter formations, the
standard route library and standard tags. It joins your library and the
playbook you have open is left untouched; the dialog still offers a backup
download. **Import a playbook** (from the Export menu, the library dialog or
the new-playbook dialog) adds the file as its own library entry the same way,
as does **Edit a copy** on a shared link.

## Team setup

Open **Team** in the header (or the gear beside the playbook name) to manage
shared team details. Each roster role has a player name, marker label, jersey
number and marker color. Editing a role updates every formation and play using
that role while keeping alignments and routes in place. The same page edits the
playbook name and team/squad name.

Marker colors accept the shared palette or any custom color. Label ink switches
between dark and light automatically so custom markers stay readable on the
field, in diagrams and in wrist-coach printouts. Roster settings are ordinary
player data, so they travel in the existing Snapbook backup with no extra file
format.

## Route and formation libraries

Both libraries belong to the open playbook, so they travel in its backup and a
new playbook starts from the standard set.

**Route library** (Playbook → Route library) uses a visual editor. Add a new
route, draw its points on the field, then drag the round handles to reshape it.
Name, group, colour and coaching note are editable. Applying an edited route to
a player copies its current points; plays that already use older points keep
them. Deleting a preset is the same: existing plays are untouched.

**Formations** (Playbook → Formations) can be added from a fresh five-player
lineup or created from the current play with **Save formation** in the
Designer. The formation editor renames the formation and moves its players.
Saving also updates the alignment and labels of every play that starts from
that formation, while each play keeps its own routes, jersey numbers and marker
colours. A formation that is still used by plays cannot be deleted; delete
those plays first, then remove the formation. The last remaining formation is
also kept so every new play has a lineup to start from.

## Snapbook file format

The complete, implementation-independent specification is in
[docs/snapbook-format.md](docs/snapbook-format.md). It defines every field, the
player-key algorithm, defaults, version negotiation and the writer's
normalization rules for applications that want to read or write Snapbook files.

In short, the default backup is readable JSON with `"format": "snapbook"`, a schema
`"version": 3`, and a `"minReaderVersion": 2` compatibility header. It is
designed to be opened in any text editor and imported again after hand edits.
Formations are defined once, plays refer to a formation by name, and each play
stores only its routes plus any per-play player changes. The route library is a
readable list with names, groups, colours, notes and route points. Coordinates
are yards relative to the player's alignment: `x` is to the right, `y` is
downfield.

```json
{
  "format": "snapbook",
  "version": 3,
  "minReaderVersion": 2,
  "playbook": {
    "name": "Friday night",
    "level": "5v5",
    "tags": [{ "name": "Quick game", "color": "#F4C95D" }],
    "routes": [
      {
        "name": "Hitch",
        "group": "Quick game",
        "color": "#F4C95D",
        "note": "A quick five-yard stem, turn and sit in the window.",
        "points": [{ "x": 0, "y": 5 }, { "x": 0.4, "y": 3.6 }]
      }
    ],
    "formations": [
      {
        "name": "Spread Right",
        "players": [
          { "label": "C", "role": "Center", "color": "#F1EEE4", "x": 0, "y": 0 }
        ]
      }
    ],
    "plays": [
      {
        "name": "Mesh Right",
        "code": "MESH",
        "formation": "Spread Right",
        "tags": ["Quick game"],
        "routes": { "C": [{ "x": 0, "y": 5 }] }
      }
    ]
  }
}
```

Route points take optional `curve` values; use a `lineup` entry to move a player
or change their label, number or color for one play. The `routes` library is
optional when reading: older v2 backups without it open with the 18 starter
routes. An empty array is preserved as an intentionally empty library.

The header is version-negotiated. `version` is the writer's schema revision and
`minReaderVersion` is the oldest reader that can safely open the file. Readers
that understand the header accept files whose minimum is at or below their own
version and ignore unknown fields, so additive revisions stay readable. A file
without `minReaderVersion` is treated as requiring its own `version`. A change
that older readers cannot safely ignore, such as a new field size, must raise
`minReaderVersion` so those readers refuse the file instead of silently losing
data. Unknown fields are not preserved when a file is re-exported. Sketch and
freehand routes use the ordinary route-point list, so they need no extra format
fields. Older `snapbook.v1` backups still import unchanged. The format contract
is exercised by committed valid/golden fixtures in
[src/lib/__tests__/fixtures/snapbook](src/lib/__tests__/fixtures/snapbook) plus
contract, compatibility, malformed-input and seeded round-trip suites under
[src/lib/__tests__](src/lib/__tests__).

## Playbook Creator (.pbc) compatibility

The PBC export writes the same encrypted container as PBC 0.22.0:

- `Playbook-Creator\n0.22.0\nplaybook\n` preamble
- PBKDF2/HMAC-SHA-256, 10,000 iterations, 16-byte salt
- AES-256-GCM with a 12-byte IV and a 16-byte authentication tag
- Boost.Serialization text archive version 19, with the same class/object IDs
  and token order as the native serializer

The archive writer is covered by tests that compare its token stream with a
native Boost.Serialization reference. Formation, category and play names must
be unique because PBC stores them as map keys; the exporter reports this before
writing a file.

Reading `.pbc` files back into Snapbook is not implemented. Use the
`.snapbook.json` backup for round-tripping between Snapbook browsers.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, jsPDF and lucide-react.
No backend is required.
