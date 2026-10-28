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
- **Route library** — start with 18 coaching presets, then add, duplicate,
  edit and delete your own. Each route has a full-field preview, group, colour
  and coaching note, and its points are editable on the field.
- **Formation library** — browse every starting alignment, create new ones,
  rename them, and drag players to realign them. Editing a formation also
  re-aligns the plays already built from it while leaving their routes intact.
- **Designer** — drag five players, apply library routes, draw custom
  route points, adjust labels/numbers/colours, tag plays, and save alignments as
  reusable formations. A route point you place stays on the field: dragging one
  past an edge stops it at the edge, so it can always be grabbed and reshaped
  again. Flipping a route mirrors it and a library route keeps the library's own
  shape; both are drawn inside the field edges while the play keeps their real
  coordinates, so flipping a route back — or re-applying the preset — returns
  exactly what it was. Drawing a route is click-to-place, and a double-click (or
  Enter) finishes it — the point under the double-click is kept, and clicking
  the point you just placed again ends the path there rather than stacking a
  second one on it; Ctrl+Z steps back, dropping the point you just placed or
  restoring the route from before its last edit, and **R** or **D** draws while
  **M** moves players. A pre-snap **motion** is drawn the same way with the
  Motion tool and shown **dashed**, and the route then starts where that motion
  ends, so the shift and the route read as one movement. **Add option** (or
  **O**) draws an alternative the receiver can break into: pick the route point
  it leaves from, then place its points. A route can carry several options, all
  drawn **dotted**, and each option has its own edit and remove buttons beside
  the selected player: editing reworks its points and the route point it breaks
  from, and removing every point drops it. A route and its options are measured
  from the end of the motion, so moving the shift's last point carries the whole
  route along instead of stretching its first segment. A route line or one of
  its dotted options and its dashed motion are also click targets in Move mode,
  which select that receiver just like the marker does, and every route, option
  and motion point
  can be dragged from there — dragging the motion's last point carries the route
  with it — or removed with **Alt+click** on its handle. Removing a route point
  takes an option branch that left that point with it, and moves the branches
  after it up with their own point. No points left means no route, motion or
  option. The experimental **Sketch** mode turns a
  hand-drawn stroke into the closest library route, or a freehand route when
  nothing fits.
- **Wrist coach** — choose the card order, paper insert size, grid, margins and
  ink options, then export a vector PDF at the exact insert dimensions. Motions and option routes keep their dashed
  and dotted styles on the cards and in every diagram, and routes start from the
  end of a motion there too.
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
  Playbook Creator and open one of those again with its password.

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
as does **Edit a copy** on a shared link. It takes Snapbook JSON and Playbook
Creator `.pbc` files, the latter after its password.

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
Name, group, colour and coaching note are editable. **Duplicate** copies a
route — from its card or from the full-size preview — with a free name like
`Post copy` and opens the copy, so a variant never changes the original.
Applying an edited route to a player copies its current points; plays that
already use older points keep them. Deleting a preset is the same: existing
plays are untouched.

Every segment also carries a **bow** in yards, positive to one side and negative
to the other, which the diagram, the printouts and the route tree all follow.
Bowing a segment is part of this editor: drag the dashed handle in the middle of
a segment and the route curves toward your pointer — up to 5 yards either way,
in 0.1-yard steps. Make it straight again by dragging that handle back onto the
line, double-clicking it, or using **Straighten** for every segment at once.
Points keep their bow when you move them, and the built-in presets such as Post,
Out, Curl and Wheel arrive already bent, so a curve can equally be made by
duplicating one of those. Setting an exact value is still possible by hand
through the `curve` field, which is specified in
[docs/snapbook-format.md](docs/snapbook-format.md).

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
or change their label, number or color for one play. Route points are offsets
from where the route starts, which is the player's alignment or — when that
player has a pre-snap motion — the motion's last point. A motion and the route
measured from it therefore move together as one picture. The `routes` library is
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
fields. A play's pre-snap motions travel in `motions`, keyed like `routes`, and
each route's option branches in `optionRoutes` as a `from` route-point index
plus their own points; both are additive, so an older reader opens the file and
draws plain routes. Older `snapbook.v1` backups still import
unchanged. The format contract
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
writing a file. The reader and writer follow PBC's own model classes rather than
what a file happens to look like: a route is the shared paths plus a name and a
wrist code, a motion is the shared paths plus the position its player ends up at,
and PBC draws a route from the end of a motion when the player has one — the same
origin Snapbook measures from.

