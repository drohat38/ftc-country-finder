# Putting the finder on the Wix page

The finder lives at **https://ftc-country-finder.netlify.app**. In Wix you embed it by web address, so the Wix page never needs to change again when events change.

It replaces only the "CLICK ON THE CITY BELOW TO REGISTER!" block and the state-by-state list under it. Everything else on tangocharities.org/country stays as it is.

## Steps (Wix Editor)

1. Open the **Feed The Country** page (`/country`) in the Wix Editor.
2. Scroll to the "Volunteer at a Feed The Country Event" section. Click the block that contains the city list.
3. Add the embed: **Add Elements (+) → Embed Code → Embed a Site** (on some editors it is called "Embed HTML" → choose **Website address**). Paste:
   ```
   https://ftc-country-finder.netlify.app
   ```
4. Size it:
   - Width: full content width (about 980 px on desktop). Stretch it to the section edges.
   - Height: **2,900 px** on desktop. Do not leave height on "auto", Wix collapses it to a thin strip.
   - Switch to the **mobile editor** and set the height to **5,200 px**. The list is one column on phones, so it is taller.
   - The page never scrolls inside its own frame, so if Nick later adds many cities and the bottom gets cut off, add height.
5. Move the embed to where the city list was.
6. **Hide the old city-list block instead of deleting it** (right-click → Hide, or just drag it below the embed and shrink it) until you are happy. Delete it later.
7. Also hide or repurpose the "Click here to volunteer with Hawkeye & Michelle at the Dallas Event" link if it is inside that block; the Dallas (North) card carries the same Eventbrite link.
8. **Preview**, test on desktop and mobile preview, then **Publish**.

## Checks after publishing

- Search "Miami" in the embed. A "Coming soon" card should appear.
- Click Texas on the map. The list should narrow to Texas cities.
- Click a Register button. Eventbrite should open in a new tab.
- On a phone, the whole list should be visible with no inner scrollbar.

## Why this is allowed to load inside Wix

The hosting sends a `frame-ancestors` rule that allows tangocharities.org and Wix's own domains to frame it, and nothing else. If Wix ever moves to a new domain and the embed shows blank, Deven adds that domain in `netlify.toml`.

## Height cheat sheet

| Cities in the Sheet | Desktop height | Mobile height |
|---|---|---|
| Up to 70 | 2,900 px | 5,200 px |
| Up to 100 | 3,600 px | 7,000 px |
| Up to 150 | 4,800 px | 9,800 px |
