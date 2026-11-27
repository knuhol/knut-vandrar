# Dynamic hike maps and Garmin tracking

Every hike map uses its selected GPX collection in MapLibre. Garmin adds live progress on ongoing hikes. Backend startup applies revision `031_retire_static_maps`, which drops the retired generated-image table. When importing an older media archive, the importer verifies and skips its generated map files.

Dynamic maps use OpenFreeMap for the basemap and worldwide Mapterhorn terrain for contours and hillshade. Inline maps let visitors scroll the page and offer modifier-key zoom or two-finger panning. Fullscreen maps accept direct scroll and touch gestures. If the basemap fails, the warning and GPX download occupy the same space as the inline map. The map shows one Terrain sources link to the provider’s dataset and licensing credits.

## Production

1. Set `GARMIN_MAPSHARE_USERNAME` in the backend environment to the MapShare username (for example, `knuhol`). The backend uses it for the Garmin feed and the public link on active tracking cards. Publish the intended data in Garmin MapShare and enable live tracking and set a password under **Garmin MapShare settings** in admin. The same site-wide value is used for polling and shown with a copy button above every active tracking card. Inactive cards display without a password. Set the expected inReach reporting interval in the same admin panel. Live maps display this interval separately from the backend’s Garmin polling cadence.
2. Assign an imported GPX collection and set the start date and time on the hike. The actual start takes precedence over the planned start. If neither is set, the first polling attempt establishes the start boundary.
3. Set the hike to ongoing. The backend polls while exactly one hike is ongoing and it has a selected GPX collection. If several hikes are ongoing, it suspends Garmin polling and shows a configuration error on their dynamic maps. Completing the hike stops live publication and leaves its collected fixes in PostgreSQL.

The backend startup migration creates `garmin_points` and `garmin_sync`. A PostgreSQL advisory lock coordinates the poll across backend processes. The worker polls every two minutes by default. Change `GARMIN_POLL_SECONDS` to tune the cadence. It requests at most seven days at a time, overlaps the checkpoint by two days to recover delayed transmissions, and pauses for one hour after HTTP 429. The checkpoint advances only on a successful request. The public API reads the local database and preserves prior progress during Garmin outages. See [Garmin's feed format and limits](https://support.garmin.com/en-US/?faq=tdlDCyo1fJ5UxjUbA9rMY8).

The API serves the planned map separately from tracking updates. The browser refreshes progress every 30 seconds and updates the map in place. After 30 minutes without a new fix, the marker turns steady orange and shows when the last update was recorded. A fresh fix restores the pulsing red marker. The header uses the same live status, and the hike card and cover show the Live badge while new fixes are coming in.

The matcher indexes GPX segments geographically and measures progress along the ordered route without adding distance between disconnected segments. Candidate projections are evaluated against route distance, elapsed time, previous matches, and course when available. Ambiguous and off-route fixes leave the last reliable position in place. Production also holds that position when the device backtracks. The overlay shows elapsed days and hours since the first valid Garmin fix. Average progress updates at midnight in Europe/Stockholm, starting at the first midnight at least 72 hours after the first valid Garmin fix, and rounds to whole kilometres per day. Starting at 72 hours, the finish estimate updates with current progress and elapsed time. Day-based estimates round to the nearest whole day. For the final day, the overlay estimates the remaining walking time from recent forward Garmin progress. It skips stationary fixes and gaps longer than 45 minutes and needs at least three qualifying intervals. If there is too little walking data, the estimate stays in days. A matched position within 50 metres of the route end and a GPS fix within 50 metres of the endpoint mark the route complete. At 100%, the entire planned geometry is drawn as completed.

## Historical replay

Set the root environment for local replay:

```dotenv
DEPLOYMENT_ENVIRONMENT=local
GARMIN_REPLAY_FILE=backend/dev-data/bergslagsleden_2026.kml
GARMIN_REPLAY_HIKE_ID=<Bergslagsleden hike UUID>
```

Recreate the backend with the updated environment, then open the normal hike page. Replay starts automatically at ten recorded minutes per second. Reload the hike page to start over. The backend serves replay only in the local environment and only for the configured hike. Fixtures live under `backend/dev-data` and are included in the backend Docker build.

Replay reads the KML locally and uses the production parser, GPX route, matcher, progress calculations, and map. Every request passes only the fixes recorded by the selected time into matching and status calculations. It can show backward movement and does not write tracking records or change the public hike status.
