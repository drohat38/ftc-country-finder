# How To Update Feed The Country Events

Use this Google Sheet:

https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/edit

Every row is one city. The page reads the Sheet, so you never edit Wix for event changes. Changes show up on the page within about 10 minutes, or right away if you refresh it.

## To change an existing event

1. Find the city's row.
2. Change what you need: Venue, Address, Time, Host, HostType, or EventbriteURL.
3. Look at the `Status` column. It updates itself:
   - `Live` — has an Eventbrite link. Shows with a Register button.
   - `Coming soon` — no Eventbrite link yet. Shows with a Notify me button.
   - `Hidden` — Paused is Yes. Not shown.
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

Set `Paused` to **Yes**. The row stays in the Sheet, the city disappears from the page. Set it back to **No** to bring it back.

## To turn "Coming soon" into "Register"

Paste the Eventbrite link into `EventbriteURL`. The link tidies itself (https, and the `aff=oddtdtcreator` tracking code so Eventbrite reports stay complete) and the card flips to Register.

## What not to edit

These columns are hidden and filled in by the tools: Latitude, Longitude, EventbriteID, LastSynced, EventID, FirstAdded, Last Updated. If you ever need to see them: **Feed The Country Tools → Show technical columns**. Hide them again with **Hide technical columns**.

## Menu reference (Feed The Country Tools)

- **Refresh statuses** — recompute every Status. Use if something looks off.
- **Fill coordinates for selected rows** — re-place the map dot from the Address.
- **Fill all missing coordinates** — place any row that has no dot.
- **Normalize Eventbrite links** — tidy every link at once.
- **Eventbrite sync** — see EVENTBRITE_SYNC.md.
- **Setup & repair** — one-time setup, and repair if a header gets deleted by accident.

## Quick test

Change a Venue, refresh the page, and find the card. It should show the new venue. Change it back.
