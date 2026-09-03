// Feed The Country events feed.
// Pulls live, started and draft events for the Tango Charities organization from the Eventbrite API,
// keeps the ones whose title starts with "Feed The Country", and returns a small JSON list the finder
// page can read. The Eventbrite private token lives ONLY in the Netlify environment variable
// EVENTBRITE_TOKEN; it never reaches the browser. Responses are cached at the CDN for 5 minutes.
//
// Netlify env vars used:
//   EVENTBRITE_TOKEN   (required)  private token from Eventbrite > Account Settings > Developer Links > API Keys
//   EVENTBRITE_ORG_ID  (optional)  skip the organizations lookup; otherwise the first organization is used
//   EVENTBRITE_AFF     (optional)  attribution code appended to Register links, default oddtdtcreator

const API = "https://www.eventbriteapi.com/v3";
const TITLE_RE = /^\s*feed\s+the\s+country\b/i;

export default async (request) => {
  const token = process.env.EVENTBRITE_TOKEN;
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=60",
    "netlify-cdn-cache-control": "public, s-maxage=300, stale-while-revalidate=900"
  };
  if (!token) {
    return new Response(JSON.stringify({ ok: false, error: "not_configured", message: "EVENTBRITE_TOKEN is not set in Netlify environment variables." }),
      { status: 503, headers: { ...headers, "cache-control": "no-store", "netlify-cdn-cache-control": "no-store" } });
  }
  try {
    const orgId = process.env.EVENTBRITE_ORG_ID || await firstOrgId(token);
    const events = await allEvents(token, orgId);
    const aff = process.env.EVENTBRITE_AFF || "oddtdtcreator";
    const out = events.filter(e => e && e.name && TITLE_RE.test(e.name.text || "")).map(e => shape(e, aff)).filter(Boolean);
    return new Response(JSON.stringify({ ok: true, source: "eventbrite", updated: new Date().toISOString(), count: out.length, events: out }), { status: 200, headers });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: "eventbrite_failed", message: String(err && err.message || err) }),
      { status: 502, headers: { ...headers, "cache-control": "no-store", "netlify-cdn-cache-control": "no-store" } });
  }
};

export const config = { path: "/api/events" };

async function eb(token, path, params) {
  const url = new URL(API + path);
  Object.entries(params || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v); });
  const res = await fetch(url, { headers: { authorization: "Bearer " + token, accept: "application/json" } });
  const text = await res.text();
  let body = {};
  try { body = JSON.parse(text); } catch (e) { body = {}; }
  if (!res.ok) throw new Error("Eventbrite " + res.status + (body.error_description ? ": " + body.error_description : ""));
  return body;
}

async function firstOrgId(token) {
  const data = await eb(token, "/users/me/organizations/");
  const orgs = data.organizations || [];
  if (!orgs.length) throw new Error("This token has no organizations.");
  const tango = orgs.find(o => /tango/i.test(o.name || ""));
  return (tango || orgs[0]).id;
}

async function allEvents(token, orgId) {
  // One call per status we care about. Drafts show as "coming soon" in the finder.
  const statuses = ["live", "started", "draft"];
  const results = [];
  for (const status of statuses) {
    let continuation = null;
    for (let page = 0; page < 10; page++) {
      const data = await eb(token, "/organizations/" + orgId + "/events/", {
        status, time_filter: "current_future", order_by: "start_asc", page_size: 200,
        expand: "venue,ticket_classes", continuation
      });
      results.push(...(data.events || []));
      if (data.pagination && data.pagination.has_more_items && data.pagination.continuation) continuation = data.pagination.continuation;
      else break;
    }
  }
  const seen = new Set();
  return results.filter(e => { if (!e || seen.has(e.id)) return false; seen.add(e.id); return true; });
}

function shape(e, aff) {
  const name = (e.name && e.name.text || "").trim();
  const m = name.match(/^\s*feed\s+the\s+country\s*[:\-–—]?\s*(.+?)\s*(?:[:\-–—]\s.*)?$/i);
  const v = e.venue || {};
  const addr = v.address || {};
  let city = (m && m[1] || "").trim();
  city = city.replace(/\s+/g, " ");
  if (!city) city = (addr.city || "").trim();
  const state = String(addr.region || "").trim().toUpperCase().slice(0, 2);
  const status = String(e.status || "").toLowerCase();
  const live = status === "live" || status === "started";
  let sold = 0, total = 0, sawClasses = false;
  (e.ticket_classes || []).forEach(tc => {
    if (tc.hidden || tc.deleted) return;
    sawClasses = true;
    sold += parseInt(tc.quantity_sold, 10) || 0;
    total += parseInt(tc.quantity_total, 10) || 0;
  });
  if (!total && e.capacity) total = parseInt(e.capacity, 10) || 0;
  const url = live && e.url ? e.url.split("?")[0] + "?aff=" + encodeURIComponent(aff) : "";
  const lat = parseFloat(v.latitude), lng = parseFloat(v.longitude);
  return {
    id: String(e.id),
    name,
    city,
    state,
    venue: (v.name || "").trim(),
    address: (addr.localized_address_display || [addr.address_1, addr.city, addr.region, addr.postal_code].filter(Boolean).join(", ")).trim(),
    time: timeRange(e.start && e.start.local, e.end && e.end.local),
    date: e.start && e.start.local ? e.start.local.slice(0, 10) : "",
    url,
    status: live ? "live" : "coming soon",
    live,
    registered: sawClasses ? sold : null,
    capacity: total || null,
    lat: isFinite(lat) ? lat : null,
    lng: isFinite(lng) ? lng : null
  };
}

function timeRange(startLocal, endLocal) {
  const f = (iso) => {
    if (!iso) return "";
    const mm = String(iso).match(/T(\d{2}):(\d{2})/);
    if (!mm) return "";
    let h = parseInt(mm[1], 10);
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return h + ":" + mm[2] + " " + ampm;
  };
  const a = f(startLocal), b = f(endLocal);
  return a && b ? a + " - " + b : a;
}