The `.pbc` export writes routes with their bows, but it does not write motions
and has no field for option branches, so those stay behind in a `.pbc` file and
its routes begin at the player marker rather than at the end of a motion. The
`.snapbook.json` backup keeps everything.

Reading a `.pbc` file back in is implemented as well. **Import a playbook** takes
the password the file was saved with — or none at all, for a file saved without
one — and adds what comes out as its own playbook, leaving whatever you have
open alone:

- Play, formation and tag names, wrist codes and notes
- Player alignments, colours, numbers and labels
- Routes with their bows, and pre-snap motions — a route then begins where its
  motion ends, the same rule Snapbook draws by
- Each play's tags, and the formation each play was drawn on
- The playbook's own route library, beside Snapbook's presets

A Playbook Creator file stores tags as names only, so an imported tag takes
Snapbook's default colour, and labels are cut to the four characters the file has
room for. Its route library keeps the names the file uses, so two routes called
`Post` can meet: the preset stays and the import arrives as `Post (2)`. A `.pbc`
route carries a wrist code rather than a coaching note, so the code becomes the
note, and a route is grouped as Quick game, Intermediate or Deep by how far
downfield it ends, a field the file does not store. The reader mirrors the writer
token by token, so it also reads what our own export never writes: a route
library, a motion, a bow on a route, a play's own route names, and a formation
shared between plays.

Two things stay behind. A play's route carries its own name and wrist code, which
Snapbook keeps on the library entry instead, so they are left with the play's
other per-player route fields. PBC's option and alternative routes are read to
stay in step and then left out, because Snapbook's options branch off a chosen
point of a route and the file does not record which point. And a file old enough
to store its players without those route slots — class version 3 arrived with
Playbook Creator 0.18 — is reported as coming from another release rather than
guessed at.

A file with no password is recognised either way it was saved: its archive is
read straight out of the container when it sits there in the open, and opened
with the empty password when the file was encrypted with one.

Anything else is reported rather than guessed at. A file from another Playbook
Creator release, a scrambled class table, a token stream that stops early or
runs long, an archive with data left over, and a container header for a file
that is not a playbook all say what they found. AES-256-GCM cannot tell a wrong
password from a damaged file, so that message names both possibilities, and an
empty field that meets a protected file says the file needs a password.

## Reminders

Small things to pick up another time:

- **Wrist coach pages should start in landscape.** The page-size presets and the
  default 100 × 150 mm sheet are all portrait, while the route tree opens in
  landscape. Flipping the dimensions already works — the swap button beside the
  width and height fields trades them — so this is about the starting
  orientation and about offering landscape sizes in the preset list.
- **List the plays that use a formation or a route.** The formation library
  counts plays ("Used by 3 plays") but there is no way to see which ones, and the
  route library says nothing about where a route is used. Both should offer a
  shortcut from the card — the count, or a menu entry — that lists the plays using
  it and opens one. A play names its formation, so that is a lookup; a play keeps
  its own route points, so a route has to be found by the shape it was applied
  from, which the sketch matcher already does.
- **Run a security review of the repository.** The Dropbox sign-in path has
  been looked at — PKCE with no client secret, the OAuth `state` compared
  against a sessionStorage record before the code is exchanged, the callback
  query stripped from the URL afterwards, the access token in sessionStorage
  and the refresh token in localStorage — and the source contains no HTML
  injection sinks. Still to examine: the service worker's cache rules, the
  import paths for untrusted `.snapbook.json` and `.pbc` files, dependencies,
  the GitHub Actions workflow, and whether any secret ever reached git history.

## Stack

React 19, TypeScript, Vite, Tailwind CSS 4, Zustand, jsPDF and lucide-react.
No backend is required.
