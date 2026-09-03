# Feed The Country Event Finder — Handoff

Built 2 September 2026 by Deven Rohatgi for Tango Charities. Nothing on the Wix site, the monthly Feed The City map, or its Google Sheet was changed. Everything below is new.

## What it is

A section that lists every Feed The Country event (Saturday, September 19, 2026) with a clickable map of the US, a search box, and a Register button for each city that goes to its Eventbrite page. It is styled to look like part of the Feed The Country page (same navy, same orange Anton headings, same square buttons) and goes directly under the Feed The Country hero graphic, so finding an event is the first thing a visitor sees. The rest of the Wix page stays exactly as Nick has it. It reads a Google Sheet, so updating an event means editing a row, not editing Wix.

Cities with no Eventbrite link yet show as "Coming soon" with a Notify me button instead of disappearing or sitting as dead text.

## The pieces

| Piece | Where | Who touches it |
|---|---|---|
| The Google Sheet (the only thing to edit day to day) | https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/edit | Nick |
| The live page (embed this in Wix) | https://ftc-country-finder.netlify.app | Nobody, it just reads the Sheet |
| Drive folder with the Sheet and these docs | https://drive.google.com/drive/folders/1B9qmQTwgzmhjNGgGIFTHWqfJykVjK4Gb | Deven / Nick |
| Sheet tools (the "Feed The Country Tools" menu inside the Sheet) | https://script.google.com/d/1Yx9CLv4MFYXGfQ81BxVexdoFsCX6ncyMg6hkzhz6o1QodUjbLk57D9Ia/edit | Deven |
| Source code | https://github.com/drohat38/ftc-country-finder (private) | Deven |
| Hosting | Netlify site `ftc-country-finder` (site id 33eca06f-9487-48e3-9df2-8ceea02fff63, team devenr) | Deven |

## One-time setup (about 10 minutes)

1. **Share the Sheet so the page can read it.** Open the Sheet → Share → General access → "Anyone with the link" → Viewer → Done. The page reads the Sheet through this link. Without it the page shows the saved copy from September 2.
2. **Turn on the tools menu.** Reload the Sheet. A menu called **Feed The Country Tools** appears next to Help. Click **Setup & repair → Setup / repair sheet**. Google will ask you to authorize the script the first time: Continue → choose your account → Advanced → "Go to Feed The Country Tools (unsafe)" → Allow. Then run Setup once more. This renames the tab to `Events`, adds the dropdowns, colors the header navy, and hides the technical columns.
3. **Turn on auto-updates.** Feed The Country Tools → Setup & repair → Install auto-update trigger. From now on, editing a row updates its Status and Last Updated by itself, and pasting an Eventbrite link tidies it.
4. **Embed in Wix.** Follow `WIX_EMBED.md`.
5. **Optional: Eventbrite sync.** Follow `EVENTBRITE_SYNC.md` if you want Eventbrite to fill the Sheet for you.

## Day to day

See `HOW_TO_UPDATE.md`. The short version: edit the row, and the page updates within about 10 minutes (immediately on a refresh).

## What still needs a person

- 14 cities on the Wix page had no Eventbrite link on September 2. They are in the Sheet as "Coming soon". When a host confirms, paste the Eventbrite link into `EventbriteURL` and the card flips to Register.
- The Eventbrite page for **Dallas (Lakewood)** lists the Prosper venue and address. That looks like a copy-paste error on Eventbrite. Fix it there; the Sheet row has a note.
- The Wix page has some contradictions in its copy. They are listed in `WIX_COPY_FIXES.md` for Nick to fix by hand when he adds the embed.
- The "Notify me" button currently opens the Feed The Country page. Point it at a real signup form by changing `notifyUrl` in `config.js` (Deven) once Nick picks one (a Google Form works).

## After September 19

The page notices the date and switches to a thank-you view on its own: the count becomes "events held", Register buttons go away, and monthly chapters get a "Monthly events" button pointing at the Feed The City finder. Nothing to do.
