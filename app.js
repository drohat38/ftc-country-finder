/* Feed The Country Event Finder
   Reads the "Events" tab of the Google Sheet (published CSV), draws the US map, renders the list.
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

  var state = { rows: [], filter: "all", query: "", stateSel: null, source: "", loadedAt: null, after: false };
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

  /* ---------- data ---------- */
  function safeUrl(u) {
    u = String(u || "").trim();
    if (!/^https?:\/\//i.test(u)) return "";
    u = u.replace(/^http:\/\/(www\.)?eventbrite\.com/i, "https://www.eventbrite.com");
    if (/eventbrite\.com\/e\//i.test(u) && CFG.affCode) {
      u = u.split("?")[0].split("#")[0] + "?aff=" + encodeURIComponent(CFG.affCode);
    }
    return u;
  }
  function normalize(raw) {
    var get = function (k) { return String(raw[k] === undefined || raw[k] === null ? "" : raw[k]).trim(); };
    var status = get("Status").toLowerCase();
    var pausedRaw = get("Paused").toLowerCase();
    var paused = pausedRaw === "yes" || pausedRaw === "true" || status === "hidden";
    var url = safeUrl(get("EventbriteURL"));
    var city = get("City"), st = get("State").toUpperCase();
    if (!city || !st) return null;
    var lat = parseFloat(get("Latitude")), lng = parseFloat(get("Longitude"));
    var hostType = get("HostType").toLowerCase();
    return {
      id: (city + "|" + st).toLowerCase(),
      city: city, st: st, stateName: STATES[st] || st,
      venue: get("Venue"), address: get("Address"), time: get("Time"), host: get("Host"),
      chapter: hostType.indexOf("monthly") === 0 || hostType === "chapter",
      url: url, live: !!url, paused: paused,
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
      var parsed = window.Papa.parse(text, { header: true, skipEmptyLines: true });
      if (!rowsLookValid(parsed.data)) throw new Error("Sheet columns do not match (need City, State)");
      return parsed.data;
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
          if (!rowsLookValid(rows)) throw new Error("gviz columns do not match");
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

  function load(isRefresh) {
    var attempts = [];
    if (CFG.csvUrl) attempts.push({ name: "sheet", run: function () { return fetchCsv(CFG.csvUrl); } });
    if (CFG.gvizUrl) attempts.push({ name: "sheet", run: function () { return fetchGviz(CFG.gvizUrl); } });
    if (CFG.seedUrl) attempts.push({ name: "seed", run: function () { return fetchCsv(CFG.seedUrl); } });

    var i = 0;
    function next(lastErr) {
      if (i >= attempts.length) {
        if (!isRefresh) showError(lastErr);
        return;
      }
      var a = attempts[i++];
      a.run().then(function (rows) {
        var norm = rows.map(normalize).filter(Boolean);
        if (!norm.length) throw new Error("No events in the data");
        state.rows = norm;
        state.source = a.name;
        state.loadedAt = new Date();
        renderAll();
        if (a.name === "seed" && (CFG.csvUrl || CFG.gvizUrl)) {
          banner("stale", "Showing the last saved list. Live updates from the Sheet could not be reached.", true);
        } else if (!isRefresh) {
          banner(null);
        }
      }).catch(function (err) {
        if (window.console) console.warn("Load via " + a.name + " failed:", err && err.message);
        next(err);
      });
    }
    next();
  }

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
    box.appendChild(el("span", "", "Please refresh the page, or find your city on the Feed The Country Eventbrite page."));
    list.appendChild(box);
    $("count").textContent = "";
    banner("error", "The event list did not load" + (err && err.message ? " (" + err.message + ")" : "") + ".", true);
  }

  /* ---------- map ---------- */
  var MAP = { W: 975, H: 610 };
  function project(lat, lng) {
    // Lower-48 Albers equal-area with d3's albersUsa parameters: rotate 96°, center [-0.6, 38.7],
    // parallels 29.5/45.5, scale 1300, translate [487.5, 305]. Matches us-atlas states-albers-10m.
    if (lat === null || lng === null || lat < 24 || lat > 50 || lng < -125 || lng > -66) return null;
    var d = Math.PI / 180, p1 = 29.5 * d, p2 = 45.5 * d;
    var n = (Math.sin(p1) + Math.sin(p2)) / 2;
    var C = Math.cos(p1) * Math.cos(p1) + 2 * n * Math.sin(p1);
    var r0 = Math.sqrt(C - 2 * n * Math.sin(38.7 * d)) / n;
    function raw(la, lo) {
      var r = Math.sqrt(C - 2 * n * Math.sin(la * d)) / n, th = n * ((lo + 96) * d);
      return [r * Math.sin(th), r0 - r * Math.cos(th)];
    }
    var c = raw(38.7, -96.6), p = raw(lat, lng);
    return [487.5 + 1300 * (p[0] - c[0]), 305 - 1300 * (p[1] - c[1])];
  }

  var mapBuilt = false;
  function buildMap() {
    if (mapBuilt || !window.US_STATES) return;
    var svg = svgEl("svg", { viewBox: "0 0 " + MAP.W + " " + MAP.H, role: "img", "aria-label": "United States map showing Feed The Country cities" });
    var gStates = svgEl("g", { id: "g-states" });
    var codes = Object.keys(window.US_STATES);
    codes.forEach(function (code) {
      var path = svgEl("path", { d: window.US_STATES[code], "data-state": code, "class": "st" });
      path.appendChild(svgEl("title", {})).textContent = STATES[code] || code;
      path.addEventListener("click", function () { onStateClick(code); });
      path.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onStateClick(code); } });
      gStates.appendChild(path);
    });
    svg.appendChild(gStates);
    svg.appendChild(svgEl("g", { id: "g-dots" }));
    var wrap = $("map-wrap");
    clear(wrap);
    wrap.appendChild(svg);
    mapBuilt = true;
  }
  function onStateClick(code) {
    var has = state.rows.some(function (r) { return !r.paused && r.st === code; });
    if (!has) return;
    state.stateSel = state.stateSel === code ? null : code;
    renderList();
    paintMap();
    if (state.stateSel) {
      var target = $("list");
      if (target && target.scrollIntoView) target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }
  function paintMap() {
    if (!mapBuilt) return;
    var counts = {};
    state.rows.forEach(function (r) { if (!r.paused) counts[r.st] = (counts[r.st] || 0) + 1; });
    var paths = document.querySelectorAll("#g-states path");
    Array.prototype.forEach.call(paths, function (p) {
      var code = p.getAttribute("data-state"), n = counts[code] || 0;
      p.setAttribute("class", "st" + (n ? " has" : "") + (state.stateSel === code ? " sel" : "") + (state.stateSel && state.stateSel !== code ? " dim" : ""));
      p.setAttribute("tabindex", n ? "0" : "-1");
      p.setAttribute("role", n ? "button" : "presentation");
      p.setAttribute("aria-pressed", state.stateSel === code ? "true" : "false");
      p.firstChild.textContent = (STATES[code] || code) + (n ? ": " + n + (n === 1 ? " event" : " events") : "");
    });
    var gd = $("g-dots");
    clear(gd);
    state.rows.forEach(function (r) {
      if (r.paused) return;
      var pt = project(r.lat, r.lng);
      if (!pt) return;
      var c = svgEl("circle", { cx: pt[0].toFixed(1), cy: pt[1].toFixed(1), r: 5.5,
        "class": "city-dot " + (r.live ? "dot-live-svg" : "dot-soon-svg") + (state.stateSel && state.stateSel !== r.st ? " dim" : "") });
      c.appendChild(svgEl("title", {})).textContent = r.city + ", " + r.st + (r.live ? "" : " (coming soon)");
      c.addEventListener("click", function () { onStateClick(r.st); });
      gd.appendChild(c);
    });
    $("map-reset").classList.toggle("hidden", !state.stateSel);
    $("map-hint").textContent = state.stateSel ? "Showing " + (STATES[state.stateSel] || state.stateSel) + "." : "Click a state to see its cities.";
  }

  /* ---------- list ---------- */
  function matches(r) {
    if (r.paused) return false;
    if (state.filter === "chapter" && !r.chapter) return false;
    if (state.filter === "oneday" && (r.chapter || !r.live)) return false;
    if (state.filter === "soon" && r.live) return false;
    if (state.stateSel && r.st !== state.stateSel) return false;
    if (state.query) {
      var q = state.query;
      var hay = [r.city, r.st, r.stateName, r.venue, r.address, r.host].join(" ").toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    return true;
  }
  function renderList() {
    var list = $("list");
    clear(list);
    var rows = state.rows.filter(matches).sort(function (a, b) {
      return a.stateName.localeCompare(b.stateName) || a.city.localeCompare(b.city);
    });
    var live = rows.filter(function (r) { return r.live; }).length;
    var soon = rows.length - live;
    var countText = rows.length ? rows.length + (rows.length === 1 ? " city" : " cities") + (live ? " · " + live + " open for registration" : "") + (soon ? " · " + soon + " coming soon" : "") : "No cities match.";
    $("count").textContent = countText;

    if (!rows.length) {
      var box = el("div", "empty");
      box.appendChild(el("b", "", "No city matches yet."));
      box.appendChild(el("span", "", "Try a state name, clear the filters, or check back as more hosts confirm."));
      list.appendChild(box);
      return;
    }

    var groups = {};
    rows.forEach(function (r) { (groups[r.st] = groups[r.st] || []).push(r); });
    Object.keys(groups).sort(function (a, b) { return (STATES[a] || a).localeCompare(STATES[b] || b); }).forEach(function (code) {
      var g = groups[code];
      var sec = el("section", "state-group");
      var h = el("h3", "", STATES[code] || code);
      h.appendChild(el("small", "", g.length + (g.length === 1 ? " event" : " events")));
      sec.appendChild(h);
      var cards = el("div", "cards");
      g.forEach(function (r) { cards.appendChild(card(r)); });
      sec.appendChild(cards);
      list.appendChild(sec);
    });
  }
  function card(r) {
    var c = el("article", "card" + (r.live ? "" : " soon"));
    c.appendChild(el("h4", "card-city", r.city + ", " + r.st));
    if (r.venue || r.address) {
      var l1 = el("p", "card-line");
      if (r.venue) l1.appendChild(el("strong", "", r.venue));
      if (r.venue && r.address) l1.appendChild(document.createTextNode(" · "));
      if (r.address) l1.appendChild(document.createTextNode(r.address));
      c.appendChild(l1);
    } else {
      c.appendChild(el("p", "card-line", r.live ? "Venue and time on the Eventbrite page" : "Host is confirming the venue"));
    }
    if (r.time) c.appendChild(el("p", "card-line", (state.after ? "" : "Sept 19 · ") + r.time));
    if (r.host) c.appendChild(el("p", "card-line", "Hosted by " + r.host));
    var foot = el("div", "card-foot");
    if (r.live) foot.appendChild(el("span", "badge " + (r.chapter ? "badge-chapter" : "badge-oneday"), r.chapter ? "Monthly chapter" : "One-day host"));
    else foot.appendChild(el("span", "badge badge-soon", "Coming soon"));
    if (state.after) {
      if (r.chapter && CFG.monthlyFinderUrl) {
        var a2 = el("a", "btn btn-ghost", "Monthly events");
        a2.href = CFG.monthlyFinderUrl; a2.target = "_blank"; a2.rel = "noopener";
        foot.appendChild(a2);
      }
    } else if (r.live) {
      var a = el("a", "btn", "Register");
      a.href = r.url; a.target = "_blank"; a.rel = "noopener";
      a.setAttribute("aria-label", "Register for " + r.city + ", " + r.st + " on Eventbrite");
      foot.appendChild(a);
    } else if (CFG.notifyUrl) {
      var n = el("a", "btn btn-ghost", "Notify me");
      n.href = CFG.notifyUrl; n.target = "_blank"; n.rel = "noopener";
      foot.appendChild(n);
    }
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
    var days = daysUntil(CFG.eventDate);
    state.after = days !== null && days < 0;
    document.getElementById("finder").classList.toggle("after", state.after);
    if (state.after) {
      $("stat-days").textContent = visible.filter(function (r) { return r.live; }).length;
      $("stat-days-label").textContent = "Events held";
      $("hero-eyebrow").textContent = "Thank you · " + (CFG.eventLabel || "");
      $("hero-title").textContent = "One morning. One nation. Thank you for showing up.";
      $("hero-sub").textContent = "Feed The Country is done for this year, but hunger isn't. Most of these cities host a Feed The City event every month. Find yours and keep going.";
    } else {
      $("stat-days").textContent = days === 0 ? "Today" : days;
      $("stat-days-label").textContent = days === 0 ? "Today" : (days === 1 ? "Day to go" : "Days to go");
      if (days === 0) $("stat-days").textContent = "0";
      $("hero-eyebrow").textContent = CFG.eventLabel || "";
    }
  }

  function renderAll() {
    try { renderHero(); } catch (e) { if (window.console) console.error(e); }
    try { buildMap(); paintMap(); } catch (e) { if (window.console) console.error(e); }
    try { renderList(); } catch (e) { if (window.console) console.error(e); }
    var when = state.loadedAt ? state.loadedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "";
    $("updated").textContent = "Powered by Tango Charities" + (when ? " · Updated " + when : "") + (state.source === "seed" ? " · saved copy" : "");
  }

  /* ---------- wiring ---------- */
  $("q").addEventListener("input", function (e) { state.query = e.target.value.trim().toLowerCase(); renderList(); });
  Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (b) {
    b.addEventListener("click", function () {
      state.filter = b.getAttribute("data-filter");
      Array.prototype.forEach.call(document.querySelectorAll(".chip"), function (x) { x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      renderList();
    });
  });
  $("map-reset").addEventListener("click", function () { state.stateSel = null; renderList(); paintMap(); });
  if (window.self !== window.top) $("fullscreen-link").classList.remove("hidden");

  load(false);
  var refreshMs = Number(CFG.refreshMs) || 600000;
  setInterval(function () { if (!document.hidden && (CFG.csvUrl || CFG.gvizUrl)) load(true); }, refreshMs);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden && state.loadedAt && Date.now() - state.loadedAt.getTime() > refreshMs && (CFG.csvUrl || CFG.gvizUrl)) load(true);
  });
})();
