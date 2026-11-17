# Google Analytics

Direct GA4 integration; Google Tag Manager is not used. Set `GOOGLE_ANALYTICS_ID=G-5VPSGFC1Q6` in the root `.env` on the VPS. Compose passes this runtime setting to the frontend. An empty ID disables collection. Only `DEPLOYMENT_ENVIRONMENT=prod` enables collection. Local/dev still show the consent UI for review, without requesting Google scripts. The ID is public, validated server-side, and passed only to the public layout. No backend or dependency changes are needed. The Google queue bridge has one narrowly scoped `prefer-rest-params` exception: Google requires its native `Arguments` command format rather than a rest-parameter array. All other ESLint settings are unchanged.

## Consent

The non-modal banner and footer settings control share the Swedish, English, and Czech messages in `frontend/src/i18n/messages.ts`. The banner links to a localized, non-indexable privacy policy using the standard page template. Migration `013_privacy_policy` creates the editable entity and its three published translations; run the normal Alembic upgrade on deployment. Localized page routes use Next.js `skipProxyUrlNormalize` so next-intl receives the original path and avoids rewrite/redirect loops. The initial policy uses the existing Instagram profile as a contact channel; review contact details and actual hosting/GA4 retention settings before publishing. The site remains usable without accepting.

A versioned localStorage choice expires after 180 days. Missing, expired, malformed or unavailable storage never grants consent. Choices synchronize across tabs and are checked before each event. No Google script or request is initiated until acceptance. Only analytics consent is granted; advertising storage, user data, personalization and Google signals stay disabled.

Withdrawal disables the active GA instance, revokes analytics consent, deletes matching first-party GA cookies on the host/parent domains, and reloads to unload Google code. Previously sent data is not deleted by withdrawal. Changing consent or its version can require a new choice. Storage failure displays an error without silently accepting.

## GA4 setup before production use

1. In the GA4 web stream for `G-5VPSGFC1Q6`, turn **Enhanced measurement off**. This implementation owns pageviews; automatic history pageviews would duplicate them. Keeping enhanced measurement off also avoids automatic form/outbound-link events collecting unreviewed values.
2. Leave Google Signals, advertising features, and user-provided data collection disabled. Review retention and data-sharing settings in the property.
3. Under Admin → Custom definitions, add event-scoped dimensions `metric_name`, `metric_rating`, and `metric_navigation_type`. Add a custom metric `metric_value` with Standard measurement unit (CLS is a unitless fraction; LCP/INP use milliseconds).
4. Use an Exploration filtered to event name `web_vital`, broken down by metric name, rating, page location/path, and device category. Separate metrics before comparing values. Do not register high-cardinality `metric_id` as a dimension. GA4 does not provide a built-in percentile Web Vitals dashboard; accurate p75 distributions require additional reporting/export.
5. Confirm the banner disclosures match the actual property settings and your privacy information before launch. The disclosure describes Google's default two-year GA cookie lifetime; the consent decision itself lasts 180 days.

Pageviews include initial load and pathname navigation, including browser back/forward. Hashes and query-only UI changes do not create pageviews. Query parameters are stripped except the five standard UTM attribution parameters; referrers have all queries/fragments removed. Do not put personal data in UTM values, route paths, or page titles. New events are not replayed for browsing before acceptance.

LCP, INP and CLS are collected through Next.js `useReportWebVitals` for document loads that began with valid consent. Accepting mid-document starts pageviews immediately but Web Vitals start on the next document load. Soft-navigation metrics are excluded. Metrics belong to their document entry URL, not the SPA route visible when a metric is delivered. Metrics absent from a browser/session (e.g. INP without interaction) are not fabricated. Each metric ID is sent once. `metric_value` preserves the raw value; the generic integer `value` scales CLS by 1,000 and rounds LCP/INP milliseconds. Web Vitals reflect consenting visitors only.

## Verification

Automated tests cover consent persistence/expiry/fail-closed handling, banner choices, URL sanitization, script gating, event guards and cookie cleanup. Run frontend lint, TypeScript, tests, and build without Docker.

After deployment, inspect Network with site storage cleared: no `googletagmanager.com` or GA collection requests before acceptance or after rejection. Accept: check a single pageview per navigation in GA4 Realtime/Tag Assistant, including back/forward and locale links. Reload after accepting and interact/leave the page to observe available Web Vitals. Check expiry and withdrawal across two tabs. Confirm no analytics on admin or dev. Browser blockers can prevent collection. DebugView requires enabling debug mode with Tag Assistant; production code does not enable it by default.

## Hike interaction events

The integration sends `hike_resource_click` for enabled resource links, `video_open` when a visitor opens a film (embedded player or external fallback), and `gallery_open` when a photo viewer opens. Gallery next/previous actions and closing a viewer do not emit events. Opening a video is not confirmation that it played or was watched. Resource events measure activation, not a completed download or successful destination load.

All three use the existing consent/production gating and include `hike_id`, `locale`, and a sanitized `page_location`. Resource clicks also include `resource_type` (`route`, `gpx_collection`, `progress`, `live_position`, `equipment`, or `social_feed`). No resource URLs, query strings, passwords, photo captions, or video titles are sent. Stable hike IDs combine activity across translated slugs.

In GA4 Admin → Custom definitions, register event-scoped dimensions `hike_id`, `locale`, and `resource_type` to use them in reports and Explorations. Filter by these event names and break down by hike and resource type. These are engagement signals, not key events by default. Keep Enhanced Measurement disabled to avoid overlapping automatic outbound/video events. Verify production delivery in Tag Assistant/Realtime after deployment; account reporting configuration is separate from the code change.
