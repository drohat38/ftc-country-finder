# Putting the finder on the Wix page

The finder lives at **https://ftc-country-finder.netlify.app**. In Wix you embed it by web address, exactly like the monthly Feed The City map. The Wix page never needs to change when events change; those come from Eventbrite.

It is a full-frame app (map behind, panel in front), the same design as the monthly finder, so it should get the same treatment on the page: a fixed-height embed, not a long section.

## Where

Directly under the Feed The Country hero graphic, above "Over 100 Feed The City Events Happening In One Morning". Put a short heading above it in the page's own style if you like, for example **Find Your Event** in the blue Anton heading style used for "What is Feed The Country?".

## Steps (Wix Editor)

1. Open the **Feed The Country** page (`/country`) in the Wix Editor.
2. Add the embed: **Add Elements (+) → Embed Code → Embed a Site** (some editors call it "Embed HTML" → **Website address**). Paste:
   ```
   https://ftc-country-finder.netlify.app
   ```
3. Size it the same way the monthly map is embedded on /feed-the-city:
   - Desktop: full content width (about 980 px) × **640 px** tall. At least 900 × 640.
   - Mobile editor: full width × **640 px** tall. Do not leave height on "auto" or Wix collapses it to a strip.
   - It never needs resizing later; the list scrolls inside the panel and the map pans, no matter how many cities there are.
4. Drag it into place under the hero.
5. Scroll down to the "Volunteer at a Feed The Country Event" section and **hide the old city-list block** (right-click → Hide). Delete it later. Keep or shorten that section's intro text; "Find your city at the top of this page" is enough.
6. Hide or move the "Click here to volunteer with Hawkeye & Michelle at the Dallas Event" link if it is inside that block; the Dallas (North) card carries the same Eventbrite link.
7. **Preview** on desktop and mobile, then **Publish**.

## Checks after publishing

- The map shows pins across the country. If instead it says "Map key needs this site", finish step 2 of "1 - Start Here" (Google Maps key referrers).
- Type a ZIP code like 75201 and press Search. The list reorders with miles on each card and the map zooms to the area.
- Type "Texas". The list narrows to Texas events.
- Click a pin. On desktop a card pops up with Register and Directions; on a phone a sheet slides up.
- Click Register. Eventbrite opens in a new tab.
- On a phone, one finger scrolls the Wix page over the map (two fingers move the map). The list is a bottom sheet you can drag up.

## Why this is allowed to load inside Wix

The hosting sends a `frame-ancestors` rule that allows tangocharities.org and Wix's own domains to frame it, and nothing else. If Wix ever moves to a new domain and the embed shows blank, Deven adds that domain in `netlify.toml`.
