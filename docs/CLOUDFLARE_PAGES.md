# Hosting on Cloudflare Pages (no badge)

Netlify's free plan stamps a "Powered by Netlify" badge on the page. Cloudflare Pages does not, it is free, and it is where the monthly Feed The City map already lives (`feed-the-city-event-map.pages.dev`). The repo is ready for it: `functions/api/events.js` is the Eventbrite feed as a Pages Function, and `_headers` carries the Wix framing rule.

## Connect the repo (Deven, about 5 minutes)

1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick the GitHub account `drohat38` and the repo **ftc-country-finder**. (Authorize Cloudflare's GitHub app for that repo if asked.)
3. Set up build:
   - Project name: `ftc-country-finder` (this becomes `https://ftc-country-finder.pages.dev`)
   - Production branch: `main`
   - Framework preset: **None**
   - Build command: leave empty
   - Build output directory: `/` (a single slash, the repo root)
4. **Save and Deploy**. The first deploy takes about a minute. The `functions/` folder is picked up automatically, so `https://ftc-country-finder.pages.dev/api/events` exists right away (it answers "not configured" until step 5).
5. **Eventbrite token:** in the Pages project → **Settings → Environment variables** → **Add variable** for **Production**: name `EVENTBRITE_TOKEN`, value = the private token, type **Secret**. Save. Then **Deployments → Retry deployment** on the latest one (variables apply on the next deploy).
6. Check https://ftc-country-finder.pages.dev/api/events shows `"ok": true` and a `count`.

From then on, every `git push` to `main` redeploys in about a minute. Nothing else to run.

## Google Maps key for the new address

The map only works on sites listed in the key's referrers. Create a new key (steps in "1 - Start Here") with these referrers:

```
https://ftc-country-finder.pages.dev/*
https://*.ftc-country-finder.pages.dev/*
https://tangocharities.org/*
https://www.tangocharities.org/*
http://localhost:8080/*
```

Put the key in `config.js` as `googleMapsKey` and push, or hand it to Deven to do it.

## Wix

Embed `https://ftc-country-finder.pages.dev` exactly as described in "4 - Wix Embed Steps" (full width × 640 px). If a custom address like `finder.tangocharities.org` is ever wanted, Pages → **Custom domains** adds it in a few clicks; then add that address to the key's referrers too.

## Netlify

The Netlify site `ftc-country-finder` can be left alone or deleted once Pages is live. `netlify.toml` and `netlify/functions` stay in the repo so either host works; they do not affect Cloudflare.
