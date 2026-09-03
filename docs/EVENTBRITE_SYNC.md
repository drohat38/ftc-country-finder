# Eventbrite sync (optional)

With the sync on, creating or editing a Feed The Country event on Eventbrite updates the Sheet within the hour. Nobody types a venue twice. The finder works fine without it; this is a convenience.

## What it does, exactly

Every hour (or when you click **Sync now**), the script:

1. Asks Eventbrite for the Tango Charities organization's live, upcoming events.
2. Keeps only events whose title starts with **"Feed The Country"** (any capitalization). Everything else, including monthly Feed The City events, is ignored.
3. For each one, finds the Sheet row by Eventbrite ID, then by Eventbrite link, then by city and state.
4. Fills **Venue, Address, Time, EventbriteURL, Latitude, Longitude, EventbriteID, LastSynced**. It never touches Host, HostType, Paused, or Notes, and it never deletes a row.
5. Adds a new row for any Feed The Country event that has no row yet (as a One-day host; change HostType if it is a chapter).
6. Writes a **Sync Report** tab: how many found, updated, added, and any it could not match.

It only ever reads from Eventbrite (GET requests). It never creates, edits, or deletes anything on Eventbrite.

Title convention that makes matching work: **"Feed The Country {City}: …"**, for example "Feed The Country Dallas (North): A Nationwide Day of Volunteering". The city part before the colon becomes the City cell.

## Setting it up (Deven, once)

1. Log in to Eventbrite with the admin account.
2. Go to **Account Settings → Developer Links → API Keys** (https://www.eventbrite.com/account-settings/apps). Click **Create API Key**. Any name and website are fine ("Feed The Country Sheet sync", https://www.tangocharities.org). It is an internal tool, so the application type does not matter.
3. On the key you just created, copy the **Private token**. Do not put it in email or Slack.
4. Open the Sheet → **Feed The Country Tools → Eventbrite sync → Set Eventbrite token…** → paste → OK. The script checks the token against Eventbrite right away and tells you which organization it connected to. If the token is bad, it is not kept.
5. **Eventbrite sync → Preview sync (no changes)**. Open the Sync Report tab and read it. Preview never writes to the Events tab.
6. If the preview looks right: **Eventbrite sync → Sync now**, then **Turn on hourly sync**.

## The risk, plainly

An Eventbrite private token has the same power as the account that created it: it can read and change every event, order, and attendee list in that account. That is why:

- The token is stored in the **User Properties of the Google account that saved it** (Deven's). Google keeps User Properties per person, so other editors of the Sheet cannot read it, not even from the script editor. It is never written to a cell, never sent to the finder page, never logged, never put in an error message, and never in the code repository.
- Because it is tied to one account, only that account can run "Sync now" or turn on the hourly sync. The hourly sync runs as that account on its own, so Nick does not need the token for the sync to keep working. If Nick clicks "Sync now" he gets a friendly "no token saved for your account" message.
- The sync only sends read requests. There is no code path that writes to Eventbrite.
- You can revoke it any time from the same API Keys page. The finder keeps working from the Sheet. Use **Eventbrite sync → Forget Eventbrite token** to also turn off the hourly job.
- Eventbrite's rate limit is 1,000 calls per hour per token. The sync uses one to three calls per run.
- The remaining risk is the Google account that holds it. Keep two-step verification on that account.

If you would rather not use a token at all, skip this document. Nick pastes Eventbrite links into the Sheet by hand and everything else still works.

## Turning it off

**Feed The Country Tools → Eventbrite sync → Turn off hourly sync.** To remove the token entirely, **Forget Eventbrite token**.
