/**
 * Eventbrite → Sheet sync (optional).
 *
 * Pulls every live, upcoming event from the Tango Charities Eventbrite organization whose title
 * starts with "Feed The Country", and fills the matching row's Venue, Address, Time, EventbriteURL,
 * Latitude, Longitude, EventbriteID and LastSynced. New events get a new row. Nothing is ever deleted,
 * and the columns a person owns (Host, HostType, Paused, Notes) are never touched.
 *
 * The private token lives only in the User Properties of the Google account that saved it. Other
 * editors of this Sheet cannot read it, even from the script editor. It never goes in a cell, in the
 * finder page, or in the repo. The sync only ever sends GET requests. The hourly trigger runs as the
 * account that installed it, so that account must be the one that saved the token.
 */

var EB = {
  API: 'https://www.eventbriteapi.com/v3',
  PROP_TOKEN: 'EVENTBRITE_TOKEN',
  PROP_ORG: 'EVENTBRITE_ORG_ID',
  TITLE_PREFIX: /^\s*feed\s+the\s+country\b/i,
  REPORT_SHEET: 'Sync Report',
  PAGE_SIZE: 100
};

/* ---------------- token ---------------- */
function setEventbriteToken() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Eventbrite private token',
    'Paste the Private token from Eventbrite > Account Settings > Developer Links > API Keys.\n\n' +
    'It is stored only in YOUR Google account\'s settings for this script. Other people who edit this Sheet cannot read it. ' +
    'It is used for read-only requests.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var token = String(res.getResponseText() || '').trim();
  if (token.length < 10) { ui.alert('That does not look like a token. Nothing was saved.'); return; }
  var props = props_();
  props.setProperty(EB.PROP_TOKEN, token);
  props.deleteProperty(EB.PROP_ORG);
  try {
    var org = getOrgId_();
    ui.alert('Token saved to your account. Connected to Eventbrite organization ' + org.name + ' (id ' + org.id + ').\n\n' +
      'Only you can run the sync or turn on the hourly sync. Next: Eventbrite sync > Preview sync (no changes).');
  } catch (err) {
    props.deleteProperty(EB.PROP_TOKEN);
    ui.alert('Eventbrite rejected that token, so it was not kept.\n\n' + err.message);
  }
}
function clearEventbriteToken() {
  var props = props_();
  props.deleteProperty(EB.PROP_TOKEN);
  props.deleteProperty(EB.PROP_ORG);
  removeHourlySync();
  toast_('Eventbrite token removed from your account and hourly sync turned off. The finder keeps working from the Sheet.');
}
// User Properties: private to the Google account running the script. Script Properties would be readable by every Sheet editor.
function props_() { return PropertiesService.getUserProperties(); }
function token_() {
  var t = props_().getProperty(EB.PROP_TOKEN);
  if (!t) throw new Error('No Eventbrite token is saved for your Google account. The person who set it up runs the sync, or the hourly sync runs on its own. To use your own token: Feed The Country Tools > Eventbrite sync > Set Eventbrite token.');
  return t;
}

/* ---------------- API ---------------- */
function ebGet_(path, params) {
  var qs = Object.keys(params || {}).map(function (k) { return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]); }).join('&');
  var url = EB.API + path + (qs ? (path.indexOf('?') >= 0 ? '&' : '?') + qs : '');
  var resp = UrlFetchApp.fetch(url, { method: 'get', headers: { Authorization: 'Bearer ' + token_() }, muteHttpExceptions: true });
  var code = resp.getResponseCode();
  var body = resp.getContentText();
  if (code === 401) throw new Error('Eventbrite says the token is not valid (401). Set a new token.');
  if (code === 429) throw new Error('Eventbrite rate limit reached (429). Try again in an hour.');
  if (code < 200 || code >= 300) throw new Error('Eventbrite error ' + code + ' on ' + path + ': ' + body.slice(0, 200));
  return JSON.parse(body);
}
function getOrgId_() {
  var props = props_();
  var cached = props.getProperty(EB.PROP_ORG);
  if (cached) { var parts = cached.split('|'); return { id: parts[0], name: parts.slice(1).join('|') }; }
  var data = ebGet_('/users/me/organizations/', {});
  var orgs = (data && data.organizations) || [];
  if (!orgs.length) throw new Error('This token has no Eventbrite organizations.');
  var org = orgs.filter(function (o) { return /tango/i.test(o.name || ''); })[0] || orgs[0];
  props.setProperty(EB.PROP_ORG, org.id + '|' + (org.name || ''));
  return { id: org.id, name: org.name || '' };
}
function fetchCountryEvents_() {
  var org = getOrgId_();
  var events = [], continuation = null, guard = 0;
  do {
    var params = { status: 'live', time_filter: 'current_future', order_by: 'start_asc', expand: 'venue', page_size: EB.PAGE_SIZE };
    if (continuation) params.continuation = continuation;
    var data = ebGet_('/organizations/' + org.id + '/events/', params);
    (data.events || []).forEach(function (ev) {
      var name = ev.name && ev.name.text ? ev.name.text : '';
      if (EB.TITLE_PREFIX.test(name)) events.push(ev);
    });
    continuation = data.pagination && data.pagination.has_more_items ? data.pagination.continuation : null;
    guard++;
  } while (continuation && guard < 50);
  return events;
}

