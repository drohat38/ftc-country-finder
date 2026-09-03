# Changelog

Every user-visible change, newest first. Written so Nick can read it.

## 2026-09-02
- **Search that never dead-ends.** Type a ZIP code, any US city, a state, or tap Near me, and the list ranks every event by distance with miles on each card. City and state names forgive typos ("Tenessee", "Dentn"). A state with events browses that state; a state without any shows the closest events and a "Bring Feed The City to your town" link.
- **Bubbles instead of a blob.** Nearby events group into orange bubbles with a count (Dallas–Fort Worth shows 33), and the busiest area gets its own zoomed inset map with every city labeled. Clicking a bubble or a state lists just those cities. Hover shows the venue and time.
- **Richer cards.** Date and time line, venue and full address, a Directions button (Google Maps), host name, monthly chapter or one-day badge, and, once the Eventbrite sync is on, "spots left" and "volunteers signed up". A nationwide "Volunteers signed up" counter appears at the top when that data exists.
- **What every volunteer brings** now sits above the list, pulled from the Sheet's new Settings tab so Nick can change the wording without code. Settings also hold the Notify me link and the after-event message.
- **Eventbrite token is now private to the account that saved it.** Moved from Script Properties (readable by any Sheet editor) to User Properties. Only Deven can run the sync by hand; the hourly sync still runs on its own.
- **Prettier, easier Sheet.** Setup now orders the columns (Notes right after Paused), sets widths, colors whole rows by Status, turns Paused into a checkbox, freezes the header and City column, adds filter arrows, protects the header row, and builds a "Start Here" tab with live counts and short instructions. New menu item: Organize sheet (sort by state and city).
- **Restyled to match the Feed The Country page.** Deven said the first version looked too different. It now uses the page's own navy background, orange Anton headings, gold date line, Poppins counters, Avenir-style body text and square orange buttons, and is meant to sit directly under the Feed The Country hero graphic. Map states use the Skyline Blue from the Feed The Country lockup.
- **Finder page built.** Navy hero with live counts and a countdown, a clickable US map drawn in the page (states with events in Skyline Blue, orange dots for open registration, gold for coming soon), search, filter chips, and state-by-state cards with Register buttons. Cities without an Eventbrite link show "Coming soon" with a Notify me button.
- **Reads the Google Sheet "Feed The Country Events".** Falls back to the saved September 2 list if Google cannot be reached, and says so in a banner.
- **Sheet tools installed.** "Feed The Country Tools" menu: statuses, coordinates from the address, link tidying, hidden technical columns, and an optional hourly Eventbrite sync (needs a token; see docs/EVENTBRITE_SYNC.md).
- **Docs for Nick** in docs/: handoff, how to update, Wix embed steps with measured heights, Eventbrite sync and its risks, Wix copy fixes, demo script.
- **Flagged:** the Dallas (Lakewood) Eventbrite page lists the Prosper venue. Noted in the Sheet row.
- **Project started.** Scaffolded the repo, pulled the 63 cities from tangocharities.org/country, and filled venue, address, time and coordinates for the 49 that already have Eventbrite pages. The 14 cities with no link yet are marked "Coming soon" instead of being dead text.
