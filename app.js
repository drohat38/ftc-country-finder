/* Feed The Country Event Finder
   Store-locator layout: a real street map (MapLibre GL + OpenFreeMap tiles, no API key) beside a search
   box and a scrolling list. Reads the "Events" (and optional "Settings") tabs of the Google Sheet.
   Search resolves ZIP codes, any US city, states and "near me" to a place and ranks by distance.
   Rules: remote values reach the DOM through textContent only. No frameworks beyond MapLibre. */
(function () {
  "use strict";

  var CFG = window.FTC_COUNTRY_CONFIG || {};
  var STATES = {
    AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut",
    DE: "Delaware", DC: "Washington, DC", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois",
    IN: "Indiana", IA: "Iowa", KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
    MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri", MT: "Montana",
    NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico", NY: "New York",
    NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania",
    RI: "Rhode Island", SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah",
    VT: "Vermont", VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming"
  };
  var STATE_BY_NAME = {};
  Object.keys(STATES).forEach(function (k) { STATE_BY_NAME[STATES[k].toLowerCase()] = k; });

  var state = { rows: [], byId: {}, settings: {}, query: "", near: null, stateSel: null, activeId: null, source: "", loadedAt: null, after: false };
  var $ = function (id) { return document.getElementById(id); };
  var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- DOM helpers (textContent only) ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }
  function link(cls, text, href, label) {
    var a = el("a", cls, text);
    a.href = href; a.target = "_blank"; a.rel = "noopener";
    if (label) a.setAttribute("aria-label", label);
    return a;
  }

  /* ---------- data ---------- */
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!/^https?:\/\//i.test(u)) return "";
    u = u.replace(/^http:\/\/(www\.)?eventbrite\.com/i, "https://www.eventbrite.com");
    if (/eventbrite\.com\/e\//i.test(u) && CFG.affCode) u = u.split("?")[0].split("#")[0] + "?aff=" + encodeURIComponent(CFG.affCode);
    return u;
  }
  function tidyTime(t) { return String(t || "").trim().replace(/\s*-\s*/g, " – ").replace(/\s+/g, " "); }
  function normalize(raw) {
    var get = function (k) { return String(raw[k] === undefined || raw[k] === null ? "" : raw[k]).trim(); };
    var status = get("Status").toLowerCase(), pausedRaw = get("Paused").toLowerCase();
    var paused = pausedRaw === "yes" || pausedRaw === "true" || status === "hidden";
    var url = safeUrl(get("EventbriteURL"));
    var city = get("City").replace(/\s+/g, " "), st = get("State").toUpperCase();
    if (!city || !st) return null;
    var lat = parseFloat(get("Latitude")), lng = parseFloat(get("Longitude"));
    var registered = parseInt(get("Registered"), 10), capacity = parseInt(get("Capacity"), 10);
    return {
      id: (city + "|" + st).toLowerCase(),
      city: city, st: st, stateName: STATES[st] || st, base: city.replace(/\s*\(.*?\)\s*/g, "").trim(),
      venue: get("Venue"), address: get("Address"), time: tidyTime(get("Time")), host: get("Host"),
      chapter: get("HostType").toLowerCase().indexOf("monthly") === 0,
      url: url, live: !!url, paused: paused,
      registered: isFinite(registered) && registered > 0 ? registered : null,
      capacity: isFinite(capacity) && capacity > 0 ? capacity : null,
      lat: isFinite(lat) && Math.abs(lat) <= 90 ? lat : null, lng: isFinite(lng) && Math.abs(lng) <= 180 ? lng : null
    };
  }
  function rowsLookValid(rows) { return !!(rows && rows.length && ["City", "State"].every(function (k) { return Object.prototype.hasOwnProperty.call(rows[0], k); })); }
  function fetchCsv(url) {
    var sep = url.indexOf("?") >= 0 ? "&" : "?";
    return fetch(url + sep + "_=" + Date.now(), { cache: "no-store" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status);
      return res.text();
    }).then(function (text) {
      if (!window.Papa) throw new Error("CSV parser did not load");
      return window.Papa.parse(text, { header: true, skipEmptyLines: true }).data;
    });
  }
  function fetchGviz(url) {
    return new Promise(function (resolve, reject) {
      if (!url) return reject(new Error("no gviz url"));
      var done = false;
      window.ftcCountryLoaded = function (resp) {
        done = true;
        try {
          var cols = resp.table.cols.map(function (c) { return c.label || c.id; });
          resolve(resp.table.rows.map(function (r) { var o = {}; cols.forEach(function (c, i) { var cell = r.c[i]; o[c] = cell && cell.v !== null && cell.v !== undefined ? cell.v : ""; }); return o; }));
        } catch (e) { reject(e); }
      };
      var s = document.createElement("script");
      s.src = url + (url.indexOf("?") >= 0 ? "&" : "?") + "cacheBust=" + Date.now();
      s.onerror = function () { reject(new Error("gviz script failed")); };
      document.head.appendChild(s);
      setTimeout(function () { if (!done) reject(new Error("gviz timeout")); }, 12000);
    });
  }
  function loadSettings() {
    if (!CFG.settingsUrl) return Promise.resolve({});
    return fetchCsv(CFG.settingsUrl).then(function (rows) {
      var out = {};
      rows.forEach(function (r) { var k = String(r.Key || r.key || "").trim().toLowerCase(), v = String(r.Value || r.value || "").trim(); if (k) out[k] = v; });
      return out;
    }).catch(function () { return {}; });
  }
  function load(isRefresh) {
    var attempts = [];
    if (CFG.csvUrl) attempts.push({ name: "sheet", run: function () { return fetchCsv(CFG.csvUrl); } });
    if (CFG.gvizUrl) attempts.push({ name: "sheet", run: function () { return fetchGviz(CFG.gvizUrl); } });
    if (CFG.seedUrl) attempts.push({ name: "seed", run: function () { return fetchCsv(CFG.seedUrl); } });
    var i = 0;
    function next(lastErr) {
      if (i >= attempts.length) { if (!isRefresh) showError(lastErr); return; }
      var a = attempts[i++];
      a.run().then(function (rows) {
        if (!rowsLookValid(rows)) throw new Error("Sheet columns do not match (need City, State)");
        var norm = rows.map(normalize).filter(Boolean);
        if (!norm.length) throw new Error("No events in the data");
        return (a.name === "sheet" ? loadSettings() : Promise.resolve(state.settings)).then(function (settings) {
          state.rows = norm; state.byId = {}; norm.forEach(function (r) { state.byId[r.id] = r; });
          state.settings = settings || {}; state.source = a.name; state.loadedAt = new Date();
          renderAll(!isRefresh);
          if (a.name === "seed" && (CFG.csvUrl || CFG.gvizUrl)) banner("stale", "Showing the last saved list. Live updates from the Sheet could not be reached.", true);
          else if (!isRefresh) banner(null);
        });
      }).catch(function (err) {
        if (window.console) console.warn("Load via " + a.name + " failed:", err && err.message);
        next(err);
      });
    }
    next();
  }
  function setting(key, fallback) { var v = state.settings[key]; return v !== undefined && v !== "" ? v : fallback; }

  /* ---------- banner / errors ---------- */
  function banner(kind, text, retry) {
    var b = $("banner");
    clear(b);
    b.className = "banner hidden";
    if (!kind) return;
    b.className = "banner banner-" + kind;
    b.appendChild(document.createTextNode(text));
    if (retry) { var btn = el("button", "", "Try again"); btn.type = "button"; btn.addEventListener("click", function () { load(false); }); b.appendChild(btn); }
  }
  function showError(err) {
    var list = $("list");
    clear(list);
    var box = el("div", "empty");
    box.appendChild(el("b", "", "We couldn't load the event list."));
    box.appendChild(el("span", "", "Please refresh the page, or search \"Feed The Country\" on Eventbrite."));
    list.appendChild(box);
    $("result-title").textContent = "";
    banner("error", "The event list did not load" + (err && err.message ? " (" + err.message + ")" : "") + ".", true);
  }

  /* ---------- geography ---------- */
  function miles(a, b) {
    var d = Math.PI / 180, R = 3958.8;
    var dLat = (b[0] - a[0]) * d, dLng = (b[1] - a[1]) * d;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function fmtMiles(m) { return m < 1 ? "under 1 mi" : (m < 10 ? m.toFixed(1) : Math.round(m)) + " mi"; }
  function boundsOf(rows) {
    var b = null;
    rows.forEach(function (r) {
      if (r.lat === null || r.lng === null) return;
      if (!b) b = [[r.lng, r.lat], [r.lng, r.lat]];
      b[0][0] = Math.min(b[0][0], r.lng); b[0][1] = Math.min(b[0][1], r.lat);
      b[1][0] = Math.max(b[1][0], r.lng); b[1][1] = Math.max(b[1][1], r.lat);
    });
    return b;
  }

  /* ---------- map (MapLibre + OpenFreeMap) ---------- */
  var map = null, mapReady = false, markers = {}, onScreen = {}, popup = null, homeBounds = null, mapOk = false;
  function webglOk() { try { var c = document.createElement("canvas"); return !!(window.WebGLRenderingContext && (c.getContext("webgl") || c.getContext("experimental-webgl"))); } catch (e) { return false; } }
  function initMap() {
    if (map || !window.maplibregl || !webglOk()) { if (!window.maplibregl || !webglOk()) mapUnavailable("The map could not load on this device. The list below still works."); return; }
    try {
      map = new maplibregl.Map({
        container: "map", style: CFG.mapStyle || "https://tiles.openfreemap.org/styles/positron",
        center: [-96.5, 38.5], zoom: 3.2, minZoom: 2.4, maxZoom: 16,
        cooperativeGestures: true, attributionControl: { compact: true }, dragRotate: false, pitchWithRotate: false
      });
      map.touchZoomRotate.disableRotation();
      map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
      map.on("load", function () {
        mapReady = true; mapOk = true;
        map.addSource("events", { type: "geojson", data: geojson(), cluster: true, clusterRadius: 44, clusterMaxZoom: 13,
          clusterProperties: { live: ["+", ["case", ["get", "live"], 1, 0]] } });
        map.addLayer({ id: "events-hidden", type: "circle", source: "events", paint: { "circle-radius": 0, "circle-opacity": 0 } });
        map.on("render", syncMarkers);
        map.on("moveend", syncMarkers);
        map.on("zoomend", updateResetButton);
        fitHome(true);
      });
      map.on("error", function (e) { if (window.console && e && e.error) console.warn("Map:", e.error.message || e.error); });
    } catch (e) { mapUnavailable("The map could not load. The list below still works."); }
  }
  function mapUnavailable(msg) {
    var n = $("map-note"); n.textContent = msg; n.classList.remove("hidden");
  }
  function geojson() {
    return { type: "FeatureCollection", features: state.rows.filter(function (r) { return !r.paused && r.lat !== null && r.lng !== null; }).map(function (r) {
      return { type: "Feature", geometry: { type: "Point", coordinates: [r.lng, r.lat] }, properties: { id: r.id, live: r.live } };
    }) };
  }
  function refreshMapData() {
    if (!mapReady) return;
    var src = map.getSource("events");
    if (src) src.setData(geojson());
    Object.keys(onScreen).forEach(function (k) { onScreen[k].remove(); });
    markers = {}; onScreen = {};
    syncMarkers();
  }
  function fitHome(instant) {
    homeBounds = boundsOf(state.rows.filter(function (r) { return !r.paused; }));
    if (!mapReady) return;
    if (homeBounds) map.fitBounds(homeBounds, { padding: 36, maxZoom: 6, duration: instant || reduceMotion ? 0 : 700 });
    updateResetButton();
  }
  function updateResetButton() {
    if (!mapReady) return;
    $("map-reset").classList.toggle("hidden", map.getZoom() < 4.2 && !state.near && !state.stateSel);
  }
  function clusterEl(count, liveCount, feature) {
    var d = el("div", "mk mk-cluster" + (liveCount === 0 ? " soon" : "") + (count >= 10 ? " big" : ""), count);
    var size = Math.min(56, 30 + Math.sqrt(count) * 4);
    d.style.width = size + "px"; d.style.height = size + "px";
    d.setAttribute("role", "button"); d.setAttribute("tabindex", "0"); d.setAttribute("aria-label", plural(count, "event", "events") + " here. Zoom in.");
    var go = function () {
      var src = map.getSource("events");
      var p = src.getClusterExpansionZoom(feature.properties.cluster_id);
      var done = function (z) { map.easeTo({ center: feature.geometry.coordinates, zoom: Math.min(z, 15), duration: reduceMotion ? 0 : 600 }); };
      if (p && typeof p.then === "function") p.then(done).catch(function () { map.easeTo({ center: feature.geometry.coordinates, zoom: map.getZoom() + 2 }); });
    };
    d.addEventListener("click", go);
    d.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    return d;
  }
  function pointEl(r) {
    var d = el("div", "mk");
    var dot = el("div", "mk-dot" + (r.live ? "" : " soon"));
    d.appendChild(dot);
    d.setAttribute("role", "button"); d.setAttribute("tabindex", "0"); d.setAttribute("aria-label", r.city + ", " + r.st + (r.live ? "" : " (coming soon)"));
    d.title = r.city + ", " + r.st;
    var go = function () { focusEvent(r, false); };
    d.addEventListener("click", go);
    d.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    return d;
  }
  function syncMarkers() {
    if (!mapReady || !map.getSource("events") || !map.isSourceLoaded("events")) return;
    var feats = map.querySourceFeatures("events"), now = {};
    for (var i = 0; i < feats.length; i++) {
      var f = feats[i], p = f.properties, coords = f.geometry.coordinates;
      var key = p.cluster ? "c" + p.cluster_id + "_" + p.point_count : "p" + p.id;
      if (now[key]) continue;
      var m = markers[key];
      if (!m) {
        var node = p.cluster ? clusterEl(p.point_count, p.live, f) : pointEl(state.byId[p.id] || { id: p.id, city: "", st: "", live: p.live });
        m = markers[key] = new maplibregl.Marker({ element: node }).setLngLat(coords);
      }
      now[key] = m;
      if (!onScreen[key]) m.addTo(map);
    }
    Object.keys(onScreen).forEach(function (k) { if (!now[k]) onScreen[k].remove(); });
    onScreen = now;
    paintActiveMarker();
  }
  function paintActiveMarker() {
    Object.keys(onScreen).forEach(function (k) {
      var dot = onScreen[k].getElement().querySelector(".mk-dot");
      if (dot) dot.classList.toggle("active", k === "p" + state.activeId);
    });
  }
  function popupFor(r) {
    var box = el("div", "");
    box.appendChild(el("p", "pop-city", r.city + ", " + r.st));
    if (r.live || r.time) box.appendChild(el("p", "pop-line", (state.after ? "" : (CFG.eventShort || "Sat, Sept 19") + " · ") + (r.time || "time on Eventbrite")));
    if (r.venue || r.address) { var l = el("p", "pop-line"); if (r.venue) l.appendChild(el("strong", "", r.venue)); if (r.venue && r.address) l.appendChild(document.createTextNode(" · ")); if (r.address) l.appendChild(document.createTextNode(r.address)); box.appendChild(l); }
    else box.appendChild(el("p", "pop-line", r.live ? "Venue on the Eventbrite page" : "Coming soon. Host is confirming the venue."));
    var acts = el("div", "pop-actions");
    if (r.live && !state.after) acts.appendChild(link("btn btn-sm", "Register", r.url, "Register for " + r.city + " on Eventbrite"));
    else if (!r.live && setting("notify_url", CFG.notifyUrl)) acts.appendChild(link("btn btn-outline btn-sm", "Notify me", setting("notify_url", CFG.notifyUrl)));
    if (r.address) acts.appendChild(link("text-link", "Directions", mapsUrl(r)));
    if (acts.firstChild) box.appendChild(acts);
    return box;
  }
  function focusEvent(r, fromList) {
    state.activeId = r.id;
    Array.prototype.forEach.call(document.querySelectorAll(".card"), function (c) { c.classList.toggle("active", c.getAttribute("data-id") === r.id); });
    var card = document.querySelector('.card[data-id="' + r.id.replace(/"/g, "") + '"]');
    if (card && !fromList) { var sc = $("list-scroll"); sc.scrollTop = Math.max(0, card.offsetTop - sc.offsetTop - 8); }
    if (!mapReady || r.lat === null || r.lng === null) return;
    if (fromList) map.easeTo({ center: [r.lng, r.lat], zoom: Math.max(map.getZoom(), 10), duration: reduceMotion ? 0 : 600 });
    if (popup) popup.remove();
    popup = new maplibregl.Popup({ offset: 12, closeButton: true, maxWidth: "300px" }).setLngLat([r.lng, r.lat]).setDOMContent(popupFor(r));
    var open = function () { popup.addTo(map); paintActiveMarker(); };
    if (fromList) map.once("moveend", open); else open();
  }
  function showOnMap(rows, opts) {
    if (!mapReady) return;
    if (popup) popup.remove();
    var b = boundsOf(rows);
    if (!b) return;
    map.fitBounds(b, { padding: (opts && opts.padding) || 50, maxZoom: (opts && opts.maxZoom) || 11, duration: reduceMotion ? 0 : 700 });
  }
  function flyToPlace(lat, lng, zoom) {
    if (!mapReady) return;
    if (popup) popup.remove();
    map.easeTo({ center: [lng, lat], zoom: zoom, duration: reduceMotion ? 0 : 700 });
  }

  /* ---------- search ---------- */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    var m = a.length, n = b.length, prev = [], cur, i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) { cur = [i]; for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = cur; }
    return prev[n];
  }
  function parseQuery(q) {
    q = String(q || "").trim().replace(/\s+/g, " ");
    var out = { raw: q, text: q.toLowerCase(), zip: null, st: null, city: null };
    var z = q.match(/^\s*(\d{5})(?:-\d{4})?\s*$/);
    if (z) { out.zip = z[1]; return out; }
    var parts = q.split(/,\s*|\s+(?=[A-Za-z]{2}$)/);
    if (parts.length >= 2) {
      var last = parts[parts.length - 1].trim().toLowerCase();
      var code = STATES[last.toUpperCase()] ? last.toUpperCase() : STATE_BY_NAME[last];
      if (code) { out.st = code; out.city = parts.slice(0, -1).join(" ").trim().toLowerCase(); return out; }
    }
    if (STATES[q.toUpperCase()]) { out.st = q.toUpperCase(); return out; }
    if (STATE_BY_NAME[out.text]) { out.st = STATE_BY_NAME[out.text]; return out; }
    if (out.text.length >= 5) {
      var bestName = null, bestD = 3;
      Object.keys(STATE_BY_NAME).forEach(function (nm) { var d = lev(nm, out.text); if (d < bestD) { bestD = d; bestName = nm; } });
      if (bestName) { out.st = STATE_BY_NAME[bestName]; return out; }
    }
    out.city = out.text;
    return out;
  }
  function lookupCity(name, st) {
    var C = window.US_CITIES || [], n = name.toLowerCase(), best = null, bestD = 3;
    for (var i = 0; i < C.length; i++) {
      var c = C[i];
      if (st && c[1] !== st) continue;
      var cn = c[0].toLowerCase();
      if (cn === n) return { lat: c[2], lng: c[3], label: c[0] + ", " + c[1] };
      if (!best && n.length >= 4 && cn.indexOf(n) === 0) best = { lat: c[2], lng: c[3], label: c[0] + ", " + c[1] };
    }
    if (best) return best;
    if (n.length >= 5) {
      for (var k = 0; k < Math.min(C.length, 1500); k++) {
        var cc = C[k];
        if (st && cc[1] !== st) continue;
        var d = lev(cc[0].toLowerCase(), n);
        if (d < bestD) { bestD = d; best = { lat: cc[2], lng: cc[3], label: cc[0] + ", " + cc[1], fuzzy: true }; }
      }
    }
    return best;
  }
  function directMatches(p) {
    return state.rows.filter(function (r) {
      if (r.paused) return false;
      if (p.zip) return r.address.indexOf(p.zip) >= 0;
      if (p.st && !p.city) return r.st === p.st;
      var hay = [r.city, r.base, r.st, r.stateName, r.venue, r.address, r.host].join(" ").toLowerCase();
      var needle = p.city || p.text;
      if (p.st && r.st !== p.st) return false;
      if (hay.indexOf(needle) >= 0) return true;
      return needle.length >= 4 && r.base.split(/\s+/).some(function (w) { return lev(w.toLowerCase(), needle) <= 1; });
    });
  }
  function resolveLocation(p) {
    if (p.zip) { var z = (window.US_ZIP3 || {})[p.zip.slice(0, 3)]; return z ? { lat: z[0], lng: z[1], label: "ZIP " + p.zip } : null; }
    if (p.city) { var hit = lookupCity(p.city, p.st); if (hit) return hit; }
    if (p.st) { var c = (window.US_STATE_CENTROIDS || {})[p.st]; return c ? { lat: c[0], lng: c[1], label: STATES[p.st], stateOnly: true } : null; }
    return null;
  }
  function runSearch(q) {
    state.query = String(q || "").trim();
    state.near = null; state.stateSel = null; state.activeId = null;
    if (!state.query) { renderList(); fitHome(false); return; }
    var p = parseQuery(state.query), direct = directMatches(p), loc = resolveLocation(p);
    if (p.st && !p.city && !p.zip && direct.length) {
      state.stateSel = p.st;
      renderList();
      showOnMap(direct, { maxZoom: 9 });
    } else if (loc) {
      state.near = loc; state.near.direct = direct;
      renderList();
      var nearest = state.rows.filter(function (r) { return !r.paused && r.lat !== null; }).map(function (r) { return { r: r, d: miles([loc.lat, loc.lng], [r.lat, r.lng]) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3).map(function (x) { return x.r; });
      var around = nearest.concat([{ lat: loc.lat, lng: loc.lng }]);
      showOnMap(around, { maxZoom: 10, padding: 60 });
    } else if (direct.length) {
      state.near = { direct: direct, label: state.query, textOnly: true };
      renderList();
      showOnMap(direct, { maxZoom: 9 });
    } else {
      state.near = { none: true, label: state.query };
      renderList();
      fitHome(false);
    }
    $("list-scroll").scrollTop = 0;
    updateResetButton();
  }
  function nearMe() {
    if (!navigator.geolocation) { banner("info", "Your browser can't share your location. Type your ZIP code instead."); return; }
    var btn = $("near-me"); btn.disabled = true; btn.textContent = "Finding…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false; btn.textContent = "Near me";
      state.query = ""; $("q").value = ""; state.stateSel = null; state.activeId = null;
      state.near = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location", direct: [] };
      banner(null);
      renderList();
      var loc = state.near;
      var nearest = state.rows.filter(function (r) { return !r.paused && r.lat !== null; }).map(function (r) { return { r: r, d: miles([loc.lat, loc.lng], [r.lat, r.lng]) }; }).sort(function (a, b) { return a.d - b.d; }).slice(0, 3).map(function (x) { return x.r; });
      showOnMap(nearest.concat([{ lat: loc.lat, lng: loc.lng }]), { maxZoom: 10, padding: 60 });
      $("list-scroll").scrollTop = 0;
      updateResetButton();
    }, function () {
      btn.disabled = false; btn.textContent = "Near me";
      banner("info", "Location is off or was denied. Type your ZIP code or city instead.");
    }, { timeout: 8000, maximumAge: 300000 });
  }

  /* ---------- list ---------- */
  function visibleRows() { return state.rows.filter(function (r) { return !r.paused && (!state.stateSel || r.st === state.stateSel); }); }
  function setHead(title, sub, showReset) {
    $("result-title").textContent = title || "";
    $("result-sub").textContent = sub || "";
    $("result-reset").classList.toggle("hidden", !showReset);
  }
  function renderList() {
    var list = $("list");
    clear(list);
    var near = state.near;
    if (near && near.none) {
      setHead("No match for \"" + near.label + "\"", "Try a ZIP code, a city, or a state. Every event is listed below.", true);
      renderGrouped(list, visibleRows());
      return;
    }
    if (near && (typeof near.lat === "number" || near.textOnly)) {
      var rows = visibleRows(), direct = (near.direct || []).slice(), ranked = [], unknown = [];
      if (typeof near.lat === "number") {
        rows.forEach(function (r) {
          if (direct.some(function (d) { return d.id === r.id; })) return;
          if (r.lat === null || r.lng === null) { unknown.push(r); return; }
          ranked.push({ r: r, d: miles([near.lat, near.lng], [r.lat, r.lng]) });
        });
        ranked.sort(function (a, b) { return a.d - b.d; });
        direct.forEach(function (r) { r._d = r.lat !== null ? miles([near.lat, near.lng], [r.lat, r.lng]) : null; });
        direct.sort(function (a, b) { return (a._d === null ? 1e9 : a._d) - (b._d === null ? 1e9 : b._d); });
      }
      var title, sub;
      if (direct.length && typeof near.lat === "number") { title = plural(direct.length, "event", "events") + " in " + near.label; sub = ranked.length ? "Then everything else, closest first." : ""; }
      else if (direct.length) { title = plural(direct.length, "match", "matches") + " for \"" + near.label + "\""; sub = ""; }
      else if (near.stateOnly) { title = "No events in " + near.label + " yet"; sub = "Closest to " + near.label + " first."; }
      else { title = "Closest to " + near.label + (near.fuzzy ? " (closest match to what you typed)" : ""); sub = ranked.length && ranked[0].d > 60 ? "Nothing within an hour's drive yet. Closest first." : "Closest first."; }
      setHead(title, sub, true);
      if (!direct.length && !ranked.length && !unknown.length) { renderEmpty(list); return; }
      direct.forEach(function (r) { list.appendChild(card(r, r._d)); });
      if (ranked.length) { if (direct.length) list.appendChild(el("p", "group-label", "Closest first")); ranked.forEach(function (x) { list.appendChild(card(x.r, x.d)); }); }
      else if (!direct.length && near.textOnly) renderGrouped(list, rows);
      if (unknown.length) { list.appendChild(el("p", "group-label", "Distance not known yet")); unknown.forEach(function (r) { list.appendChild(card(r, null)); }); }
      if (near.stateOnly || (ranked.length && ranked[0].d > 60)) {
        var hostUrl = setting("host_url", CFG.hostUrl);
        if (hostUrl) { var box = el("div", "empty"); box.appendChild(el("b", "", "Nothing close enough?")); box.appendChild(link("", "Bring Feed The City to your town", hostUrl)); list.appendChild(box); }
      }
      return;
    }
    var vis = visibleRows(), live = vis.filter(function (r) { return r.live; }).length, soon = vis.length - live;
    if (state.stateSel) {
      setHead(STATES[state.stateSel] || state.stateSel, plural(vis.length, "event", "events") + (soon ? " · " + soon + " coming soon" : ""), true);
      vis.slice().sort(function (a, b) { return a.city.localeCompare(b.city); }).forEach(function (r) { list.appendChild(card(r, null)); });
    } else {
      setHead("All " + plural(vis.length, "city", "cities"), (live ? live + " open for registration" : "") + (soon ? " · " + soon + " coming soon" : ""), false);
      renderGrouped(list, vis);
    }
  }
  function renderGrouped(list, rows) {
    if (!rows.length) { renderEmpty(list); return; }
    rows = rows.slice().sort(function (a, b) { return a.stateName.localeCompare(b.stateName) || a.city.localeCompare(b.city); });
    var last = null;
    rows.forEach(function (r) {
      if (r.st !== last) { list.appendChild(el("p", "group-label", r.stateName)); last = r.st; }
      list.appendChild(card(r, null));
    });
  }
  function renderEmpty(list) {
    var box = el("div", "empty");
    box.appendChild(el("b", "", "Nothing here yet."));
    box.appendChild(el("span", "", "Search a ZIP code to see the closest events."));
    list.appendChild(box);
  }
  function mapsUrl(r) { return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([r.venue, r.address].filter(Boolean).join(", ")); }
  function card(r, dist) {
    var c = el("article", "card" + (r.live ? "" : " soon") + (state.activeId === r.id ? " active" : ""));
    c.setAttribute("data-id", r.id);
    var top = el("div", "card-top");
    var h = el("h4", "card-city", r.city + ", " + r.st);
    h.setAttribute("role", "button"); h.setAttribute("tabindex", "0"); h.title = "Show on map";
    h.addEventListener("click", function () { focusEvent(r, true); });
    h.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); focusEvent(r, true); } });
    top.appendChild(h);
    if (!r.live) top.appendChild(el("span", "pill pill-soon", "Coming soon"));
    else if (dist !== null && dist !== undefined) top.appendChild(el("span", "pill pill-dist", fmtMiles(dist)));
    else if (r.capacity && r.registered !== null) { var left = r.capacity - r.registered; top.appendChild(left > 0 ? el("span", "pill pill-spots", plural(left, "spot", "spots") + " left") : el("span", "pill pill-full", "Full")); }
    c.appendChild(top);
    if (r.live || r.time) c.appendChild(el("p", "line when", state.after ? (r.time || "") : (CFG.eventShort || "Sat, Sept 19") + (r.time ? " · " + r.time : " · time on Eventbrite")));
    if (r.venue || r.address) { var l = el("p", "line"); if (r.venue) l.appendChild(el("strong", "", r.venue)); if (r.venue && r.address) l.appendChild(document.createTextNode(" · ")); if (r.address) l.appendChild(document.createTextNode(r.address)); c.appendChild(l); }
    else c.appendChild(el("p", "line", r.live ? "Venue on the Eventbrite page" : "Host is confirming the venue and time"));
    var meta = [];
    if (r.host) meta.push("Hosted by " + r.host);
    if (r.registered !== null && r.live) meta.push(plural(r.registered, "volunteer", "volunteers") + " signed up");
    if (meta.length) c.appendChild(el("p", "line", meta.join(" · ")));
    var acts = el("div", "actions");
    if (state.after) { if (r.chapter && CFG.monthlyFinderUrl) acts.appendChild(link("btn btn-outline btn-sm", "Monthly events", CFG.monthlyFinderUrl)); }
    else if (r.live) { acts.appendChild(link("btn btn-sm", "Register", r.url, "Register for " + r.city + ", " + r.st + " on Eventbrite")); if (r.address) acts.appendChild(link("text-link", "Directions", mapsUrl(r), "Directions to " + (r.venue || r.city))); }
    else { var nu = setting("notify_url", CFG.notifyUrl); if (nu) acts.appendChild(link("btn btn-outline btn-sm", "Notify me", nu)); }
    if (acts.firstChild) c.appendChild(acts);
    return c;
  }

  /* ---------- heading ---------- */
  function daysUntil(iso) {
    var parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    var target = new Date(parts[0], parts[1] - 1, parts[2]), now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }
  function renderHead() {
    var visible = state.rows.filter(function (r) { return !r.paused; }), states = {};
    visible.forEach(function (r) { states[r.st] = true; });
    var days = daysUntil(CFG.eventDate);
    state.after = days !== null && days < 0;
    var vol = visible.reduce(function (s, r) { return s + (r.registered || 0); }, 0);
    if (state.after) {
      $("hero-title").textContent = "Thank You";
      $("hero-sub").textContent = setting("thank_you_note", "Feed The Country is done for this year, but hunger isn't. Most of these cities host a Feed The City event every month. Find yours and keep going.");
      $("bring").classList.add("hidden");
    } else {
      $("hero-title").textContent = setting("finder_title", "Find Your Event");
      var when = days === 0 ? "today" : days === 1 ? "tomorrow" : "on " + (CFG.eventLabel || "September 19");
      $("hero-sub").textContent = setting("hero_note", plural(visible.length, "city", "cities") + " in " + plural(Object.keys(states).length, "state", "states") + " are packing meals " + when + (vol > 0 ? ", with " + vol.toLocaleString() + " volunteers signed up so far" : "") + ". Search your ZIP code or explore the map, then register on Eventbrite. All ages are welcome.");
      $("bring-text").textContent = setting("what_to_bring", CFG.whatToBring || "");
      $("bring").classList.toggle("hidden", !$("bring-text").textContent);
    }
  }
  function renderAll(first) {
    try { renderHead(); } catch (e) { if (window.console) console.error(e); }
    try { renderList(); } catch (e) { if (window.console) console.error(e); }
    try { if (first) initMap(); else refreshMapData(); if (first && mapReady) fitHome(true); } catch (e) { if (window.console) console.error(e); }
    var when = state.loadedAt ? state.loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    $("updated").textContent = "Powered by Tango Charities" + (when ? " · Updated " + when : "") + (state.source === "seed" ? " · saved copy" : "");
  }
  function resetAll() {
    state.near = null; state.stateSel = null; state.query = ""; state.activeId = null;
    $("q").value = "";
    renderList();
    fitHome(false);
    $("list-scroll").scrollTop = 0;
  }

  /* ---------- wiring ---------- */
  var debounce;
  $("q").addEventListener("input", function (e) { clearTimeout(debounce); var v = e.target.value; debounce = setTimeout(function () { runSearch(v); }, 260); });
  $("search-form").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(debounce); runSearch($("q").value); });
  $("near-me").addEventListener("click", nearMe);
  $("map-reset").addEventListener("click", resetAll);
  $("result-reset").addEventListener("click", resetAll);
  if (window.self !== window.top) $("fullscreen-link").classList.remove("hidden");

  var initial = (function () { try { return new URLSearchParams(window.location.search).get("q") || ""; } catch (e) { return ""; } })();
  load(false);
  if (initial) { $("q").value = initial; var iv = setInterval(function () { if (state.rows.length && (mapReady || !window.maplibregl)) { clearInterval(iv); runSearch(initial); } }, 250); }
  var refreshMs = Number(CFG.refreshMs) || 600000;
  setInterval(function () { if (!document.hidden && (CFG.csvUrl || CFG.gvizUrl)) load(true); }, refreshMs);
  document.addEventListener("visibilitychange", function () { if (!document.hidden && state.loadedAt && Date.now() - state.loadedAt.getTime() > refreshMs && (CFG.csvUrl || CFG.gvizUrl)) load(true); });
})();
