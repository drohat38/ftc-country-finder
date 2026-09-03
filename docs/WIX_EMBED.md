# Putting the finder on the Wix page

The finder lives at **https://ftc-country-finder.netlify.app**. In Wix you embed it by web address, so the Wix page never needs to change again when events change.

It is styled to look like part of the Feed The Country page: the same navy, the same orange Anton headings, square orange buttons, and the Skyline Blue US map from the Feed The Country lockup. Put it **directly under the Feed The Country hero graphic** (above "Over 100 Feed The City Events Happening In One Morning") so finding an event is the first thing a visitor sees. Everything else on the page stays where it is; only the old "CLICK ON THE CITY BELOW TO REGISTER!" list near the bottom gets hidden.

## Steps (Wix Editor)

1. Open the **Feed The Country** page (`/country`) in the Wix Editor.
2. Click just below the hero (the section that starts "Over 100 Feed The City Events Happening In One Morning"). You will add the embed between the hero and that section.
3. Add the embed: **Add Elements (+) → Embed Code → Embed a Site** (on some editors it is called "Embed HTML" → choose **Website address**). Paste:
   ```
   https://ftc-country-finder.netlify.app
   ```
4. Size it:
   - Width: full content width (about 980 px on desktop). Stretch it to the section edges.
   - Height: **1,800 px** on desktop. Do not leave height on "auto", Wix collapses it to a thin strip.
   - Switch to the **mobile editor** and set the height to **1,650 px**.
   - The embed stays this height no matter how many cities are added: the city list scrolls inside its own box, so the Wix page keeps scrolling normally on a phone.
5. Drag the embed so it sits directly under the hero, full width. Give it the same navy background as the section it sits in (the embed's own background is navy #003366, so any seam disappears).
6. Scroll down to the "Volunteer at a Feed The Country Event" section and **hide the old city-list block instead of deleting it** (right-click → Hide) until you are happy. Delete it later. You can keep that section's intro text, or replace it with one line: "Find your city at the top of this page."
7. Also hide or move the "Click here to volunteer with Hawkeye & Michelle at the Dallas Event" link if it is inside that block; the Dallas (North) card carries the same Eventbrite link.
8. **Preview**, test on desktop and mobile preview, then **Publish**.

## Checks after publishing

- Search "Miami" in the embed. A "Coming soon" card should appear.
- Click Texas on the map. The list should narrow to Texas cities.
- Click a Register button. Eventbrite should open in a new tab.
- On a phone, the whole list should be visible with no inner scrollbar.

## Why this is allowed to load inside Wix

The hosting sends a `frame-ancestors` rule that allows tangocharities.org and Wix's own domains to frame it, and nothing else. If Wix ever moves to a new domain and the embed shows blank, Deven adds that domain in `netlify.toml`.

## Height

The embed is a fixed height (1,800 px desktop, 1,650 px mobile) regardless of how many cities are in the Sheet. The list scrolls inside its own box. If the "What every volunteer brings" text in Settings gets much longer, add about 20 px per extra line.
