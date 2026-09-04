# Feed The Country Event Finder — Handoff

Built 2–3 September 2026 by Deven Rohatgi for Tango Charities. Nothing on the Wix site, the monthly Feed The City map, or its Google Sheet was changed. Everything below is new.

## What it is

The same event finder volunteers already use for monthly Feed The City events (map on the right, search and list on the left, bottom sheet on phones), rebuilt for Feed The Country on Saturday, September 19, 2026. **It pulls its events straight from Eventbrite.** Nick creates or edits an event on Eventbrite and the finder shows the change within a few minutes: venue, address, time, Register link, how many people have signed up, and spots left. Nothing to retype anywhere.

Published Eventbrite events show **Registration open** with a Register button, a capacity bar ("45 signed up · 12 spots left") and the venue. Cities that are not on Eventbrite yet come from the Sheet's **Coming soon** tab (Nick types City and State) and show as gold **Coming soon** pins with no Register button. Draft Eventbrite events also count as Coming soon.

## How the data flows

```
Eventbrite (source of truth)  →  Netlify function /api/events (holds the token, caches 5 min)  →  the finder page
                                                    ↑ fallback: Google Sheet "Feed The Country Events" (optional overrides)
                                                    ↑ last resort: seed/events.csv snapshot from Sept 2
```

- The Eventbrite private token lives only in a **Netlify environment variable** (`EVENTBRITE_TOKEN`). It never reaches the browser, the repo, the Sheet, or the docs.
- The Google Sheet does two small jobs: the **Coming soon** tab (City, State, optional Note and Host) lists cities before they exist on Eventbrite, and the **Notify me** tab collects emails from people who ask to be told when a Coming soon city opens. The Events tab is a mirror of Eventbrite kept by the optional hourly sync; it is also the fallback if the feed is ever down.

## The pieces

| Piece | Where | Who touches it |
|---|---|---|
| Eventbrite (the only thing to edit day to day) | https://www.eventbrite.com/organizations/events | Nick |
| The live finder (embed this in Wix) | https://ftc-country-finder.netlify.app | Nobody |
| Netlify site (hosting + the Eventbrite feed function) | https://app.netlify.com/projects/ftc-country-finder · site id 33eca06f-9487-48e3-9df2-8ceea02fff63, team devenr | Deven |
| Google Sheet: "Coming soon" tab + "Notify me" signups | https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/edit | Nick |
| Drive folder with these docs | https://drive.google.com/drive/folders/1B9qmQTwgzmhjNGgGIFTHWqfJykVjK4Gb | Deven / Nick |
| Source code | https://github.com/drohat38/ftc-country-finder (private) | Deven |
| Monthly map it is modeled on | https://github.com/drohat38/feed-the-city-event-map | Deven |

## One-time setup (Deven, about 10 minutes)

1. **Eventbrite token into Netlify.** Eventbrite → Account Settings → Developer Links → API Keys → Create API Key → copy the **Private token**. Then Netlify → the `ftc-country-finder` site → Site configuration → Environment variables → Add a variable: key `EVENTBRITE_TOKEN`, value = the token, tick "Secret". Redeploy once (Deploys → Trigger deploy). From then on https://ftc-country-finder.netlify.app/api/events returns the live list. Details and the risk note are in "5 - Eventbrite Feed".
2. **Let the Google Maps key work on this site.** The finder uses the same Google Maps key as the monthly map. That key only works on sites listed in Google Cloud Console → APIs & Services → Credentials → the key → Website restrictions. Add:
   ```
   https://ftc-country-finder.netlify.app/*
   ```
   (and `http://localhost:8080/*` if you want to test locally). Until then the list works but the map area shows a "Map key needs this site" card. If you would rather not touch the existing key, create a new key in the same project with Maps JavaScript API + Geocoding API enabled and those referrers, and put it in `config.js` as `googleMapsKey`.
3. **Embed in Wix.** Follow "4 - Wix Embed Steps".
4. **Run Setup in the Sheet once more** (Feed The Country Tools → Setup & repair → Setup / repair sheet). This creates the **Coming soon** tab with an example row. The Sheet is already shared, so the finder reads it.

## Day to day (Nick)

Everything happens on Eventbrite:

- **New city:** create the event with a title that starts with **Feed The Country** and the city, e.g. `Feed The Country Tulsa: A Nationwide Day of Volunteering`. Set the venue. Publish when ready. It appears on the finder within about 5 minutes.
- **Change a venue or time:** edit the Eventbrite event. Done.
- **City with no event yet:** type City and State on the Sheet's **Coming soon** tab. It shows as a gold Coming soon pin within about 10 minutes. Once the Eventbrite event exists, the Sheet row is ignored automatically.
- **Remove a city:** cancel or delete the event on Eventbrite. For a Coming soon row, tick Hide or delete the row.

The city name comes from the title: whatever sits between "Feed The Country" and the colon. `Feed The Country Dallas (North): …` becomes "Dallas (North)". The state comes from the venue address.

## What still needs a person

- The Eventbrite page for **Dallas (Lakewood)** lists the Prosper venue and address. Fix it on Eventbrite; the finder will follow.
- 14 cities on the Wix page had no Eventbrite event on September 2 (Gilbert AZ, Danbury CT, Miami FL, Ocala FL, Jackson MS, Howell Township NJ, Selden NY, Vestal NY, Oklahoma City OK, Chattanooga TN, Lufkin TX, Pearland TX, The Colony TX, Weatherford TX). They are in the seed and the Sheet as Coming soon. The clean fix: create a draft Eventbrite event for each so they live in one place.
- Wix copy contradictions are listed in "6 - Wix Copy Fixes".

## "Notify me" signups

Parked for now. The button still works: on a Coming soon city, volunteers can type their email and it lands in the **Notify me** tab (timestamp, email, city, state). Nothing is emailed to anyone and no address is stored in the Sheet's settings. When a city goes live, whoever runs comms can filter that tab by city and email the Register link.

## After September 19

The finder notices the date: the badge reads "Sept 19 complete", Register buttons are replaced by a "Monthly events" link to the Feed The City finder, and the header thanks volunteers. Nothing to do that morning.
