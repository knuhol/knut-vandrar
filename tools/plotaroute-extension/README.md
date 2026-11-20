# Plotaroute collection downloader

Runs in your existing Brave, Chrome, or Edge browser session. It uses the site's
normal controls and defaults to **GPX → Track → POIs**, with trailing arrows removed
from file/track names. The extension UI is English-only. No cookies are copied,
and the extension has no database connection. Site access checks remain manual.

## Install or update

In the browser where Plotaroute works:

1. Open `brave://extensions` (Chrome: `chrome://extensions`, Edge: `edge://extensions`).
2. Enable Developer mode and choose Load unpacked. Select
   the `tools/plotaroute-extension` directory in your repository checkout.
3. If already installed, use **Reload** on this extension instead.

The permissions are unchanged: `activeTab` and `scripting` operate on the tab you
invoke it from, `downloads` verifies files saved by the browser, and `storage`
remembers progress. There are no blanket host permissions or automatic page scripts.

## Download settings

Choose settings in the extension popup before starting a route or collection:

- **Format:** GPX (default), KML, TCX, or FIT.
- **GPX type:** Track (default) or Route.
- **GPX waypoints:** POIs (default), None, or Directions.

GPX type and waypoint controls apply only to GPX; other formats use the site's
format-specific defaults. Preferences are remembered locally. A collection keeps
its initial settings when paused or resumed, even if you change preferences later.
Old saved collection jobs retain the original GPX → Track → POIs defaults.

For the local importer, use **GPX → Track**. Other formats and GPX Route downloads
are available for use in other applications and devices. The importer validates
GPX tracks and rejects incompatible files.

## Download a collection

1. Open <https://www.plotaroute.com/routecollection/20512> in your normal browser.
2. For unattended downloading, turn off **Ask where to save each file** in browser
   download settings. You can also leave it on and confirm each Save dialog.
3. Open the extension, enter collection ID `20512` (or its full URL), and choose
   **Start collection**. Keep that tab open; it will navigate between the collection
   and individual routes. It does not wait for advertisements to finish loading.
4. The extension saves each route only after the browser reports a completed download.
   After the last route it downloads `plotaroute-20512.json` with the collection's
   membership, route IDs, original metadata/descriptions, and exact downloaded filenames.

If the browser asks whether to allow multiple downloads from Plotaroute, allow them
for this operation. The extension does not change that browser setting itself.

Closing the popup does not stop the job. Reopen it for progress. **Pause** finishes
the current download and stops before the next route. **Resume collection** picks
up the saved job, including after a browser restart, and checks that previously
completed files still exist. Files completed immediately before an interruption are
reconciled to avoid downloading them again. Active partial downloads must be
finished or cancelled before resuming. Resume from a Plotaroute tab so the extension
has temporary access to that origin.

Changes to source collection membership/order stop the job rather than mixing
versions. **Export metadata** can save a partial job. Export the saved job before
starting another unfinished collection; this preserves its metadata independently
of extension storage. Successful downloads remain on disk throughout.

Progress is stored locally in extension storage. Each browser installation has one
saved collection job. Starting a new job after export/completion replaces that
saved progress, without deleting downloaded routes or JSON files. Removing the extension
removes its saved progress. Do not rename or move files until import; the JSON
references their exact filenames, including browser-generated suffixes such as `(1)`.

Route order in the export follows the Plotaroute collection, including after
resuming interrupted or repaired downloads. Change the itinerary on Plotaroute
before starting a new export.

## Import and review locally

Keep the JSON export and GPX track files in the same directory. Run
`./scripts/tracks-import.sh` for one-at-a-time prompts, or supply flags:

```sh
./scripts/tracks-import.sh local \
  --trail Bergslagsleden \
  --bundle "$HOME/Downloads/plotaroute-20512.json" \
  --direction backward
```

Missing parameters are prompted individually, including the collection name.
Use `--name "Collection name"` to provide the name without prompting.
If the browser adds a suffix to the JSON filename, use that actual filename.
Use `--gpx-dir /path/to/files` if files are separate from the JSON.

The CLI finds existing trails by name (or hikes with `--hike "Title"`), lets you
select one, then reviews one stage
at a time. Edits and acceptance are checkpointed immediately. Rerunning the same
command resumes unreviewed stages. Import uses only local files. Missing files are
reported and downloaded stages can be saved as an incomplete collection. A later,
fuller export can finish it. The JSON and GPX track names must agree; unsafe paths, duplicate records, or mixed collections are
rejected. Existing manual corrections are preserved when re-importing.

After a complete import is saved, the CLI offers to remove its downloaded JSON
and GPX files. Enter keeps them; `y` removes them. Paused or incomplete imports keep
the downloads for resuming. See [track imports](../../docs/track-imports.md) for
prerequisites, review controls, and data handling.

Published collections, GPX files, and photos continue to transfer together using
the existing `media-export.sh` / `media-import.sh` commands.

## Checks

Use Node from `.nvmrc`:

```sh
node tools/tests/plotaroute-extension.test.mjs
node tools/tests/plotaroute-collection.test.mjs
```

These checks also run in CI and cover file tracking, settings, collection order,
pause/resume, and metadata export. Backend tests cover import and review integration.
