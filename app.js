/* Feed The Country Event Finder
   Reads the "Events" (and optional "Settings") tabs of the Google Sheet, draws the US map with clustered
   bubbles and a zoomed inset, and renders the list. Search resolves ZIP codes, any US city, states, and
   "near me" to a location and ranks events by distance, so a search never dead-ends.
   Rules: remote values reach the DOM through textContent only. No frameworks. */
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

  var state = {
    rows: [], settings: {}, filter: "all", query: "", stateSel: null, groupSel: null, near: null,
    source: "", loadedAt: null, after: false, clusters: []
  };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- tiny DOM helpers (textContent only) ---------- */
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined && text !== null) n.textContent = String(text);
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS("http://www.w3.org/2000/svg", tag);
    for (var k in attrs) if (Object.prototype.hasOwnProperty.call(attrs, k)) n.setAttribute(k, attrs[k]);
    return n;
  }
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
  function plural(n, one, many) { return n + " " + (n === 1 ? one : many); }

  /* ---------- data ---------- */
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!/^https?:\/\//i.test(u)) return "";
    u = u.replace(/^http:\/\/(www\.)?eventbrite\.com/i, "https://www.eventbrite.com");
    if (/eventbrite\.com\/e\//i.test(u) && CFG.affCode) u = u.split("?")[0].split("#")[0] + "?aff=" + encodeURIComponent(CFG.affCode);
    return u;
  }
  function tidyTime(t) {
    return String(t || "").trim().replace(/\s*-\s*/g, " – ").replace(/\s+/g, " ");
  }
  function normalize(raw) {
    var get = function (k) { return String(raw[k] === undefined || raw[k] === null ? "" : raw[k]).trim(); };
    var status = get("Status").toLowerCase();
    var pausedRaw = get("Paused").toLowerCase();
    var paused = pausedRaw === "yes" || pausedRaw === "true" || status === "hidden";
    var url = safeUrl(get("EventbriteURL"));
    var city = get("City").replace(/\s+/g, " "), st = get("State").toUpperCase();
    if (!city || !st) return null;
    var lat = parseFloat(get("Latitude")), lng = parseFloat(get("Longitude"));
    var hostType = get("HostType").toLowerCase();
    var registered = parseInt(get("Registered"), 10), capacity = parseInt(get("Capacity"), 10);
    return {
      id: (city + "|" + st).toLowerCase(),
      city: city, st: st, stateName: STATES[st] || st, base: city.replace(/\s*\(.*?\)\s*/g, "").trim(),
      venue: get("Venue"), address: get("Address"), time: tidyTime(get("Time")), host: get("Host"),
      chapter: hostType.indexOf("monthly") === 0 || hostType === "chapter",
      hostKnown: !!hostType,
      url: url, live: !!url, paused: paused,
      registered: isFinite(registered) && registered > 0 ? registered : null,
      capacity: isFinite(capacity) && capacity > 0 ? capacity : null,
      lat: isFinite(lat) ? lat : null, lng: isFinite(lng) ? lng : null
    };
  }
  function rowsLookValid(rows) {
    if (!rows || !rows.length) return false;
    var first = rows[0];
    return ["City", "State"].every(function (k) { return Object.prototype.hasOwnProperty.call(first, k); });
  }
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
          var rows = resp.table.rows.map(function (r) {
            var o = {};
            cols.forEach(function (c, i) { var cell = r.c[i]; o[c] = cell && cell.v !== null && cell.v !== undefined ? cell.v : ""; });
            return o;
          });
          resolve(rows);
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
      rows.forEach(function (r) {
        var k = String(r.Key || r.key || "").trim().toLowerCase(), v = String(r.Value || r.value || "").trim();
        if (k) out[k] = v;
      });
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
          state.rows = norm; state.settings = settings || {}; state.source = a.name; state.loadedAt = new Date();
          renderAll();
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
    if (retry) {
      var btn = el("button", "", "Try again");
      btn.type = "button";
      btn.addEventListener("click", function () { load(false); });
      b.appendChild(btn);
    }
  }
  function showError(err) {
    var list = $("list");
    clear(list);
    var box = el("div", "empty");
    box.appendChild(el("b", "", "We couldn't load the event list."));
    box.appendChild(el("span", "", "Please refresh the page, or search \"Feed The Country\" on Eventbrite."));
    list.appendChild(box);
    $("count").textContent = "";
    banner("error", "The event list did not load" + (err && err.message ? " (" + err.message + ")" : "") + ".", true);
  }

  /* ---------- geography ---------- */
  function project(lat, lng) {
    // Lower-48 Albers equal-area with d3's albersUsa parameters. Matches us-atlas states-albers-10m (975x610).
    if (lat === null || lng === null || lat < 24 || lat > 50 || lng < -125 || lng > -66) return null;
    var d = Math.PI / 180, p1 = 29.5 * d, p2 = 45.5 * d;
    var n = (Math.sin(p1) + Math.sin(p2)) / 2;
    var C = Math.cos(p1) * Math.cos(p1) + 2 * n * Math.sin(p1);
    var r0 = Math.sqrt(C - 2 * n * Math.sin(38.7 * d)) / n;
    function raw(la, lo) { var r = Math.sqrt(C - 2 * n * Math.sin(la * d)) / n, th = n * ((lo + 96) * d); return [r * Math.sin(th), r0 - r * Math.cos(th)]; }
    var c = raw(38.7, -96.6), p = raw(lat, lng);
    return [487.5 + 1300 * (p[0] - c[0]), 305 - 1300 * (p[1] - c[1])];
  }
  function miles(a, b) {
    var d = Math.PI / 180, R = 3958.8;
    var dLat = (b[0] - a[0]) * d, dLng = (b[1] - a[1]) * d;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(a[0] * d) * Math.cos(b[0] * d) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
  }
  function fmtMiles(m) { return m < 1 ? "under 1 mi" : (m < 10 ? m.toFixed(1) : Math.round(m)) + " mi"; }
  function cityRank(name, st) {
    var C = window.US_CITIES || [], n = name.toLowerCase();
    for (var i = 0; i < C.length; i++) if (C[i][1] === st && C[i][0].toLowerCase() === n) return i;
    return 1e9;
  }
  function groupName(rows) {
    var cities = {};
    rows.forEach(function (r) { cities[r.base + "|" + r.st] = r; });
    var list = Object.keys(cities).map(function (k) { return cities[k]; });
    var hasDallas = list.some(function (r) { return r.st === "TX" && /^(dallas|fort worth)$/i.test(r.base); });
    if (hasDallas && list.length >= 3) return "Dallas–Fort Worth area";
    list.sort(function (a, b) { return cityRank(a.base, a.st) - cityRank(b.base, b.st); });
    return list.length > 1 ? "Around " + list[0].base + ", " + list[0].st : list[0].base + ", " + list[0].st;
  }

  /* ---------- clustering ---------- */
  var CLUSTER_RADIUS = 20; // viewBox units, about 60 miles at this scale
  function buildClusters(rows) {
    var pts = [];
    rows.forEach(function (r) {
      if (r.paused) return;
      var p = project(r.lat, r.lng);
      if (p) pts.push({ r: r, x: p[0], y: p[1] });
    });
    // Greedy: densest first so the DFW blob becomes one bubble.
    pts.forEach(function (p) { p.n = pts.filter(function (q) { return Math.hypot(p.x - q.x, p.y - q.y) <= CLUSTER_RADIUS; }).length; });
    pts.sort(function (a, b) { return b.n - a.n; });
    var used = {}, clusters = [];
    pts.forEach(function (p) {
      if (used[p.r.id]) return;
      var members = pts.filter(function (q) { return !used[q.r.id] && Math.hypot(p.x - q.x, p.y - q.y) <= CLUSTER_RADIUS; });
      members.forEach(function (q) { used[q.r.id] = true; });
      var cx = members.reduce(function (s, q) { return s + q.x; }, 0) / members.length;
      var cy = members.reduce(function (s, q) { return s + q.y; }, 0) / members.length;
      clusters.push({ id: "c" + clusters.length, x: cx, y: cy, rows: members.map(function (q) { return q.r; }) });
    });
    clusters.forEach(function (c) { c.name = c.rows.length > 1 ? groupName(c.rows) : c.rows[0].city + ", " + c.rows[0].st; c.live = c.rows.filter(function (r) { return r.live; }).length; });
    return clusters;
  }

  /* ---------- main map ---------- */
  var MAP = { W: 975, H: 610 }, mapBuilt = false;
  function buildMap() {
    if (mapBuilt || !window.US_STATES) return;
    var svg = svgEl("svg", { viewBox: "0 0 " + MAP.W + " " + MAP.H, role: "img", "aria-label": "United States map showing Feed The Country cities" });
    var gStates = svgEl("g", { id: "g-states" });
    Object.keys(window.US_STATES).forEach(function (code) {
      var path = svgEl("path", { d: window.US_STATES[code], "data-state": code, "class": "st" });
      path.appendChild(svgEl("title", {})).textContent = STATES[code] || code;
      path.addEventListener("click", function () { selectState(code); });
      path.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectState(code); } });
      gStates.appendChild(path);
    });
    svg.appendChild(gStates);
    svg.appendChild(svgEl("g", { id: "g-pins" }));
    svg.appendChild(svgEl("g", { id: "g-markers" }));
    svg.addEventListener("mouseleave", hideTip);
    var wrap = $("map-wrap");
    clear(wrap);
    wrap.appendChild(svg);
    mapBuilt = true;
  }
  function selectState(code) {
    var has = state.rows.some(function (r) { return !r.paused && r.st === code; });
    if (!has) return;
    state.groupSel = null;
    state.stateSel = state.stateSel === code ? null : code;
    afterMapSelect();
  }
  function selectGroup(cluster) {
    state.stateSel = null;
    state.groupSel = state.groupSel && state.groupSel.id === cluster.id ? null : cluster;
    afterMapSelect();
  }
  function afterMapSelect() {
    renderList();
    paintMap();
    paintInset();
    if (state.stateSel || state.groupSel) {
      var target = $("result-head").classList.contains("hidden") ? $("list") : $("result-head");
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function tipFor(rows) {
    var tip = $("map-tip");
    clear(tip);
    if (rows.length === 1) {
      var r = rows[0];
      tip.appendChild(el("b", "", r.city + ", " + r.st));
      tip.appendChild(document.createTextNode(r.live ? (r.venue ? r.venue + (r.time ? " · " + r.time : "") : "Registration open") : "Coming soon"));
    } else {
      tip.appendChild(el("b", "", groupName(rows)));
      var live = rows.filter(function (x) { return x.live; }).length;
      tip.appendChild(document.createTextNode(plural(rows.length, "event", "events") + (live < rows.length ? " · " + (rows.length - live) + " coming soon" : "") + " · click to list"));
    }
    tip.classList.remove("hidden");
  }
  function moveTip(evt) {
    var main = $("map-wrap").getBoundingClientRect();
    var tip = $("map-tip");
    var x = evt.clientX - main.left + 14, y = evt.clientY - main.top + 14;
    if (x + 270 > main.width) x = Math.max(0, evt.clientX - main.left - 270);
    tip.style.left = x + "px"; tip.style.top = y + "px";
  }
  function hideTip() { $("map-tip").classList.add("hidden"); }
  function bubbleRadius(n) { return Math.min(30, 9 + 2.6 * Math.sqrt(n)); }
  function inSelection(r) {
    if (state.stateSel) return r.st === state.stateSel;
    if (state.groupSel) return state.groupSel.rows.some(function (x) { return x.id === r.id; });
    return true;
  }
  function paintMap() {
    if (!mapBuilt) return;
    var counts = {};
    state.rows.forEach(function (r) { if (!r.paused) counts[r.st] = (counts[r.st] || 0) + 1; });
    Array.prototype.forEach.call(document.querySelectorAll("#g-states path"), function (p) {
      var code = p.getAttribute("data-state"), n = counts[code] || 0;
      var tier = n >= 10 ? " h3" : n >= 3 ? " h2" : "";
      p.setAttribute("class", "st" + (n ? " has" + tier : "") + (state.stateSel === code ? " sel" : "") + ((state.stateSel && state.stateSel !== code) || (state.groupSel && !state.groupSel.rows.some(function (r) { return r.st === code; })) ? " dim" : ""));
      p.setAttribute("tabindex", n ? "0" : "-1");
      p.setAttribute("role", n ? "button" : "presentation");
      p.setAttribute("aria-pressed", state.stateSel === code ? "true" : "false");
      p.firstChild.textContent = (STATES[code] || code) + (n ? ": " + plural(n, "event", "events") : "");
    });

    state.clusters = buildClusters(state.rows);
    var gm = $("g-markers");
    clear(gm);
    state.clusters.slice().sort(function (a, b) { return a.rows.length - b.rows.length; }).forEach(function (c) {
      var g, selected = state.groupSel && state.groupSel.id === c.id;
      var dim = (state.stateSel && !c.rows.some(function (r) { return r.st === state.stateSel; })) || (state.groupSel && !selected);
      if (c.rows.length === 1) {
        var r = c.rows[0];
        g = svgEl("g", { "class": "marker city-dot " + (r.live ? "live" : "soon") + (dim ? " dim" : "") + (selected ? " sel" : ""), tabindex: "0", role: "button" });
        g.appendChild(svgEl("circle", { cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: 6 }));
        g.appendChild(svgEl("title", {})).textContent = r.city + ", " + r.st + (r.live ? "" : " (coming soon)");
      } else {
        var rad = bubbleRadius(c.rows.length);
        g = svgEl("g", { "class": "marker bubble" + (c.live === 0 ? " soon-only" : "") + (dim ? " dim" : "") + (selected ? " sel" : ""), tabindex: "0", role: "button" });
        if (c.rows.length >= 5) g.appendChild(svgEl("circle", { "class": "ring", cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: rad }));
        g.appendChild(svgEl("circle", { cx: c.x.toFixed(1), cy: c.y.toFixed(1), r: rad }));
        var t = svgEl("text", { x: c.x.toFixed(1), y: c.y.toFixed(1), "font-size": rad >= 20 ? 18 : 13 });
        t.textContent = c.rows.length;
        g.appendChild(t);
        g.appendChild(svgEl("title", {})).textContent = c.name + ": " + plural(c.rows.length, "event", "events");
      }
      g.setAttribute("aria-label", c.name + ": " + plural(c.rows.length, "event", "events"));
      g.addEventListener("click", function () { selectGroup(c); });
      g.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectGroup(c); } });
      g.addEventListener("mouseenter", function () { tipFor(c.rows); });
      g.addEventListener("mousemove", moveTip);
      g.addEventListener("mouseleave", hideTip);
      gm.appendChild(g);
    });

    var gp = $("g-pins");
    clear(gp);
    if (state.near && typeof state.near.lat === "number" && typeof state.near.lng === "number") {
      var p = project(state.near.lat, state.near.lng);
      if (p) {
        var pin = svgEl("g", { "class": "search-pin" });
        pin.appendChild(svgEl("circle", { cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 11 }));
        pin.appendChild(svgEl("circle", { "class": "core", cx: p[0].toFixed(1), cy: p[1].toFixed(1), r: 3.5 }));
        pin.appendChild(svgEl("title", {})).textContent = "Your search: " + state.near.label;
        gp.appendChild(pin);
      }
    }
    $("map-reset").classList.toggle("hidden", !(state.stateSel || state.groupSel));
  }

  /* ---------- inset (busiest cluster, zoomed) ---------- */
  function paintInset() {
    var grid = $("map-grid"), aside = $("map-inset");
    var big = state.clusters.filter(function (c) { return c.rows.length >= 8; }).sort(function (a, b) { return b.rows.length - a.rows.length; })[0];
    if (!big) { aside.classList.add("hidden"); grid.classList.remove("has-inset"); return; }
    aside.classList.remove("hidden"); grid.classList.add("has-inset");
    $("inset-name").textContent = big.name;
    var live = big.rows.filter(function (r) { return r.live; }).length;
    $("inset-count").textContent = plural(big.rows.length, "event", "events") + (live < big.rows.length ? " · " + (big.rows.length - live) + " coming soon" : "");

    var W = 380, H = 330, pad = 26;
    var lats = big.rows.map(function (r) { return r.lat; }), lngs = big.rows.map(function (r) { return r.lng; });
    var minLat = Math.min.apply(null, lats), maxLat = Math.max.apply(null, lats), minLng = Math.min.apply(null, lngs), maxLng = Math.max.apply(null, lngs);
    var midLat = (minLat + maxLat) / 2, kx = Math.cos(midLat * Math.PI / 180);
    var spanX = Math.max((maxLng - minLng) * kx, 0.05), spanY = Math.max(maxLat - minLat, 0.05);
    var scale = Math.min((W - 2 * pad) / spanX, (H - 2 * pad) / spanY);
    var ox = (W - spanX * scale) / 2, oy = (H - spanY * scale) / 2;
    function px(r) { return [ox + (r.lng - minLng) * kx * scale, oy + (maxLat - r.lat) * scale]; }

    var svg = svgEl("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Zoomed map of " + big.name });
    var gridG = svgEl("g", {});
    for (var gx = 0; gx <= W; gx += W / 6) gridG.appendChild(svgEl("line", { "class": "igrid", x1: gx, y1: 0, x2: gx, y2: H }));
    for (var gy = 0; gy <= H; gy += H / 5) gridG.appendChild(svgEl("line", { "class": "igrid", x1: 0, y1: gy, x2: W, y2: gy }));
    svg.appendChild(gridG);
    var approxMiles = Math.round(Math.max(spanX, spanY) * 69);
    var scaleTxt = svgEl("text", { "class": "ilabel", x: W - 6, y: H - 8, "text-anchor": "end", "font-weight": "400", opacity: ".7" });
    scaleTxt.textContent = "about " + approxMiles + " miles across";
    svg.appendChild(scaleTxt);

    // Dots first, then labels with simple collision avoidance.
    var placed = [];
    var items = big.rows.map(function (r) { var p = px(r); return { r: r, x: p[0], y: p[1] }; }).sort(function (a, b) { return a.y - b.y || a.x - b.x; });
    items.forEach(function (it) {
      var g = svgEl("g", { "class": "city-dot " + (it.r.live ? "live" : "soon") + (state.groupSel && state.groupSel.id !== big.id ? " dim" : ""), tabindex: "0", role: "button", "aria-label": it.r.city + ", " + it.r.st });
      g.appendChild(svgEl("circle", { cx: it.x.toFixed(1), cy: it.y.toFixed(1), r: 5 }));
      g.appendChild(svgEl("title", {})).textContent = it.r.city + ", " + it.r.st + (it.r.venue ? " · " + it.r.venue : "");
      g.addEventListener("click", function () { state.stateSel = null; state.groupSel = null; state.query = ""; $("q").value = it.r.city; runSearch(it.r.city); });
      svg.appendChild(g);
    });
    items.forEach(function (it) {
      var label = it.r.city, w = label.length * 6.2 + 4, h = 12;
      var tries = [[it.x + 8, it.y + 4, "start"], [it.x - 8, it.y + 4, "end"], [it.x, it.y - 9, "middle"], [it.x, it.y + 15, "middle"]];
      for (var i = 0; i < tries.length; i++) {
        var tx = tries[i][0], ty = tries[i][1], anchor = tries[i][2];
        var x0 = anchor === "start" ? tx : anchor === "end" ? tx - w : tx - w / 2, y0 = ty - h + 2;
        if (x0 < 0 || x0 + w > W || y0 < 0 || y0 + h > H) continue;
        var hit = placed.some(function (b) { return !(x0 + w < b.x || b.x + b.w < x0 || y0 + h < b.y || b.y + b.h < y0); });
        if (hit) continue;
        var t = svgEl("text", { "class": "ilabel", x: tx.toFixed(1), y: ty.toFixed(1), "text-anchor": anchor });
        t.textContent = label;
        svg.appendChild(t);
        placed.push({ x: x0, y: y0, w: w, h: h });
        break;
      }
    });
    var wrap = $("inset-wrap");
    clear(wrap);
    wrap.appendChild(svg);
  }

  /* ---------- search ---------- */
  function lev(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 99;
    var m = a.length, n = b.length, prev = [], cur = [], i, j;
    for (j = 0; j <= n; j++) prev[j] = j;
    for (i = 1; i <= m; i++) {
      cur = [i];
      for (j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = cur;
    }
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
      // "Tenessee", "Missisippi": forgive a couple of typos in a state name.
      var names = Object.keys(STATE_BY_NAME), bestName = null, bestD = 3;
      names.forEach(function (nm) { var d = lev(nm, out.text); if (d < bestD) { bestD = d; bestName = nm; } });
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
      if (!best && n.length >= 4 && cn.indexOf(n) === 0) best = { lat: c[2], lng: c[3], label: c[0] + ", " + c[1], d: 0.5 };
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
    var t = p.text;
    return state.rows.filter(function (r) {
      if (r.paused) return false;
      if (p.zip) return r.address.indexOf(p.zip) >= 0;
      if (p.st && !p.city) return r.st === p.st;
      var hay = [r.city, r.base, r.st, r.stateName, r.venue, r.address, r.host].join(" ").toLowerCase();
      var needle = p.city || t;
      if (p.st && r.st !== p.st) return false;
      if (hay.indexOf(needle) >= 0) return true;
      return needle.length >= 4 && r.base.split(/\s+/).some(function (w) { return lev(w.toLowerCase(), needle) <= 1; });
    });
  }
  function resolveLocation(p) {
    if (p.zip) {
      var z = (window.US_ZIP3 || {})[p.zip.slice(0, 3)];
      return z ? { lat: z[0], lng: z[1], label: "ZIP " + p.zip } : null;
    }
    if (p.city) {
      var hit = lookupCity(p.city, p.st);
      if (hit) return hit;
    }
    if (p.st) {
      var c = (window.US_STATE_CENTROIDS || {})[p.st];
      return c ? { lat: c[0], lng: c[1], label: STATES[p.st], stateOnly: true } : null;
    }
    return null;
  }
  function runSearch(q) {
    state.query = String(q || "").trim();
    state.near = null;
    state.stateSel = null; state.groupSel = null;
    if (state.query) {
      var p = parseQuery(state.query);
      var direct = directMatches(p);
      var loc = resolveLocation(p);
      if (p.st && !p.city && !p.zip && direct.length) {
        // A state that has events: browse it, grouped, like clicking it on the map.
        state.stateSel = p.st;
      } else if (loc) {
        // ZIP, city, or empty state: rank everything by distance from that place. Never a dead end.
        state.near = loc;
        state.near.direct = direct;
      } else if (direct.length) {
        state.near = { direct: direct, label: state.query, textOnly: true };
      } else {
        state.near = { none: true, label: state.query };
      }
    }
    renderList();
    paintMap();
    paintInset();
  }
  function nearMe() {
    if (!navigator.geolocation) { banner("info", "Your browser can't share your location. Type your ZIP code instead."); return; }
    var btn = $("near-me"); btn.disabled = true; btn.textContent = "Finding…";
    navigator.geolocation.getCurrentPosition(function (pos) {
      btn.disabled = false; btn.textContent = "Near me";
      state.query = ""; $("q").value = ""; state.stateSel = null; state.groupSel = null;
      state.near = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: "your location", direct: [] };
      banner(null);
      renderList(); paintMap(); paintInset();
      var head = $("result-head"); if (head.scrollIntoView) head.scrollIntoView({ behavior: "smooth", block: "start" });
    }, function () {
      btn.disabled = false; btn.textContent = "Near me";
      banner("info", "Location is off or was denied. Type your ZIP code or city instead.");
    }, { timeout: 8000, maximumAge: 300000 });
  }

  /* ---------- list ---------- */
  function chipOk(r) {
    if (state.filter === "chapter" && !r.chapter) return false;
    if (state.filter === "oneday" && (r.chapter || !r.live)) return false;
    if (state.filter === "soon" && r.live) return false;
    return true;
  }
  function visibleRows() { return state.rows.filter(function (r) { return !r.paused && chipOk(r) && inSelection(r); }); }
  function setResultHead(title, sub, show) {
    var h = $("result-head");
    h.classList.toggle("hidden", !show);
    $("result-title").textContent = title || "";
    $("result-sub").textContent = sub || "";
  }
  function renderList() {
    var list = $("list");
    clear(list);
    var rows = visibleRows();
    var near = state.near;

    if (near && near.none) {
      setResultHead("No match for \"" + near.label + "\"", "Try a ZIP code, a city, or a state, or tap Near me. Every event is listed below.", true);
      renderGrouped(list, rows, true);
      return;
    }
    if (near && (near.lat !== undefined || near.textOnly)) {
      var direct = (near.direct || []).filter(function (r) { return chipOk(r); });
      var ranked = [], unknown = [];
      if (near.lat !== undefined) {
        rows.forEach(function (r) {
          if (direct.some(function (d) { return d.id === r.id; })) return;
          if (r.lat === null || r.lng === null) { unknown.push(r); return; }
          ranked.push({ r: r, d: miles([near.lat, near.lng], [r.lat, r.lng]) });
        });
        ranked.sort(function (a, b) { return a.d - b.d; });
        direct.forEach(function (r) { r._d = r.lat !== null ? miles([near.lat, near.lng], [r.lat, r.lng]) : null; });
        direct.sort(function (a, b) { return (a._d === null ? 1e9 : a._d) - (b._d === null ? 1e9 : b._d); });
      }
      var total = direct.length + ranked.length + unknown.length;
      var title, sub;
      if (direct.length && near.lat !== undefined) {
        title = plural(direct.length, "event", "events") + " in " + near.label;
        sub = ranked.length ? "Then everything else, closest first." : "";
      } else if (direct.length) {
        title = plural(direct.length, "match", "matches") + " for \"" + near.label + "\"";
        sub = "";
      } else if (near.stateOnly) {
        title = "No events in " + near.label + " yet";
        sub = "Here is everything, closest to " + near.label + " first.";
      } else {
        title = "Closest to " + near.label + (near.fuzzy ? " (closest match to what you typed)" : "");
        sub = ranked.length && ranked[0].d > 60 ? "Nothing within an hour's drive yet. Here is everything, closest first." : "Distances are as the crow flies.";
      }
      setResultHead(title, sub, true);
      $("count").textContent = plural(total, "city", "cities") + (state.filter !== "all" ? " with this filter" : "");
      if (!total) { renderEmpty(list); return; }

      if (direct.length) {
        var g1 = el("div", "cards flat");
        direct.forEach(function (r) { g1.appendChild(card(r, r._d)); });
        list.appendChild(g1);
      }
      if (ranked.length) {
        if (direct.length) list.appendChild(el("p", "subhead", near.lat !== undefined ? "Closest first" : "Everything else"));
        var g2 = el("div", "cards flat");
        ranked.forEach(function (x) { g2.appendChild(card(x.r, x.d)); });
        list.appendChild(g2);
      } else if (!direct.length && near.textOnly) {
        renderGrouped(list, rows, true);
      }
      if (unknown.length) {
        list.appendChild(el("p", "subhead", "Distance not known yet"));
        var g3 = el("div", "cards flat");
        unknown.forEach(function (r) { g3.appendChild(card(r, null)); });
        list.appendChild(g3);
      }
      if (near.stateOnly || (ranked.length && ranked[0].d > 60)) {
        var hostUrl = setting("host_url", CFG.hostUrl);
        if (hostUrl) {
          var box = el("div", "empty");
          box.appendChild(el("b", "", "Nothing close enough?"));
          var a = el("a", "", "Bring Feed The City to your town");
          a.href = hostUrl; a.target = "_blank"; a.rel = "noopener";
          box.appendChild(a);
          list.appendChild(box);
        }
      }
      return;
    }

    if (state.groupSel) {
      var live = rows.filter(function (r) { return r.live; }).length;
      setResultHead(state.groupSel.name, plural(rows.length, "event", "events") + (live < rows.length ? " · " + (rows.length - live) + " coming soon" : "") + ". Sorted by city.", true);
    } else if (state.stateSel) {
      setResultHead(STATES[state.stateSel] || state.stateSel, plural(rows.length, "event", "events"), true);
    } else {
      setResultHead("", "", false);
    }
    renderGrouped(list, rows, false);
  }
  function renderGrouped(list, rows, keepHead) {
    var live = rows.filter(function (r) { return r.live; }).length, soon = rows.length - live;
    $("count").textContent = rows.length ? plural(rows.length, "city", "cities") + (live ? " · " + live + " open for registration" : "") + (soon ? " · " + soon + " coming soon" : "") : "No cities match this filter.";
    if (!rows.length) { renderEmpty(list); return; }
    rows = rows.slice().sort(function (a, b) { return a.stateName.localeCompare(b.stateName) || a.city.localeCompare(b.city); });
    var groups = {};
    rows.forEach(function (r) { (groups[r.st] = groups[r.st] || []).push(r); });
    Object.keys(groups).sort(function (a, b) { return (STATES[a] || a).localeCompare(STATES[b] || b); }).forEach(function (code) {
      var g = groups[code];
      var sec = el("section", "state-group");
      var h = el("h3", "", STATES[code] || code);
      h.appendChild(el("small", "", plural(g.length, "event", "events")));
      sec.appendChild(h);
      var cards = el("div", "cards");
      g.forEach(function (r) { cards.appendChild(card(r, null)); });
      sec.appendChild(cards);
      list.appendChild(sec);
    });
  }
  function renderEmpty(list) {
    var box = el("div", "empty");
    box.appendChild(el("b", "", "Nothing matches that filter."));
    box.appendChild(el("span", "", "Try \"All\" above, or search a ZIP code to see the closest events."));
    list.appendChild(box);
  }
  function mapsUrl(r) {
    var q = [r.venue, r.address].filter(Boolean).join(", ");
    return "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(q);
  }
  function card(r, dist) {
    var c = el("article", "card" + (r.live ? "" : " soon"));
    var head = el("div", "card-head");
    head.appendChild(el("h4", "card-city", r.city + ", " + r.st));
    if (dist !== null && dist !== undefined) head.appendChild(el("span", "pill pill-dist", fmtMiles(dist)));
    else if (r.live && r.capacity && r.registered !== null) {
      var left = r.capacity - r.registered;
      head.appendChild(left > 0 ? el("span", "pill pill-spots", plural(left, "spot", "spots") + " left") : el("span", "pill pill-full", "Full"));
    }
    c.appendChild(head);

    c.appendChild(el("p", "card-line card-when", state.after ? (r.time || "") : (CFG.eventShort || "Sat, Sept 19") + (r.time ? " · " + r.time : (r.live ? " · time on Eventbrite" : ""))));
    if (r.venue || r.address) {
      var l = el("p", "card-line");
      if (r.venue) l.appendChild(el("strong", "", r.venue));
      if (r.venue && r.address) l.appendChild(document.createTextNode(" · "));
      if (r.address) l.appendChild(document.createTextNode(r.address));
      c.appendChild(l);
    } else {
      c.appendChild(el("p", "card-line", r.live ? "Venue on the Eventbrite page" : "Host is confirming the venue"));
    }
    var meta = [];
    if (r.host) meta.push("Hosted by " + r.host);
    if (r.registered !== null && r.live) meta.push(plural(r.registered, "volunteer", "volunteers") + " signed up");
    if (meta.length) c.appendChild(el("p", "card-meta", meta.join(" · ")));

    var foot = el("div", "card-foot");
    if (!r.live) foot.appendChild(el("span", "badge badge-soon", "Coming soon"));
    else if (r.hostKnown) foot.appendChild(el("span", "badge " + (r.chapter ? "badge-chapter" : "badge-oneday"), r.chapter ? "Monthly chapter" : "One-day host"));
    else foot.appendChild(el("span", "badge badge-oneday", "Sept 19 event"));
    var actions = el("div", "card-actions");
    if (state.after) {
      if (r.chapter && CFG.monthlyFinderUrl) { var m = el("a", "btn btn-ghost btn-sm", "Monthly events"); m.href = CFG.monthlyFinderUrl; m.target = "_blank"; m.rel = "noopener"; actions.appendChild(m); }
    } else if (r.live) {
      if (r.address) { var d = el("a", "btn btn-ghost btn-sm", "Directions"); d.href = mapsUrl(r); d.target = "_blank"; d.rel = "noopener"; d.setAttribute("aria-label", "Directions to " + (r.venue || r.city)); actions.appendChild(d); }
      var a = el("a", "btn btn-sm", "Register"); a.href = r.url; a.target = "_blank"; a.rel = "noopener"; a.setAttribute("aria-label", "Register for " + r.city + ", " + r.st + " on Eventbrite"); actions.appendChild(a);
    } else {
      var nu = setting("notify_url", CFG.notifyUrl);
      if (nu) { var n = el("a", "btn btn-ghost btn-sm", "Notify me"); n.href = nu; n.target = "_blank"; n.rel = "noopener"; actions.appendChild(n); }
    }
    foot.appendChild(actions);
    c.appendChild(foot);
    return c;
  }

  /* ---------- hero ---------- */
  function daysUntil(iso) {
    var parts = String(iso || "").split("-").map(Number);
    if (parts.length !== 3 || parts.some(isNaN)) return null;
    var target = new Date(parts[0], parts[1] - 1, parts[2]);
    var now = new Date(); now.setHours(0, 0, 0, 0);
    return Math.round((target - now) / 86400000);
  }
  function renderHero() {
    var visible = state.rows.filter(function (r) { return !r.paused; });
    var states = {};
    visible.forEach(function (r) { states[r.st] = true; });
    $("stat-cities").textContent = visible.length;
    $("stat-states").textContent = Object.keys(states).length;
    var vol = visible.reduce(function (s, r) { return s + (r.registered || 0); }, 0);
    $("stat-vol-wrap").classList.toggle("hidden", !(vol > 0));
    if (vol > 0) $("stat-vol").textContent = vol.toLocaleString();
    var days = daysUntil(CFG.eventDate);
    state.after = days !== null && days < 0;
    $("finder").classList.toggle("after", state.after);
    if (state.after) {
      $("stat-days").textContent = visible.filter(function (r) { return r.live; }).length;
      $("stat-days-label").textContent = "Events held";
      $("hero-eyebrow").textContent = "Thank you · " + (CFG.eventLabel || "");
      $("hero-title").textContent = "One morning. One nation. Thank you for showing up.";
      $("hero-sub").textContent = setting("thank_you_note", "Feed The Country is done for this year, but hunger isn't. Most of these cities host a Feed The City event every month. Find yours and keep going.");
      $("bring").classList.add("hidden");
    } else {
      $("stat-days").textContent = days === 0 ? "0" : days;
      $("stat-days-label").textContent = days === 0 ? "Today" : (days === 1 ? "Day to go" : "Days to go");
      $("hero-eyebrow").textContent = CFG.eventLabel || "";
      var note = setting("hero_note", "");
      if (note) $("hero-sub").textContent = note;
      $("bring-text").textContent = setting("what_to_bring", CFG.whatToBring || "");
      $("bring").classList.toggle("hidden", !$("bring-text").textContent);
    }
  }

  function renderAll() {
    try { renderHero(); } catch (e) { if (window.console) console.error(e); }
    try { buildMap(); paintMap(); paintInset(); } catch (e) { if (window.console) console.error(e); }
    try { renderList(); } catch (e) { if (window.console) console.error(e); }
    var when = state.loadedAt ? state.loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    $("updated").textContent = "Powered by Tango Charities" + (when ? " · Updated " + when : "") + (state.source === "seed" ? " · saved copy" : "");
  }

  /* ---------- wiring ---------- */
  var debounce;
  $("q").addEventListener("input", function (e) {
    clearTimeout(debounce);
    var v = e.target.value;
    debounce = setTimeout(function () { runSearch(v); }, 220);
  });
  $("search-form").addEventListener("submit", function (e) { e.preventDefault(); clearTimeout(debounce); runSearch($("q").value); var h = $("result-head"); if (!h.classList.contains("hidden") && h.scrollIntoView) h.scrollIntoView({ behavior: "smooth", block: "start" }); });
  $("near-me").addEventListener("click", nearMe);
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (b) {
    b.addEventListener("click", function () {
      state.filter = b.getAttribute("data-filter");
      Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderList();
    });
  });
  function resetAll() { state.stateSel = null; state.groupSel = null; state.near = null; state.query = ""; $("q").value = ""; renderList(); paintMap(); paintInset(); }
  $("map-reset").addEventListener("click", resetAll);
  $("result-reset").addEventListener("click", resetAll);
  if (window.self !== window.top) $("fullscreen-link").classList.remove("hidden");

  var initial = (function () { try { var u = new URLSearchParams(window.location.search); return u.get("q") || ""; } catch (e) { return ""; } })();
  load(false);
  if (initial) { $("q").value = initial; var iv = setInterval(function () { if (state.rows.length) { clearInterval(iv); runSearch(initial); } }, 200); }
  var refreshMs = Number(CFG.refreshMs) || 600000;
  setInterval(function () { if (!document.hidden && (CFG.csvUrl || CFG.gvizUrl)) load(true); }, refreshMs);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state.loadedAt && Date.now() - state.loadedAt.getTime() > refreshMs && (CFG.csvUrl || CFG.gvizUrl)) load(true);
  });
})();
