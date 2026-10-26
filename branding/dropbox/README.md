# Dropbox app branding

Assets and copy for the **Branding** tab of the Snapbook app in the
[Dropbox App Console](https://www.dropbox.com/developers/apps). Dropbox shows
this information on the authorization screen when someone connects the app, and
reuses it during production review.

Dropbox does not publish pixel or file-size limits for the icon uploads, so the
exports below are square PNGs at the common sizes; the App Console will reject
anything it considers too large or the wrong shape. All of them come from
`icon.svg`, which is the same mark the site uses as its header logo and PWA
icon — which is what Dropbox's [branding guide](https://docs.dropboxapi.com/dropbox-api/docs/developer-resources/branding-guide)
asks for.

## Icon files

| File | Use |
| --- | --- |
| `icon-1024.png` | Large icon; also the size the production application asks for |
| `icon-512.png` | Spare middle size |
| `icon-256.png` | Small icon |
| `icon-rounded-1024.png` | Only if the console shows square corners and you want them softened |
| `icon.svg` | Master artwork for the square icon — edit this, then re-export |
| `icon-rounded.svg` | Master artwork for the rounded variant |

The square exports are full-bleed with opaque corners. The rounded variant has
**transparent** corners, so use it only where the listing does not mask the
artwork itself; under a tighter mask the transparent corners would show as gaps.

## Listing copy

Paste these into the App Console.

| Field | Value |
| --- | --- |
| App name | `Snapbook` |
| Publisher | `Snapbook` (or your own name, if you prefer to be named personally) |
| Description | `Design 5v5 flag football plays and formations, then export wrist-coach cards and a numbered route tree.` |
| App website | `https://zapfdk.github.io/snapbook/` |
| App folder name (Settings tab, not Branding) | `Snapbook` |
| Small icon | `icon-256.png` |
| Large icon | `icon-1024.png` |

A longer description, if the field takes it:

> Snapbook is a 5v5 flag football playbook studio. Draw plays and formations on
> a 25-yard field, keep routes, roster and tags in one library, then print
> wrist-coach cards and a numbered route tree poster. The playbook can be shared
> as a link or kept in step across devices through Dropbox.

The **app folder name** decides where the playbook lives in Dropbox:
`Apps/<folder name>/snapbook.json`. Set it before you connect a device. If you
rename it later, the app starts writing to the new folder and the old file is no
longer found, so you would need to reconnect or re-upload.

The **app name** appears on the consent screen, so it follows Dropbox's naming
rules: no "Dropbox" or other Dropbox product names, nothing starting with
"drop", and no Dropbox imagery or anything implying an official connection.
"Snapbook" is clear on all counts.

Branding is used in development status too — it is not a production-only field.
Owner-only use can stay in development status indefinitely; Dropbox only pushes
towards production review as the linked-user count grows (500 linked users for a
development app, with a two-week production window once 50 are linked).

## Privacy policy

Dropbox's Developer Terms require a privacy policy that describes what the app
does with user data, even though the Branding tab has no documented URL field
for it. Snapbook publishes one at

<https://zapfdk.github.io/snapbook/privacy.html>

which is `public/privacy.html` in this repository. It covers local storage, the
four Dropbox permissions, the single `snapbook.json` file and share links, and
it points questions at the GitHub issue tracker rather than an email address.
Keep it in step with the code — it is the version users and Dropbox see — and
paste the URL wherever the production application asks for a privacy policy.

## Regenerate the PNGs

`rsvg-convert` comes from librsvg; ImageMagick or Inkscape work too.

```bash
cd branding/dropbox
rsvg-convert -w 1024 -h 1024 icon.svg         -o icon-1024.png
rsvg-convert -w 512  -h 512  icon.svg         -o icon-512.png
rsvg-convert -w 256  -h 256  icon.svg         -o icon-256.png
rsvg-convert -w 1024 -h 1024 icon-rounded.svg -o icon-rounded-1024.png
```

These files live outside `public/`, so they are not part of the web build and
are never served by the site.
