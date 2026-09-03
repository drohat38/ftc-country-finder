# Feed The Country Event Finder

Static, dependency-light page that lists every Feed The Country event (Saturday, September 19, 2026) from a Google Sheet, with a clickable SVG map of the US. Embedded by URL in the Wix page tangocharities.org/country. Built 2026-09-02 for Tango Charities; maintained by Deven Rohatgi; content owned by Nick Marino Jr. (boss) through the Sheet.

## Map of the repo
- `index.html`, `styles.css`, `app.js`, `config.js` — the finder. No build step. Vanilla JS. Fonts: Anton (display), Poppins (counters), Avenir/Nunito Sans (body) from Google Fonts. Data via PapaParse from cdnjs.
- `us-zip3.js` (Census ZCTA centroids by 3-digit prefix, public domain) and `us-cities.js` (GeoNames cities15000 for the US, CC BY 4.0, credited in the footer) power distance search. Do not hand-edit.
- `us-states.js` — pre-projected state outlines (us-atlas@3 states-albers-10m, ISC). 975x610 Albers USA canvas. Do not hand-edit.
- `config.js` — the ONLY file with environment values: published CSV URL, gviz fallback, event date, notify URL.
- `apps-script/` — bound Apps Script for the Google Sheet "Feed The Country Events" (clasp-managed). `Code.gs` = Tools menu, statuses, geocoding, trigger. `Eventbrite.gs` = optional hourly sync from the Eventbrite API (token in Script Properties only).
- `seed/events.csv` — the 63 rows the Sheet was created from (2026-09-02 snapshot of the Wix page + Eventbrite).
- `docs/` — boss-facing handoff: HANDOFF, HOW_TO_UPDATE, WIX_EMBED, EVENTBRITE_SYNC, WIX_COPY_FIXES, DEMO_SCRIPT.
- `assets/` — Tango Charities logos from the official Brand Kit (Drive folder 14A5ajuR6Wb1BHCD1Cl2d3yztsCZk6Hmq).

## Standing rules (same as ftc-leader-hub)
1. Every change is committed AND pushed immediately, with a CHANGELOG.md entry in plain English.
2. Create-only outside this repo. Never edit the Wix site, the monthly map repo (~/Projects/FeedTheCityMap), its Sheet, or Tango-owned Drive files.
3. Iframe-safe layout: no 100vh, no position: fixed, `html, body { height: auto }`. One deliberate exception: the city list scrolls inside `#list-scroll` (fixed max-height) so the embed stays ~1,800 px tall and the Wix page keeps scrolling on phones. Deven asked for this on 2026-09-02.
4. Remote data reaches the DOM through textContent only. Never innerHTML with Sheet values.
5. No frameworks. A student must be able to maintain this.
6. Content changes belong in the Sheet, not in code. If Nick has to touch code, the design is wrong.
7. Brand: Ignite Orange #FF6500 (actions only), Deep Anchor Blue #003366, Skyline Blue #39BAE4, Golden Pulse #B78D5B, Soft Steel #E2E7E6. Campaign gold #F2A71E for "coming soon" and dates, matching the Wix page. Do not introduce other oranges.
8. The Sheet column `Paused` is never renamed (matches the monthly map's convention).

## Commands
- Local preview: `python3 -m http.server 8080` then http://localhost:8080/
- Apps Script: `cd apps-script && clasp push -f` (updates HEAD; the bound script has no web-app deployment to redeploy).
- Netlify: Netlify MCP `deploy-site` with the site id in README, then run the printed npx command (fix `//proxy/` -> `/proxy/` first).
- Cache busting: bump `?v=N` on styles.css / app.js / config.js / us-states.js in index.html on every deploy.

## Gotchas
- The published CSV lags Sheet edits by up to ~5 minutes (Google's publish cache). The page also polls every 10 minutes.
- Alaska / Hawaii rows list fine but get no map dot (lower-48 projection only).
- Map zoom is a viewBox animation; markers are re-drawn each frame at 1/zoom so they stay the same size on screen. Cluster radius is 18 screen px, so zooming in splits bubbles.
- Design rules from Deven (2026-09-02): white panel, white cards, navy text; no light text on navy except the heading strip; no chapter/one-day labels for volunteers; the embed must stay short on phones.
- After the event date in config.js, the hero switches to the thank-you state automatically.
