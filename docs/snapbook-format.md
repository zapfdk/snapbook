# Snapbook playbook exchange format

| | |
| --- | --- |
| Format identifier | `snapbook` |
| File suffix | `.snapbook.json` |
| Media type | `application/json` |
| Current writer revision | 3 |
| Declared minimum reader | 2 |
| Status | **Draft — not yet frozen** |

This document specifies the JSON exchange format used by Snapbook for complete
playbooks. It is intended to let another application read Snapbook backups and
write files that Snapbook can import.

The key words **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT** and **MAY** are
used as described in RFC 2119.

Revision 3 is the current draft. It is deliberately versioned so the format can
still be corrected before it is declared frozen. Once a revision is frozen, its
meaning is not changed: adding, removing or reinterpreting fields requires a new
revision and the versioning rules below still apply. A frozen revision remains
readable by every later Snapbook reader.

The canonical samples used by the test suite live in
[`src/lib/__tests__/fixtures/snapbook`](../src/lib/__tests__/fixtures/snapbook).
The golden files are exact outputs of the current Snapbook writer; other
applications do not need to reproduce their whitespace or key order.

## Design principles

- **One playbook per file.** Wrist-coach layout, route-tree settings, user
  preferences and similar application state are not part of this format.
- **Readable JSON.** The file is ordinary UTF-8 JSON, intended to survive hand
  inspection and simple scripts.
- **Names are the interchange keys.** Local object ids are never written.
  Formations, tags and player keys are addressed by their human-readable names.
- **Forward-compatible additions.** Readers ignore fields they do not know. A
  writer declares with `minReaderVersion` whether an older reader can safely do
  that.
- **Deterministic exports.** The same playbook and `exportedAt` value produce
  the same file. Numbers are rounded and optional empty values are omitted on
  write.
- **Semantic round-trips.** Importing a file and exporting it again preserves
  every field defined here. Unknown extension fields are intentionally not
  preserved.

## Encoding and JSON rules

- The text MUST be UTF-8 JSON with one top-level object.
- The writer emits two-space indentation, `\n` line endings and one trailing
  newline. These are presentation choices only; readers MUST NOT depend on
  whitespace, line endings or member order.
- A leading UTF-8 byte-order mark and CRLF line endings are accepted on read.
  The writer does not emit a BOM.
- Comments and trailing commas are not valid JSON and MUST be rejected.
- All numbers are JSON numbers. Coordinates and `curve` values MUST be finite.
  The format does not impose field bounds on finite coordinates; an application
  may clamp them for display.
- String values are UTF-8 and may contain any Unicode characters. Strings may
  be empty where this document permits it.
- Unknown object members MUST be ignored by a reader. They are not preserved
  when the file is re-exported.
- The writer never emits local ids, `createdAt`, selection state or other
  application-internal fields.

## Top-level document

