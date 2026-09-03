# The Eventbrite feed

The finder reads its events from Eventbrite. This is how that works and how to set it up.

## What runs

A small program on Netlify (`netlify/functions/events.mjs`, reachable at https://ftc-country-finder.netlify.app/api/events) does this every time the finder loads, and Netlify caches the answer for 5 minutes:

1. Asks Eventbrite for the Tango Charities organization's **live**, **started**, and **draft** events that are today or in the future.
2. Keeps only events whose title starts with **"Feed The Country"** (any capitalization). Monthly Feed The City events are ignored.
3. For each one, returns: city (from the title, before the colon), state (from the venue address), venue, address, time, Register link, whether registration is open (live or started) or coming soon (draft), tickets sold, capacity, and the venue's coordinates.
4. Sends that list to the finder as JSON. The token is used only on the server and never sent to the browser.

It only ever reads from Eventbrite (GET requests). It never creates, edits, or deletes anything.

## Setting it up (Deven, once)

1. Log in to Eventbrite with the admin account.
2. Go to **Account Settings → Developer Links → API Keys** (https://www.eventbrite.com/account-settings/apps). Click **Create API Key**. Any name and website are fine ("Feed The Country finder", https://www.tangocharities.org).
3. On the key you just created, copy the **Private token**. Do not paste it into email, Slack, or a chat.
4. Netlify → **ftc-country-finder** → **Site configuration → Environment variables → Add a variable**:
   - Key: `EVENTBRITE_TOKEN`
   - Value: the token
   - Tick **Secret** (Netlify then hides it in its own UI too)
   - Scopes: all, or just Functions
5. **Deploys → Trigger deploy → Deploy site**, so the function picks up the variable.
6. Open https://ftc-country-finder.netlify.app/api/events in a browser. You should see `"ok": true` and a `count`. Then reload the finder.

Optional variables: `EVENTBRITE_ORG_ID` (skip the organizations lookup) and `EVENTBRITE_AFF` (attribution code on Register links, default `oddtdtcreator`).

## The risk, plainly

An Eventbrite private token has the same power as the account that created it: it can read and change every event, order, and attendee list in that account. That is why:

- It is stored only as a **Netlify environment variable** on this one site. It is not in the code repository, not in the finder page, not in the Sheet, not in any document. Only people who can log in to the Netlify team can see or change it.
- The function only sends read requests. There is no code path that writes to Eventbrite.
- The function returns only the fields listed above, never attendee names, emails, or order data.
- You can revoke the key any time on Eventbrite's API Keys page. The finder then falls back to the Google Sheet (if shared) or the saved snapshot, and keeps working.
- Eventbrite's rate limit is 1,000 calls per hour per token. With 5-minute caching this uses at most 36 calls an hour.

## Turning it off

Delete the `EVENTBRITE_TOKEN` variable in Netlify and trigger a deploy, or revoke the key on Eventbrite. The finder keeps working from the Sheet or the snapshot.

## The Sheet's own sync (legacy, optional)

The Google Sheet still has a **Feed The Country Tools → Eventbrite sync** menu that can pull the same data into the Sheet using a token stored in the Google account of whoever runs it. You only need it if you want the Sheet itself to stay in step with Eventbrite. The finder does not depend on it.