/* ---------------- mapping ---------------- */
function parseCityFromTitle_(name) {
  // "Feed The Country Dallas (North): A Nationwide Day of Volunteering…" -> "Dallas (North)"
  var m = String(name || '').replace(EB.TITLE_PREFIX, '').trim();
  m = m.split(/[:–—|-]\s/)[0].trim();
  return m.replace(/\s+/g, ' ');
}
function fmtTime_(local) {
  // "2026-09-19T08:30:00" -> "8:30 AM"
  var m = String(local || '').match(/T(\d{2}):(\d{2})/);
  if (!m) return '';
  var h = parseInt(m[1], 10), min = m[2];
  var ampm = h < 12 ? 'AM' : 'PM';
  h = h % 12; if (h === 0) h = 12;
  return h + ':' + min + ' ' + ampm;
}
function eventToRow_(ev) {
  var venue = ev.venue || {};
  var addr = venue.address || {};
  var start = fmtTime_(ev.start && ev.start.local), end = fmtTime_(ev.end && ev.end.local);
  return {
    City: parseCityFromTitle_(ev.name && ev.name.text),
    State: str_(addr.region).toUpperCase(),
    Venue: str_(venue.name),
    Address: str_(addr.localized_address_display) || [addr.address_1, addr.city, addr.region, addr.postal_code].filter(Boolean).join(', '),
    Time: start && end ? start + ' - ' + end : start,
    EventbriteURL: normalizeEventbriteUrl_(ev.url),
    EventbriteID: str_(ev.id),
    Latitude: venue.latitude ? parseFloat(venue.latitude) : '',
    Longitude: venue.longitude ? parseFloat(venue.longitude) : '',
    StartDate: ev.start && ev.start.local ? String(ev.start.local).slice(0, 10) : ''
  };
}
function cityKey_(city, st) {
  return str_(city).toLowerCase().replace(/\s*\(.*?\)\s*/g, ' ').replace(/[^a-z ]/g, '').replace(/\s+/g, ' ').trim() + '|' + str_(st).toUpperCase();
}
function fullKey_(city, st) {
  return str_(city).toLowerCase().replace(/[^a-z() ]/g, '').replace(/\s+/g, ' ').trim() + '|' + str_(st).toUpperCase();
}

/* ---------------- sync ---------------- */
function syncDryRun() { runSync_(true); }
function syncFromEventbrite() { runSync_(false); }