```json
{
  "format": "snapbook",
  "version": 3,
  "minReaderVersion": 2,
  "exportedAt": "2026-10-24T00:00:00.000Z",
  "playbook": {}
}
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `format` | string | yes | MUST be exactly `snapbook`. |
| `version` | integer | yes | Schema revision that produced the file. Revision 3 is current. Values below 2 are unsupported by the current reader. |
| `minReaderVersion` | integer | no | Oldest schema revision that can safely read this file. When omitted it defaults to `version`. |
| `exportedAt` | string | no | Informational ISO-8601 timestamp supplied by the writer. Readers MUST NOT use it to decide compatibility. |
| `playbook` | object | yes | The playbook document described below. |

A producer SHOULD always write `minReaderVersion` explicitly. It MUST be a
positive integer and MUST NOT be greater than `version`; a file that violates
either rule is malformed.

## Compatibility and versioning

Readers negotiate using `minReaderVersion`, not by rejecting every file whose
`version` is greater than their own:

1. If `minReaderVersion` is absent, use `version`.
2. Reject the file if `minReaderVersion` is greater than `version`.
3. Reject the file if `minReaderVersion` is greater than the reader's highest
   supported revision.
4. Otherwise accept the file, ignoring unknown fields.

The current reader supports revisions 2 and 3. It therefore accepts a revision
4+ file only when that file declares `minReaderVersion` of 2 or 3.

| File | Result with a revision-3 reader |
| --- | --- |
| `version: 2`, no `minReaderVersion` | Accepted; treated as requiring revision 2. |
| `version: 2`, `minReaderVersion: 2` | Accepted. |
| `version: 3`, no `minReaderVersion` | Accepted; treated as requiring revision 3. |
| `version: 3`, `minReaderVersion: 2` | Accepted. |
| `version: 4`, `minReaderVersion: 2` | Accepted; unknown additions are ignored. |
| `version: 4`, `minReaderVersion: 3` | Accepted. |
| `version: 4`, no `minReaderVersion` | Rejected; it implicitly requires revision 4. |
| `version: 4`, `minReaderVersion: 4` | Rejected; a newer reader is required. |
| `version: 4`, `minReaderVersion: 5` | Rejected; the compatibility header is inconsistent. |

Writer rules:

- Every schema change increments `version`.
- Additive, optional fields that an older reader can ignore leave
  `minReaderVersion` unchanged. Revision 3 added the optional route library and
  therefore still declares minimum reader 2.
- A new required field, a removed or renamed field, or a change in the meaning
  of an existing field MUST raise `minReaderVersion` so older readers refuse the
  file instead of silently losing data.
- A previously published revision MUST NOT be reused with different semantics.
- A file's `version` should describe the writer revision, even when the writer
  emits no data that requires the new revision.

Because unknown fields are not preserved, a round-trip through an older reader
can drop extension data. Applications that need private extension fields should
store them in their own file instead of relying on this format.

## Playbook object

```json
{
  "name": "Friday Night",
  "team": "Hawks",
  "level": "5v5",
  "tags": [],
  "routes": [],
  "formations": [],
  "plays": []
}
```

| Field | Type | Required | Default on read | Meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | — | Playbook name. |
| `team` | string | no | `""` | Team or squad name. |
| `level` | string | no | `"5v5"` | Field size. Allowed values are `5v5` and `7v7`; matching is case-insensitive. The writer emits lowercase. |
| `tags` | array of [tag](#tags) | no | `[]` | Tags used by plays. |
| `routes` | array of [library route](#route-library) | no | starter library | Reusable route presets. See the missing-field rule below. |
| `formations` | array of [formation](#formations) | yes | — | At least one formation. |
| `plays` | array of [play](#plays) | no | `[]` | Play instances. |

`formations` MUST contain at least one entry. A playbook with no usable lineup
cannot be represented.

### Missing route libraries

A missing `routes` member is treated as "use the reader's starter route
library". This rule exists so revision-2 files, which had no route library, gain
the current starter presets. An explicitly empty array means the author
intentionally removed every route; it MUST be preserved as empty and MUST NOT
be replaced by starters.

A writer SHOULD always emit `routes`, even when empty. The only reason to omit
it is to request starter-library fallback.

## Tags

```json
{ "name": "Quick game", "color": "#F4C95D" }
```

| Field | Type | Required | Default on read | Meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | — | Tag name used by plays. |
| `color` | string | no | `"#F4C95D"` | Opaque color string. Snapbook uses `#RRGGBB`; readers should preserve the value unchanged. |

Tag names MUST be unique within a playbook, compared case-insensitively.
Duplicate tag names make a file invalid. Empty names are not useful and
producers SHOULD avoid them.

Play `tags` are matched to these names case-insensitively.

## Formations

A formation defines the reusable lineup from which plays are created.

```json
{
  "name": "Spread Right",
  "players": [
    {
      "label": "C",
      "role": "Center",
      "number": null,
      "color": "#F1EEE4",
      "x": 0,
      "y": 0
    }
  ]
}
```

