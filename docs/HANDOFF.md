# Feed The Country Event Finder — Handoff

Built 2–4 September 2026 by Deven Rohatgi for Tango Charities. Nothing on the Wix site, the monthly Feed The City map, or its Google Sheet was changed. Everything below is new.

## What it is

The same event finder volunteers already use for monthly Feed The City events (map, search, list, bottom sheet on phones), rebuilt for Feed The Country on Saturday, September 19, 2026 with its own look: the Feed The Country lockup and a live tally (cities, states, signed up, days to go), a navy-water map, count bubbles for busy areas, capacity bars on cards. **It pulls its events straight from Eventbrite.** Nick creates or edits an event on Eventbrite and the finder shows the change within a few minutes: venue, address, time, Register link, how many people have signed up, and spots left.

Published Eventbrite events show **Registration open** with a Register button, a capacity bar ("45 signed up · 12 spots left") and the venue. Cities that are not on Eventbrite yet come from the Sheet's **Coming soon** tab (Nick types City and State) and show as gold **Coming soon** pins with no Register button. Draft Eventbrite events also count as Coming soon.

## How the data flows

Eventbrite (source of truth) → the site's own /api/events function on Cloudflare Pages (holds the token, caches 5 min) → the finder page.
Plus the Sheet's "Coming soon" tab. Fallback if the feed is down: the Sheet's Events tab (a mirror kept by the optional hourly sync). Last resort: seed/events.csv snapshot from Sept 2.

- The Eventbrite private token lives only in the hosting project's **environment variable** (`EVENTBRITE_TOKEN`, a Secret on Cloudflare Pages). It never reaches the browser, the repo, the Sheet, or the docs.
- The Google Sheet does two small jobs: the **Coming soon** tab (City, State, optional Note and Host) lists cities before they exist on Eventbrite, and the **Notify me** tab collects emails from people who ask to be told when a Coming soon city opens.

## The pieces

| Piece | Where | Who touches it |
|---|---|---|
| Eventbrite (the only thing to edit day to day) | https://www.eventbrite.com/organizations/events | Nick |
| The live finder (embed this in Wix) | https://ftc-country-finder.pages.dev (Cloudflare Pages, no badge; see "0 - Cloudflare Pages") | Nobody |
| Hosting + the Eventbrite feed function | Cloudflare Pages project `ftc-country-finder`, connected to the GitHub repo; every push to main redeploys. (A Netlify copy at ftc-country-finder.netlify.app exists from the build and can be deleted.) | Deven |
| Google Sheet: "Coming soon" tab + "Notify me" signups | https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/edit | Nick |
| Drive folder with these docs | https://drive.google.com/drive/folders/1B9qmQTwgzmhjNGgGIFTHWqfJykVjK4Gb | Deven / Nick |
| Source code | https://github.com/drohat38/ftc-country-finder (private) | Deven |
| Monthly map it is modeled on | https://github.com/drohat38/feed-the-city-event-map | Deven |

## One-time setup (Deven, about 15 minutes)

1. **Connect the repo to Cloudflare Pages and add the Eventbrite token.** Follow "0 - Cloudflare Pages" (5 minutes). The token comes from Eventbrite → Account Settings → Developer Links → API Keys → Create API Key → **Private token**, and goes into the Pages project as a Secret environment variable named `EVENTBRITE_TOKEN`. Read-only safeguards are in "5 - Eventbrite Feed".
2. **Create a Google Maps key for this site.** Google Cloud Console → pick the project that holds the monthly map's key (it already has billing and both APIs enabled) → APIs & Services → Credentials → Create credentials → API key. Edit it: Application restrictions = Websites, add `https://ftc-country-finder.pages.dev/*`, `https://*.ftc-country-finder.pages.dev/*`, `https://tangocharities.org/*`, `https://www.tangocharities.org/*`, `http://localhost:8080/*`; API restrictions = Maps JavaScript API + Geocoding API. Save, copy the key into `config.js` as `googleMapsKey`, push. Optional: Maps JavaScript API → Quotas → cap map loads per day (20,000) so a spike can never bill. Until the key is in, the list works but the map shows a "Map key needs this site" card.
3. **Embed in Wix.** Follow "4 - Wix Embed Steps".
4. **Run Setup in the Sheet once more** (Feed The Country Tools → Setup & repair → Setup / repair sheet). This creates the **Coming soon** tab with an example row. The Sheet is already shared, so the finder reads it.

## Day to day (Nick)

Everything happens on Eventbrite:

- **New city:** create the event with a title that starts with **Feed The Country** and the city, e.g. `Feed The Country Tulsa: A Nationwide Day of Volunteering`. Set the venue. Publish when ready. It appears on the finder within about 5 minutes.
- **Change a venue or time:** edit the Eventbrite event. Done.
- **City with no event yet:** type City and State on the Sheet's **Coming soon** tab. It shows as a gold Coming soon pin within about 10 minutes. Once the Eventbrite event exists, the Sheet row is ignored automatically.
- **Remove a city:** cancel or delete the event on Eventbrite. For a Coming soon row, tick Hide or delete the row.
- **Share one city:** open its pin and tap the share icon; it copies a link that opens the finder on that city.

The city name comes from the title: whatever sits between "Feed The Country" and the colon. `Feed The Country Dallas (North): …` becomes "Dallas (North)". The state comes from the venue address.

## What still needs a person

- The Eventbrite page for **Dallas (Lakewood)** lists the Prosper venue and address. Fix it on Eventbrite; the finder will follow.
- 14 cities on the Wix page had no Eventbrite event on September 2 (Gilbert AZ, Danbury CT, Miami FL, Ocala FL, Jackson MS, Howell Township NJ, Selden NY, Vestal NY, Oklahoma City OK, Chattanooga TN, Lufkin TX, Pearland TX, The Colony TX, Weatherford TX). They are in the seed and the Sheet as Coming soon. Move them to the Coming soon tab, or create draft Eventbrite events for them.
- Wix copy contradictions are listed in "6 - Wix Copy Fixes".

## "Notify me" signups

Parked for now. The button still works: on a Coming soon city, volunteers can type their email and it lands in the **Notify me** tab (timestamp, email, city, state). Nothing is emailed to anyone and no address is stored in the Sheet's settings. When a city goes live, whoever runs comms can filter that tab by city and email the Register link.

## After September 19

The finder notices the date: on the day the header says events are packing meals today; afterwards the tally shows a check mark, Register buttons become a "Monthly events" link to the Feed The City finder, and the header thanks volunteers. Nothing to do that morning.