function runSync_(dryRun) {
  return withLock_(function () {
    var sh = getSheet_();
    ensureHeaders_(sh);
    var map = headerMap_(sh);
    var events = fetchCountryEvents_();
    var now = new Date();

    // index existing rows
    var byId = {}, byUrlId = {}, byFull = {}, byCity = {};
    var lastRow = sh.getLastRow();
    for (var r = 2; r <= lastRow; r++) {
      var o = rowObj_(sh, map, r);
      if (!isRealRow_(o)) continue;
      if (str_(o.EventbriteID)) byId[str_(o.EventbriteID)] = r;
      var uid = eventbriteIdFromUrl_(o.EventbriteURL);
      if (uid) byUrlId[uid] = r;
      byFull[fullKey_(o.City, o.State)] = r;
      var ck = cityKey_(o.City, o.State);
      if (!byCity[ck]) byCity[ck] = r; else byCity[ck] = -1; // ambiguous when several rows share a base city
    }

    var updated = [], added = [], unchanged = [], unmatchedAmbiguous = [];
    events.forEach(function (ev) {
      var e = eventToRow_(ev);
      var row = byId[e.EventbriteID] || byUrlId[e.EventbriteID] || byFull[fullKey_(e.City, e.State)] || null;
      if (!row) {
        var ck = cityKey_(e.City, e.State);
        if (byCity[ck] === -1) { unmatchedAmbiguous.push(e.City + ', ' + e.State); return; }
        row = byCity[ck] || null;
      }
      if (row) {
        var cur = rowObj_(sh, map, row);
        var changes = [];
        ['Venue', 'Address', 'Time', 'EventbriteURL', 'EventbriteID'].forEach(function (h) {
          if (e[h] !== '' && str_(cur[h]) !== str_(e[h])) changes.push(h);
        });
        var latDiff = e.Latitude !== '' && Math.abs(parseFloat(cur.Latitude) - e.Latitude) > 0.0005;
        var lngDiff = e.Longitude !== '' && Math.abs(parseFloat(cur.Longitude) - e.Longitude) > 0.0005;
        if (latDiff || lngDiff) changes.push('Coordinates');
        if (!changes.length) { unchanged.push(e.City + ', ' + e.State); return; }
        updated.push(e.City + ', ' + e.State + ' (' + changes.join(', ') + ')');
        if (dryRun) return;
        ['Venue', 'Address', 'Time', 'EventbriteURL', 'EventbriteID'].forEach(function (h) { if (e[h] !== '') setCell_(sh, row, map, h, e[h]); });
        if (e.Latitude !== '') setCell_(sh, row, map, 'Latitude', e.Latitude);
        if (e.Longitude !== '') setCell_(sh, row, map, 'Longitude', e.Longitude);
        setCell_(sh, row, map, 'LastSynced', now);
        setCell_(sh, row, map, 'Last Updated', now);
        updateRowStatus_(sh, map, row);
      } else {
        added.push(e.City + ', ' + e.State);
        if (dryRun) return;
        var newRow = sh.getLastRow() + 1;
        var vals = {
          City: e.City, State: e.State, Venue: e.Venue, Address: e.Address, Time: e.Time,
          HostType: 'One-day host', EventbriteURL: e.EventbriteURL, Paused: 'No',
          Latitude: e.Latitude, Longitude: e.Longitude, EventbriteID: e.EventbriteID,
          LastSynced: now, Notes: 'Added by Eventbrite sync ' + now.toDateString(),
          EventID: Utilities.getUuid(), FirstAdded: now, 'Last Updated': now
        };
        // Write by header name, so the sheet's column order can change without breaking the sync.
        Object.keys(vals).forEach(function (h) { setCell_(sh, newRow, map, h, vals[h]); });
        updateRowStatus_(sh, map, newRow);
      }
    });

    writeReport_(dryRun, now, events.length, updated, added, unchanged, unmatchedAmbiguous);
    var summary = (dryRun ? 'Preview: ' : 'Synced: ') + events.length + ' Feed The Country events on Eventbrite. ' +
      updated.length + ' would update, '.replace(dryRun ? '' : 'would ', '') + added.length + ' new, ' + unchanged.length + ' unchanged' +
      (unmatchedAmbiguous.length ? ', ' + unmatchedAmbiguous.length + ' need a manual match' : '') + '. See the Sync Report tab.';
    toast_(summary);
    return summary;
  });
}
function writeReport_(dryRun, now, total, updated, added, unchanged, ambiguous) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var rep = ss.getSheetByName(EB.REPORT_SHEET) || ss.insertSheet(EB.REPORT_SHEET);
  rep.clear();
  var rows = [
    ['Feed The Country — Eventbrite sync report'],
    ['Run', dryRun ? 'Preview (no changes written)' : 'Sync (changes written)'],
    ['When', now],
    ['Feed The Country events found on Eventbrite', total],
    ['Rows updated' + (dryRun ? ' (would be)' : ''), updated.length],
    ['Rows added' + (dryRun ? ' (would be)' : ''), added.length],
    ['Rows unchanged', unchanged.length],
    ['Need a manual match (several rows share this city)', ambiguous.length],
    [''],
    ['Updated'].concat(updated.length ? [] : ['none'])
  ];
  updated.forEach(function (u) { rows.push(['', u]); });
  rows.push(['Added'].concat(added.length ? [] : ['none']));
  added.forEach(function (a) { rows.push(['', a]); });
  rows.push(['Need a manual match'].concat(ambiguous.length ? [] : ['none']));
  ambiguous.forEach(function (a) { rows.push(['', a + ' — paste the Eventbrite link into the right row and run Sync again']); });
  var width = 2;
  rows = rows.map(function (r) { while (r.length < width) r.push(''); return r.slice(0, width); });
  rep.getRange(1, 1, rows.length, width).setValues(rows);
  rep.getRange(1, 1).setFontWeight('bold').setFontSize(12);
  rep.setColumnWidth(1, 320); rep.setColumnWidth(2, 520);
}

/* ---------------- triggers ---------------- */
function installHourlySync() {
  token_();
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'syncFromEventbrite'; });
  if (!exists) ScriptApp.newTrigger('syncFromEventbrite').timeBased().everyHours(1).create();
  toast_(exists ? 'Hourly sync was already on.' : 'Hourly sync is on. It runs as your account, using your saved token. Eventbrite changes reach the Sheet within an hour.');
}
function removeHourlySync() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'syncFromEventbrite') { ScriptApp.deleteTrigger(t); n++; } });
  toast_(n ? 'Hourly sync turned off.' : 'Hourly sync was not on.');
}