| Field | Type | Required | Meaning |
| --- | --- | --- | --- |
| `name` | string | yes | Formation name and the value plays use in their `formation` field. Names MUST be unique, compared case-insensitively. |
| `players` | array of [formation player](#formation-players) | yes | At least one player. |

Play references to a formation are exact, case-sensitive matches against the
formation name. Producers SHOULD use trimmed names without leading or trailing
whitespace. The Snapbook writer trims formation names and makes clashes unique
as described under [writer normalization](#writer-normalization).

### Formation players

| Field | Type | Required | Default on read | Meaning |
| --- | --- | --- | --- | --- |
| `label` | string | no | `""` | Short marker label shown on diagrams, for example `C`, `QB` or `WR-L`. |
| `role` | string | no | `label` | Full position name, for example `Wide Receiver Left`. |
| `number` | number or `null` | no | `null` | Jersey number. Snapbook's editor treats it as optional. |
| `color` | string | no | `"#F1EEE4"` | Opaque marker color string. Snapbook uses `#RRGGBB`. |
| `x` | number | yes | — | Player alignment in yards. Positive is to the right of the ball. |
| `y` | number | yes | — | Player alignment in yards. Positive is downfield from the line of scrimmage; negative is behind it. |

Positions are field coordinates. The origin is the center of the line of
scrimmage on the ball. The sample field is 25 yards wide, but the format itself
does not require a particular field size.

The writer always emits `label`, `role`, `color`, `x` and `y`. It omits
`number` when it is `null`. Readers MUST treat an absent `number` as `null`.

## Points and route points

```json
{ "x": 0, "y": 5, "curve": 0.5 }
```

| Field | Type | Required | Default on read | Meaning |
| --- | --- | --- | --- | --- |
| `x` | number | yes | — | Horizontal offset in yards from the player's alignment. Positive is right. |
| `y` | number | yes | — | Downfield offset in yards from the player's alignment. Positive is downfield. |
| `curve` | number | no | `0` | Bow of the segment leading into this point, in yards. |

Coordinates inside `routes` are offsets from the player's alignment, not
absolute field coordinates. For a play route, add the route point to the
formation or lineup position of that player. The axes remain field-aligned:
positive `x` is to the right and positive `y` is downfield.

`curve` applies to the segment that ends at this point. The first point's
segment starts at the player's alignment. A missing or zero `curve` is a straight
line. For a non-zero curve, the segment is a quadratic Bézier curve with:

- start point `P0` (the player or the previous route point),
- end point `P2` (this point),
- control point
  `C = midpoint(P0, P2) + curve × normalize(-(P2.y - P0.y), P2.x - P0.x)`.

A positive value bows the segment in the direction of that normal. Readers may
render a different decorative style for a one-point route, but the endpoint is
the specified point.

## Route library

A library route is a reusable route shape, not a route attached to a player.

```json
{
  "name": "Hitch",
  "group": "Quick game",
  "color": "#F4C95D",
  "note": "A quick five-yard stem, turn and sit in the window.",
  "points": [
    { "x": 0, "y": 5 },
    { "x": 0.4, "y": 3.6 }
  ]
}
```

| Field | Type | Required | Default on read | Meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | — | Route name. Names MUST be unique within the library, compared case-insensitively. |
| `group` | string | no | `"Intermediate"` | One of `Quick game`, `Intermediate`, `Deep`. An unknown value falls back to `Intermediate`. |
| `color` | string | no | group color | Opaque color string. Missing values fall back to `#F4C95D` (quick), `#82B7FF` (intermediate) or `#FF7A59` (deep). |
| `note` | string | no | `""` | Coaching note. |
| `points` | array of [points](#points-and-route-points) | yes | — | MUST contain at least one point. |

Library route points are still relative to a receiver's alignment. They do not
store which side of the formation will use them; an application may mirror a
preset when applying it. The format stores exactly the coordinate list shown.

The writer omits `note` when it is empty or whitespace-only. It always writes a
valid `group` and `color`.

## Plays

A play is a formation-based instance with per-player routes and optional
per-play lineup changes.

```json
{
  "name": "Mesh Right",
  "code": "MESH",
  "formation": "Spread Right",
  "tags": ["Quick game"],
  "notes": "Clear the middle with the corner.",
  "updatedAt": "2026-10-23T12:00:00.000Z",
  "routes": {
    "WR-L": [
      { "x": 0, "y": 3 },
      { "x": 12, "y": 4.2, "curve": 1 }
    ]
  },
  "lineup": {
    "WR-L": {
      "label": "X",
      "number": 88,
      "color": "#F08EC0",
      "x": -10.25,
      "y": 0.75
    }
  }
}
```

| Field | Type | Required | Default on read | Meaning |
| --- | --- | --- | --- | --- |
| `name` | string | yes | — | Play name. |
| `code` | string | no | `""` | Short play code or signal. |
| `formation` | string | yes | — | Exact name of an entry in `playbook.formations`. |
| `tags` | array of strings | no | `[]` | Tag names. Matching is case-insensitive. Unknown tags make the file invalid. |
| `notes` | string | no | `""` | Coaching notes. |
| `updatedAt` | string | no | import time | Informational ISO-8601 timestamp. A reader may normalize it or replace an invalid value. |
| `routes` | object | no | `{}` | Map of player key to route point array. |
| `lineup` | object | no | `{}` | Map of player key to a partial player override. |

There is no `createdAt` in the format. Snapbook sets the imported play's
`createdAt` to its `updatedAt` for its local bookkeeping.

Play names are not used as keys, so duplicate play names are technically
readable, but producers SHOULD make them unique.

### Player keys

`routes` and `lineup` use a computed **player key** rather than a player id.
Both sides MUST derive the key from the formation lineup in order. The algorithm
is:

```text
used = empty set
for each player in formation.players, in order:
    base = trim(player.label)
    if base is empty: base = trim(player.role)
    if base is still empty: base = "Player"

    key = base
    suffix = 2
    while lower(key) is in lower(used):
        key = base + " #" + suffix
        suffix = suffix + 1

    add lower(key) to used
    emit key
```

Examples for labels `["WR", "WR", "WR #2"]` in that order:

| Player | Key |
| --- | --- |
| first `WR` | `WR` |
| second `WR` | `WR #2` |
| label already named `WR #2` | `WR #2 #2` |

References in `routes` and `lineup` MUST match these keys exactly
(case-sensitively). A key that is not in the computed lineup makes the file
invalid.

### Route entries

Each member of `routes` maps a player key to an array of
[route points](#points-and-route-points):

```json
"routes": {
  "C": [{ "x": 0, "y": 3 }],
  "WR-L": [
    { "x": 0, "y": 3 },
    { "x": 12, "y": 4.2, "curve": 1 }
  ]
}
```

- A player without a route SHOULD be omitted.
- An empty point array is readable and means "no route"; Snapbook ignores it.
- A route is always relative to that player's alignment, including any lineup
  override for the play.
- A player may have a one-point route. It is drawn from the player to that
  point.

### Lineup patches

`lineup` changes a player's base formation values for one play only. The value
is a partial player object; every member is optional:

| Field | Type | Meaning |
| --- | --- | --- |
| `label` | string | Override the marker label. |
| `role` | string | Override the full position name. |
| `number` | number or `null` | Override the jersey number. `null` clears it. |
| `color` | string | Override the marker color. |
| `x` | number | Move the player horizontally for this play. |
| `y` | number | Move the player downfield for this play. |

A patch MUST NOT contain an unknown player key. Unknown fields inside a patch
are ignored. Missing fields inherit from the formation. A `null` `number` is
meaningful and distinct from an absent `number`: `null` explicitly clears the
formation's jersey number for this play.

The play does not contain a full player list. A reader reconstructs each player
as `formation player + lineup patch`, then attaches routes by key. A writer
should refuse to export a play whose player count does not match its formation.

## Writer normalization

Snapbook applies these rules when exporting. Other writers should follow them
where they matter for interoperability.

1. **Names used as keys are trimmed and made unique.** Tag, formation and
   library-route names are trimmed. Empty names become `Tag 1`, `Formation 1`
   or `Route 1` using the one-based array position. Duplicate names, compared
   case-insensitively, get ` (2)`, ` (3)` and so on appended to the trimmed
   name. Play names and player labels are preserved as supplied.
2. **Player keys use the algorithm above.** Collisions between a generated
   suffix and an actual label are still resolved, so keys remain unique.
3. **Numbers are rounded to two decimal places.** Player positions, route
   points and curve values are rounded independently. Negative zero is written
   as `0`.
4. **Empty optional values are omitted.** Formation `number: null` is omitted;
   route `note` is omitted when blank; play `code`, `tags`, `notes`,
   `updatedAt`, `routes` and `lineup` are omitted when empty. A play still
   writes `name` and `formation`.
5. **No local state is exported.** Object ids, creation timestamps, selection,
   UI settings and unknown extension fields do not appear in the output.
6. **Output is deterministic.** For the same playbook and `exportedAt`, the
   writer produces byte-identical JSON. Ordering follows playbook arrays:
   formations, tags, library routes and plays are written in their stored order.

Readers MUST NOT reject a file merely because it uses different whitespace,
key order, optional omitted fields or a different color spelling, as long as
the semantics above hold.

## Minimal example

This is a complete valid revision-3 file with one formation and no plays. It
explicitly keeps an empty route library.

```json
{
  "format": "snapbook",
  "version": 3,
  "minReaderVersion": 2,
  "exportedAt": "2026-10-24T00:00:00.000Z",
  "playbook": {
    "name": "Minimal Book",
    "team": "",
    "level": "5v5",
    "tags": [],
    "routes": [],
    "formations": [
      {
        "name": "Solo",
        "players": [
          {
            "label": "C",
            "role": "Center",
            "color": "#F1EEE4",
            "x": 0,
            "y": 0
          }
        ]
      }
    ],
    "plays": []
  }
}
```

More complete examples, including lineup patches, curved routes and additive
future fields, are in the fixture directory linked at the top of this document.

## Reading checklist for another application

A conforming reader should:

1. Parse UTF-8 JSON, tolerating a BOM and CRLF line endings.
2. Require `format: "snapbook"` and validate the compatibility header.
3. Ignore unknown fields and unknown object members.
4. Reject duplicate tag, formation or route names and duplicate player keys.
5. Resolve formation names exactly; resolve tag names case-insensitively.
6. Compute player keys from the formation, in order.
7. Reconstruct each play from its formation, apply `lineup` patches, then attach
   `routes`.
8. Preserve the semantically meaningful values on re-export, even if the source
   used a different color spelling or optional-field omission.
9. Use the [route point](#points-and-route-points) coordinate system and curve
   formula when rendering.
10. Provide a clear error for unsupported `minReaderVersion`, malformed player
    keys, missing formations and unknown tags.

A conforming writer should:

1. Emit `format`, `version`, `minReaderVersion`, `playbook.name` and at least one
   formation.
2. Use trimmed, case-insensitively unique tag, formation and route names.
3. Compute player keys with the documented algorithm.
4. Store player positions as formation coordinates and routes as offsets.
5. Emit no local ids or unknown extension fields.
6. Bump `version` for any schema change and `minReaderVersion` whenever an older
   reader could misinterpret or lose required data.
7. Test its output against the fixtures and round-trip the format
   semantically.

## Validation and error messages

The current Snapbook reader is strict about structure and references, but
lenient about optional values and field colors. Error strings shown by the app
are for humans and are not part of the format contract; another implementation
may phrase equivalent errors differently.

The following are malformed for revision 3:

- A top-level value that is not an object, or an empty object.
- Missing/invalid `format`, `version`, `minReaderVersion` or `playbook`.
- A `minReaderVersion` newer than the reader or newer than the file's `version`.
- A playbook with no formations, or a formation with no players.
- Duplicate tag, formation or route names (case-insensitive).
- Unknown formation references, unknown tag references, unknown player keys in
  routes/lineup, or malformed route points.
- Non-finite numbers, non-string names, or a non-array where an array is
  required.

Unknown optional fields are not malformed; they are ignored. Applications should
not rely on a particular error message when exchanging files.

## Legacy files

Revision 1 used a wrapper with `"format": "snapbook.v1"` and an embedded legacy
playbook object. Some early bare playbook objects had no wrapper at all. The
current Snapbook app still accepts both as a compatibility courtesy, but
revision 3 producers MUST NOT write them. They are outside the compatibility
header and receive no `minReaderVersion` guarantees.

Playbook Creator `.pbc` files, PDF exports and browser `localStorage` state are
different formats and are not covered by this specification.
