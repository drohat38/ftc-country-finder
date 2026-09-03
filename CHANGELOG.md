# Changelog

Every user-visible change, newest first. Written so Nick can read it.

## 2026-09-02
- **Finder page built.** Navy hero with live counts and a countdown, a clickable US map drawn in the page (states with events in Skyline Blue, orange dots for open registration, gold for coming soon), search, filter chips, and state-by-state cards with Register buttons. Cities without an Eventbrite link show "Coming soon" with a Notify me button.
- **Reads the Google Sheet "Feed The Country Events".** Falls back to the saved September 2 list if Google cannot be reached, and says so in a banner.
- **Sheet tools installed.** "Feed The Country Tools" menu: statuses, coordinates from the address, link tidying, hidden technical columns, and an optional hourly Eventbrite sync (needs a token; see docs/EVENTBRITE_SYNC.md).
- **Docs for Nick** in docs/: handoff, how to update, Wix embed steps with measured heights, Eventbrite sync and its risks, Wix copy fixes, demo script.
- **Flagged:** the Dallas (Lakewood) Eventbrite page lists the Prosper venue. Noted in the Sheet row.
- **Project started.** Scaffolded the repo, pulled the 63 cities from tangocharities.org/country, and filled venue, address, time and coordinates for the 49 that already have Eventbrite pages. The 14 cities with no link yet are marked "Coming soon" instead of being dead text.
