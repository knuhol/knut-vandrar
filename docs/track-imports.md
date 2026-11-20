# Importing Plotaroute collections

Download a collection with the [browser extension](../tools/plotaroute-extension/README.md),
using **GPX → Track** (POIs recommended), then review and import its JSON manifest
and GPX files locally. The importer uses only local files; it does not launch a browser or contact Plotaroute.

## Prerequisites

Use the backend virtual environment and the project's Python version from
`.python-version`. The root `.env` supplies database and media configuration.
PostgreSQL must be reachable through its configured host port, and `MEDIA_ROOT`
must point to the same host directory mounted by the backend.

Apply migrations through `017_hike_collection_direction` using the normal
deployment workflow before importing. The script does not start Docker or apply migrations.
Source and destination must have matching database revisions for media transfers.

## Import and review

Run without arguments to enter everything interactively:

```sh
./scripts/tracks-import.sh
```

The script asks for the target type and partial name/title, bundle path, GPX
folder, collection ID, and trail direction where applicable. After you select the
matching target, it asks for the collection name. Questions appear one at a time.
Enter accepts the displayed defaults for the folder and collection ID.

Every parameter can instead be supplied as a flag. Mix flags and prompts freely;
supplied values are not asked again. The `local` argument remains supported but
is optional. `--name "Collection name"` supplies the collection name explicitly.
New collections require a name; the importer does not invent one from the target
or source. Reimports and resumed drafts offer their existing name as the default.

Keep the exported JSON and GPX files together, then run from the repository root:

```sh
./scripts/tracks-import.sh local \
  --trail Bergslagsleden \
  --bundle "$HOME/Downloads/plotaroute-20512.json" \
  --direction backward
```

Use the actual JSON filename if the browser added a suffix such as `(1)`.
If the GPX files are elsewhere, add `--gpx-dir /path/to/files`. The collection ID
from the manifest is offered as the default; `--collection ID_OR_URL` supplies it
without prompting and must match the manifest.

To import a collection belonging directly to a hike, replace `--trail` with
`--hike` and an existing hike title:

```sh
./scripts/tracks-import.sh local \
  --hike "My hike title" \
  --bundle "$HOME/Downloads/plotaroute-20512.json"
```

Use exactly one of `--trail` or `--hike`. Select the existing target by number.
Search uses case-insensitive partial names/titles (for example, `--trail ber` or
`--hike nor`) across all supported translations and never creates a
trail or hike. Hike imports create a custom collection and select it for that hike
when the review is saved; a hike does not need a trail to have its own collection.
Trail collections remain shared and can be selected by multiple hikes.

In **Admin → Hikes → Route → Track collection**, choose either a collection owned
by that hike or a collection from its current trail. Selection is explicit; the
system does not guess from direction or automatically choose a trail collection.
Clear the field to remove the selection. A collection belonging to another hike
or trail is rejected. Changing trails requires a valid selection for the new
trail (or keeping the hike's own custom collection).

`--direction forward|backward` is required only for trail collections. Hike-owned
collections have no direction; do not supply `--direction` with `--hike`. For trails,
`forward` and `backward` describe the collection direction only. They never
reorder routes or reverse coordinates. Official stage identifiers remain separate
from itinerary positions.

Review one stage at a time:

- **Enter** accepts the stage and advances.
- **e**, then a field number and text, edits a value.
- Empty edit input keeps the value; `/clear` clears an optional endpoint.
- **b** returns to the previous stage.
- **q**, Ctrl+C, or end of input pauses without publishing.

Each edit and acceptance is checkpointed in PostgreSQL. Rerunning the command and
selecting the same trail or hike resumes at the first unreviewed stage. The saved
draft's direction takes precedence when resuming. Draft GPX data is stored privately under
`MEDIA_ROOT/.track-drafts/` and excluded from media exports.
If temporary draft files are lost, rerunning with the original export rebuilds
them while preserving saved edits and review progress.

After review, **c** edits the collection name (and direction for trails), **r** revisits a stage, and
**s** saves the collection. Missing or invalid files are reported; valid stages can
be saved as an incomplete collection and finished using a later export. Missing
routes are reported and retained rather than deleted. Re-importing updates source
data while preserving manual corrections; changed stages require review again.

## Remove downloads after import

After a complete collection is saved, the script offers to remove that manifest
and its imported GPX downloads. **Enter keeps them; y removes them.** Only files
listed in that bundle are considered, and changed files or symlinks are kept.
Unrelated downloads and imported files in media storage are untouched.

Paused or incomplete imports keep their downloads for resuming. Cleanup is never
automatic and is offered only after the database transaction has committed.

## Data handling

Route order always follows the Plotaroute collection's displayed itinerary, in
both directions. Import and review do not sort by name or official stage number;
source positions are read-only and supersede older manual order overrides. If you
change the order on Plotaroute, download a fresh export before re-importing.

Start and finish are extracted first from notes matching `X - Y`. If the notes do
not provide that pair, the importer checks the route title for the same format.
Both names must be nonempty and the value must be a single line with exactly one
` - ` separator. Otherwise both fields remain empty. Direction arrows are removed
before checking titles. Existing manual endpoint corrections are preserved.
Original source metadata and descriptions are retained separately from overrides.

Trailing direction arrows are removed from GPX names, and synthetic export times
are removed so repeating a download does not change its checksum just because of
the export date. Geometry, elevation, segments and POI labels/symbols are retained.
Published tracks use immutable, checksum-addressed paths under `MEDIA_ROOT/tracks/`.

## Transfer pictures and tracks together

Use the existing media commands:

```sh
./scripts/media-export.sh local backups/media.tar
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-server --dry-run
./scripts/media-import.sh dev backups/media.tar --ssh deploy@your-server
```

The archive includes pictures, published collections, route metadata, manual
corrections and GPX bytes. No Plotaroute access occurs during transfer. `--location`
exports that trail's pictures and collections; `--hike` includes its custom
collections, selected collection, and trail collections. Without filters, all published media is included.

Owners must already exist at the destination. `--map-location SOURCE=DESTINATION`
maps trails; `--map-hike SOURCE=DESTINATION` maps hikes, including custom collection
ownership and the selected collection. Selections are checked against the
destination hike and trail. Collection and route IDs are preserved.
Archive format 3 includes hike ownership and collection selections; readers also
accept formats 1 and 2 with a matching database revision. Conflicting metadata
requires `--replace`; destination-only records and unpublished
drafts are preserved. Missing GPX files can be repaired by repeating the import.
See [media transfers](media-transfers.md) for the full transfer instructions.
