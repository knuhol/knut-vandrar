# Self-hosted Umami

The public production site uses banner-free Umami at `https://umami.vandrar.se`,
replacing GA4. Configure these runtime settings in
`/etc/knut-vandrar/production.env`:

```dotenv
UMAMI_SCRIPT_URL=https://umami.vandrar.se/script.js
UMAMI_WEBSITE_ID=b5e90f9a-26ed-4dc7-a4eb-241b22c5ca5d
```

Remove the old `GOOGLE_ANALYTICS_ID` entry. Compose passes the settings to the
frontend; normal deployment recreates it. Both values are public and validated
centrally on the server. An empty website ID disables collection, including when
the template script URL is present. Only `DEPLOYMENT_ENVIRONMENT=prod` enables
collection. Local/dev, preview and admin remain untracked. No new dependencies or
backend API changes are required.

## Banner-free operation and privacy

The tracker loads after hydration without waiting for a consent choice. There is
no analytics banner, cookie-settings button, consent polling or consent storage.
Old `knut-analytics-consent` preferences are no longer read or written. Old GA
cookies may remain in browsers but are not used by this integration. There is no
on-site opt-out control. A localized privacy-policy link remains in the footer.

Banner-free operation is the site owner's chosen configuration. This is not a
claim that cookie-free tracking is exempt from all consent or data-protection
requirements. The privacy text describes the actual collection without asserting
that visitors granted consent or that cookies are needed for analytics.

Migration `014_umami_privacy_policy` applies the supplied English, Swedish and
Czech policy text, including titles, eyebrows and introductions. It changes only
privacy-policy content; existing row IDs, publication/indexing flags and other
pages are preserved. Downgrade restores the original default texts only where the
new policy has not since been edited. The experimental local-only migrations were
consolidated into this single revision before deployment.

Umami processes connection/browser information and derives session identifiers
with a rotating salt. Analytics is stored in its separate database. Configure
retention and backups for that service separately. Advertising, visitor account identification, replay,
heatmaps and automatic error capture are not enabled by this integration.

## Pageviews and events

The tracker uses `data-auto-pageview=false`; the application owns pageviews and
custom events while Umami initializes its native performance collector. Its ready callback sends the current page once the script loads.
It does not replay browsing or events from before the tracker was available.
Path navigation, including back/forward and locale links, sends a single pageview
per route. Query-only changes and fragments do not create pageviews. Page URLs
retain only the five standard UTM query fields; referrers lose queries and
fragments. Do not put personal information in paths, titles or UTM fields.

Custom events are `hike_resource_click`, `video_open` and `gallery_open`.
Hike events include `hike_id`, `hike_title`, `locale`, sanitized `page_location`, and, for
resource clicks, `resource_type`. Resource URLs, passwords, captions and video
titles are excluded. Gallery next/previous and closing do not emit events.
Opening a video does not confirm playback.

In Umami, open Events → Properties and select `hike_title` for readable hike
breakdowns. This is always the English source title, supplied by the existing
hike-detail response regardless of the page language. `locale` still identifies
the visitor's page language; `hike_id` remains stable across title edits. If the
English source is missing, events retain the ID but omit `hike_title` rather than
fall back to a translated title. Titles describe the hike at the time of the
event. Previously recorded events are not backfilled or renamed.

## Native performance monitoring

`data-performance=true` enables Umami's native collection of LCP, INP, CLS, FCP
and TTFB. View these measurements in Umami's Performance screen, not custom event
reports. There is no Next.js Web Vitals reporter or custom `web_vital` event.
The manual pageview setup requires Umami 3.2.0 or newer (the VPS uses 3.5.0).

Keep auto-track enabled: `data-auto-track=false` would disable initialization of
the native collector. Disable only automatic pageviews to avoid duplicating the
application's pageviews. Native performance requests use the same before-send
URL sanitization and active-instance guard as events. Umami owns metric timing,
page attribution and reporting; delivery depends on browser support, interactions,
page visibility and whether the tracker is blocked. Historical custom events, if
any were already collected, are not converted or deleted.

## Verification

Run frontend formatting, lint, TypeScript, analytics tests and build without
Docker. Test migration upgrades/downgrades and preservation of customized policies.
After authorized deployment, confirm the tracker loads without a banner on public
production pages; check one pageview per route and the three custom event types.
Reload a public page, interact and navigate away or hide the tab, then check the
Performance screen for available native metrics. Verify that no new custom
`web_vital` events are sent.
Confirm local/dev, preview and admin send no analytics. Verify the footer's localized
privacy links and all three database-backed policy translations. Live delivery
requires deployment and cannot be established by unit tests alone.
