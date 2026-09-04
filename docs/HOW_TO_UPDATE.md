# How To Update Feed The Country Events

**Day to day, everything happens on Eventbrite.** Create, edit, publish, or cancel the Eventbrite event and the finder follows within about 5 minutes. Titles must start with "Feed The Country" plus the city, e.g. `Feed The Country Tulsa: A Nationwide Day of Volunteering`. Drafts show as Coming soon; published events show Register.

**Cities that are not on Eventbrite yet** go on the Sheet's **Coming soon** tab: type the City and its two-letter State (optional Note, e.g. "Host confirming venue", and Host). The finder shows a gold Coming soon pin within about 10 minutes. Once the Eventbrite event exists, that row is ignored automatically. Tick **Hide** to take a row off the finder, or just delete it.

The rest of the Sheet (the Events tab) is a mirror of Eventbrite kept by the tools. You do not need to edit it.

---


Use this Google Sheet:

https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/edit

Every row is one city. Rows are matched to Eventbrite events by city and state; a Sheet row adds a Host name or hides a city, and a city with no Eventbrite event shows as Coming soon.

The first tab, **Start Here**, shows live counts (how many cities are Live, Coming soon, Hidden) and the short version of these instructions. The **Events** tab is the one you edit. Rows are colored by Status: blue = Live, gold = Coming soon, grey = Hidden, red = Missing info. Use the filter arrows in the header row to see one state at a time.

## To change an existing event

1. Find the city's row.
2. Change what you need: Venue, Address, Time, Host, HostType, or EventbriteURL.
3. Look at the `Status` column. It updates itself:
   - `Live` — has an Eventbrite link. Shows with a Register button.
   - `Coming soon` — no Eventbrite link yet. Shows with a Notify me button.
   - `Hidden` — the Paused box is ticked. Not shown.
   - `Missing info` — needs a City and a two-letter State.
4. Refresh the page.

If you changed the Address, the coordinates update by themselves and the dot on the map moves.

## To add a new city

1. Add a row at the bottom.
2. Fill in City, State (two letters, like `TX`), and the Eventbrite link if there is one.
3. Choose `HostType`: **Monthly chapter** if that city already runs a monthly Feed The City, **One-day host** if it is only for September 19.
4. Fill Venue, Address, and Time if you have them. If you leave them blank, the card says "Venue and time on the Eventbrite page".
5. That's it. Status and the map dot fill in on their own. If the dot doesn't appear after a minute, select the row and click **Feed The Country Tools → Fill coordinates for selected rows**.

Tip: if the city name needs a neighborhood, write it like `Dallas (North)` or `Austin (Zilker)`.

## To hide a city

Tick the **Paused** box. The row stays in the Sheet, the city disappears from the page. Untick it to bring it back.

## To keep it tidy

**Feed The Country Tools → Organize sheet** sorts every row by state and city and refreshes the colors. Run it whenever the list looks jumbled after adding rows.

## To turn "Coming soon" into "Register"

Paste the Eventbrite link into `EventbriteURL`. The link tidies itself (https, and the `aff=oddtdtcreator` tracking code so Eventbrite reports stay complete) and the card flips to Register.

## "Notify me" signups

The **Notify me** tab fills up by itself: one row per person who asked to be told when a Coming soon city opens (timestamp, email, city, state). Nothing is emailed automatically. When a city goes live, filter the tab by that city and email those people the Register link.

## Words and links on the finder (Settings tab)

The **Settings** tab has a few Key / Value rows. Edit the Value column only:

- `what_to_bring` — the one-line shopping list shown in each event's details card.
- `notify_url` — leave blank. Only fill it if you want the Notify me button to open a form somewhere else instead of the built-in email box.

## Registered and Capacity

The finder gets these straight from Eventbrite (tickets sold and capacity) and shows "45 signed up · 12 spots left" on the card. The Sheet columns are only used when Eventbrite is unreachable.

## What not to edit

These columns are hidden and filled in by the tools: Latitude, Longitude, EventbriteID, LastSynced, EventID, FirstAdded, Last Updated. If you ever need to see them: **Feed The Country Tools → Show technical columns**. Hide them again with **Hide technical columns**.

## Menu reference (Feed The Country Tools)

- **Organize sheet** — sort by state and city, refresh statuses and colors.
- **Refresh statuses** — recompute every Status. Use if something looks off.
- **Fill coordinates for selected rows** — re-place the map dot from the Address.
- **Fill all missing coordinates** — place any row that has no dot.
- **Normalize Eventbrite links** — tidy every link at once.
- **Eventbrite sync** — see EVENTBRITE_SYNC.md.
- **Setup & repair** — one-time setup, rebuild the Start Here tab, and repair if a header gets deleted by accident.

## Quick test

Change a Venue, refresh the page, and find the card. It should show the new venue. Change it back.
