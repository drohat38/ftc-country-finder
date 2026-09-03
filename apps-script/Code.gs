/**
 * Feed The Country Events — Sheet tools.
 * Bound to the Google Sheet "Feed The Country Events". Adds the "Feed The Country Tools" menu.
 *
 * What it does: keeps the Events tab tidy (headers, dropdowns, hidden technical columns),
 * computes Status, fills coordinates from the address, stamps Last Updated, and normalizes
 * Eventbrite links. The optional Eventbrite sync lives in Eventbrite.gs.
 *
 * Nothing here deletes rows. The `Paused` column is never renamed.
 */

var CONFIG = {
  SHEET_NAME: 'Events',
  HEADERS: ['City', 'State', 'Venue', 'Address', 'Time', 'Host', 'HostType', 'EventbriteURL', 'Status', 'Paused',
            'Latitude', 'Longitude', 'EventbriteID', 'LastSynced', 'Notes', 'EventID', 'FirstAdded', 'Last Updated'],
  USER_FIELDS: ['City', 'State', 'Venue', 'Address', 'Time', 'Host', 'HostType', 'EventbriteURL', 'Notes'],
  HIDDEN: ['Latitude', 'Longitude', 'EventbriteID', 'LastSynced', 'EventID', 'FirstAdded', 'Last Updated'],
  COMPUTED: ['Status', 'Latitude', 'Longitude', 'EventbriteID', 'LastSynced', 'EventID', 'FirstAdded', 'Last Updated'],
  HOST_TYPES: ['Monthly chapter', 'One-day host'],
  PAUSED_VALUES: ['No', 'Yes'],
  STATUS: { LIVE: 'Live', SOON: 'Coming soon', HIDDEN: 'Hidden', MISSING: 'Missing info' },
  AFF_CODE: 'oddtdtcreator',
  COLORS: { header: '#003366', headerText: '#FFFFFF', live: '#E3F4FB', soon: '#FFF4DC', hidden: '#E2E7E6', missing: '#FCEEEC' }
};

/* ---------------- menu ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Feed The Country Tools')
    .addItem('Refresh statuses', 'refreshStatuses')
    .addItem('Fill coordinates for selected rows', 'fillCoordinatesSelected')
    .addItem('Fill all missing coordinates', 'fillCoordinatesMissing')
    .addItem('Normalize Eventbrite links', 'normalizeLinks')
    .addSeparator()
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Eventbrite sync')
      .addItem('Set Eventbrite token…', 'setEventbriteToken')
      .addItem('Preview sync (no changes)', 'syncDryRun')
      .addItem('Sync now', 'syncFromEventbrite')
      .addItem('Turn on hourly sync', 'installHourlySync')
      .addItem('Turn off hourly sync', 'removeHourlySync')
      .addItem('Forget Eventbrite token', 'clearEventbriteToken'))
    .addSeparator()
    .addItem('Show technical columns', 'showTechnicalColumns')
    .addItem('Hide technical columns', 'hideTechnicalColumns')
    .addSubMenu(SpreadsheetApp.getUi().createMenu('Setup & repair')
      .addItem('Setup / repair sheet', 'setupSheet')
      .addItem('Install auto-update trigger', 'installEditTrigger'))
    .addToUi();
}

/* ---------------- helpers ---------------- */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    sh = ss.getSheets()[0];
    if (sh.getLastRow() === 0 || sh.getName() === 'Sheet1') sh.setName(CONFIG.SHEET_NAME);
    else throw new Error('No tab named "' + CONFIG.SHEET_NAME + '". Rename the events tab to Events.');
  }
  return sh;
}
function headerMap_(sh) {
  var last = Math.max(sh.getLastColumn(), 1);
  var hdr = sh.getRange(1, 1, 1, last).getValues()[0];
  var map = {};
  hdr.forEach(function (h, i) { if (String(h).trim()) map[String(h).trim()] = i + 1; });
  return map;
}
function withLock_(fn) {
  var lock = LockService.getDocumentLock();
  if (!lock.tryLock(30000)) throw new Error('The sheet is busy with another update. Try again in a few seconds.');
  try { return fn(); } finally { lock.releaseLock(); }
}
function rowObj_(sh, map, row) {
  var vals = sh.getRange(row, 1, 1, sh.getLastColumn()).getValues()[0];
  var o = {};
  Object.keys(map).forEach(function (h) { o[h] = vals[map[h] - 1]; });
  return o;
}
function setCell_(sh, row, map, header, value) {
  if (map[header]) sh.getRange(row, map[header]).setValue(value);
}
function str_(v) { return String(v === null || v === undefined ? '' : v).trim(); }
function isRealRow_(o) {
  return CONFIG.USER_FIELDS.some(function (f) { return str_(o[f]) !== ''; });
}
function toast_(msg) { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Feed The Country Tools', 6); }

/* ---------------- status ---------------- */
function computeStatus_(o) {
  if (!str_(o.City) || !str_(o.State)) return CONFIG.STATUS.MISSING;
  if (str_(o.Paused).toLowerCase() === 'yes') return CONFIG.STATUS.HIDDEN;
  if (str_(o.EventbriteURL)) return CONFIG.STATUS.LIVE;
  return CONFIG.STATUS.SOON;
}
function statusNote_(o, status) {
  if (status === CONFIG.STATUS.MISSING) return 'Needs a City and a two-letter State before it can show.';
  if (status === CONFIG.STATUS.HIDDEN) return 'Paused = Yes. Hidden from the finder. Set Paused to No to show it.';
  if (status === CONFIG.STATUS.SOON) return 'No Eventbrite link yet, so the finder shows "Coming soon" with a Notify me button.';
  var missing = [];
  if (!str_(o.Venue)) missing.push('Venue');
  if (!str_(o.Address)) missing.push('Address');
  if (!str_(o.Time)) missing.push('Time');
  return missing.length ? 'Live. The card will say "Venue and time on the Eventbrite page" until ' + missing.join(', ') + ' are filled.' : 'Live. Shows with a Register button.';
}
function updateRowStatus_(sh, map, row) {
  var o = rowObj_(sh, map, row);
  if (!isRealRow_(o)) return null;
  var status = computeStatus_(o);
  if (map.Status) {
    var cell = sh.getRange(row, map.Status);
    cell.setValue(status);
    cell.setNote(statusNote_(o, status));
    var bg = status === CONFIG.STATUS.LIVE ? CONFIG.COLORS.live : status === CONFIG.STATUS.SOON ? CONFIG.COLORS.soon : status === CONFIG.STATUS.HIDDEN ? CONFIG.COLORS.hidden : CONFIG.COLORS.missing;
    cell.setBackground(bg);
  }
  if (map.EventID && !str_(o.EventID)) setCell_(sh, row, map, 'EventID', Utilities.getUuid());
  if (map.FirstAdded && !str_(o.FirstAdded)) setCell_(sh, row, map, 'FirstAdded', new Date());
  return status;
}
function refreshStatuses() {
  withLock_(function () {
    var sh = getSheet_(), map = headerMap_(sh), n = 0;
    for (var r = 2; r <= sh.getLastRow(); r++) if (updateRowStatus_(sh, map, r)) n++;
    toast_('Statuses refreshed for ' + n + ' rows.');
  });
}

/* ---------------- coordinates ---------------- */
function extractCoordsFromMapsLink_(url) {
  var m = String(url || '').match(/@(-?\d+\.\d+),(-?\d+\.\d+)/) || String(url || '').match(/[?&]q=(-?\d+\.\d+),(-?\d+\.\d+)/);
  return m ? { lat: parseFloat(m[1]), lng: parseFloat(m[2]) } : null;
}
function geocode_(o) {
  var existingLat = parseFloat(o.Latitude), existingLng = parseFloat(o.Longitude);
  if (isFinite(existingLat) && isFinite(existingLng) && existingLat !== 0) return { lat: existingLat, lng: existingLng, how: 'kept' };
  var fromLink = extractCoordsFromMapsLink_(o.Address);
  if (fromLink) return { lat: fromLink.lat, lng: fromLink.lng, how: 'maps link' };
  var query = str_(o.Address) ? str_(o.Address) : str_(o.City).replace(/\s*\(.*?\)\s*/g, '') + ', ' + str_(o.State);
  if (!str_(o.City) && !str_(o.Address)) return null;
  var res = Maps.newGeocoder().setRegion('us').geocode(query);
  if (res && res.status === 'OK' && res.results && res.results.length) {
    var loc = res.results[0].geometry.location;
    return { lat: loc.lat, lng: loc.lng, how: 'geocoded' };
  }
  return null;
}
function fillCoordinatesRow_(sh, map, row, force) {
  var o = rowObj_(sh, map, row);
  if (!isRealRow_(o)) return false;
  if (force) { o.Latitude = ''; o.Longitude = ''; }
  var g = geocode_(o);
  if (!g) return false;
  if (g.how !== 'kept') {
    setCell_(sh, row, map, 'Latitude', g.lat);
    setCell_(sh, row, map, 'Longitude', g.lng);
    setCell_(sh, row, map, 'Last Updated', new Date());
  }
  return g.how !== 'kept';
}
function fillCoordinatesSelected() {
  withLock_(function () {
    var sh = getSheet_(), map = headerMap_(sh);
    var range = sh.getActiveRange();
    if (!range) { toast_('Select one or more rows first.'); return; }
    var n = 0;
    for (var r = range.getRow(); r < range.getRow() + range.getNumRows(); r++) {
      if (r < 2) continue;
      if (fillCoordinatesRow_(sh, map, r, true)) n++;
      updateRowStatus_(sh, map, r);
    }
    toast_('Coordinates filled for ' + n + ' row(s).');
  });
}
function fillCoordinatesMissing() {
  withLock_(function () {
    var sh = getSheet_(), map = headerMap_(sh), n = 0, failed = [];
    for (var r = 2; r <= sh.getLastRow(); r++) {
      var o = rowObj_(sh, map, r);
      if (!isRealRow_(o)) continue;
      if (isFinite(parseFloat(o.Latitude)) && isFinite(parseFloat(o.Longitude))) continue;
      if (fillCoordinatesRow_(sh, map, r, false)) n++; else failed.push(r);
      Utilities.sleep(150);
    }
    toast_('Filled ' + n + ' row(s).' + (failed.length ? ' Could not place rows: ' + failed.join(', ') : ''));
  });
}

/* ---------------- links ---------------- */
function normalizeEventbriteUrl_(u) {
  u = str_(u);
  if (!u) return '';
  if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
  u = u.replace(/^http:\/\//i, 'https://').replace(/^https:\/\/eventbrite\.com/i, 'https://www.eventbrite.com');
  if (/eventbrite\.com\/e\//i.test(u)) u = u.split('?')[0].split('#')[0] + '?aff=' + CONFIG.AFF_CODE;
  return u;
}
function eventbriteIdFromUrl_(u) {
  var m = String(u || '').match(/-(\d{9,})(?:[?#]|$)/);
  return m ? m[1] : '';
}
function normalizeLinks() {
  withLock_(function () {
    var sh = getSheet_(), map = headerMap_(sh), n = 0;
    if (!map.EventbriteURL) return;
    for (var r = 2; r <= sh.getLastRow(); r++) {
      var cell = sh.getRange(r, map.EventbriteURL), cur = str_(cell.getValue()), norm = normalizeEventbriteUrl_(cur);
      if (cur && norm !== cur) { cell.setValue(norm); n++; }
      if (map.EventbriteID && norm && !str_(sh.getRange(r, map.EventbriteID).getValue())) sh.getRange(r, map.EventbriteID).setValue(eventbriteIdFromUrl_(norm));
    }
    toast_('Normalized ' + n + ' link(s).');
  });
}

/* ---------------- setup ---------------- */
function setupSheet() {
  withLock_(function () {
    var sh = getSheet_();
    ensureHeaders_(sh);
    var map = headerMap_(sh);
    var lastRow = Math.max(sh.getLastRow(), 2);
    var maxRows = Math.max(sh.getMaxRows(), 200);

    sh.getRange(1, 1, 1, CONFIG.HEADERS.length)
      .setBackground(CONFIG.COLORS.header).setFontColor(CONFIG.COLORS.headerText).setFontWeight('bold').setWrap(false);
    sh.setFrozenRows(1);

    if (map.HostType) sh.getRange(2, map.HostType, maxRows - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.HOST_TYPES, true).setAllowInvalid(false).setHelpText('Monthly chapter or One-day host').build());
    if (map.Paused) sh.getRange(2, map.Paused, maxRows - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.PAUSED_VALUES, true).setAllowInvalid(false).setHelpText('Yes hides the city from the finder').build());
    if (map.State) sh.getRange(2, map.State, maxRows - 1, 1).setDataValidation(
      SpreadsheetApp.newDataValidation().requireTextLengthBetween(2, 2).setAllowInvalid(true).setHelpText('Two-letter state code, e.g. TX').build());

    protectComputed_(sh, map);
    applyHidden_(sh, map, true);
    for (var r = 2; r <= lastRow; r++) updateRowStatus_(sh, map, r);
    sh.autoResizeColumns(1, Math.min(CONFIG.HEADERS.length, 10));
    toast_('Sheet is set up. Next: Feed The Country Tools > Setup & repair > Install auto-update trigger.');
  });
}
function ensureHeaders_(sh) {
  var map = headerMap_(sh);
  var missing = CONFIG.HEADERS.filter(function (h) { return !map[h]; });
  if (!missing.length) return;
  var col = sh.getLastColumn() || 0;
  missing.forEach(function (h, i) { sh.getRange(1, col + i + 1).setValue(h); });
}
function protectComputed_(sh, map) {
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (/\[FTC\]/.test(p.getDescription())) p.remove();
  });
  CONFIG.COMPUTED.forEach(function (h) {
    if (!map[h]) return;
    var p = sh.getRange(2, map[h], Math.max(sh.getMaxRows() - 1, 1), 1).protect();
    p.setDescription('[FTC] Computed by Feed The Country Tools: ' + h);
    p.setWarningOnly(true);
  });
}
function applyHidden_(sh, map, hide) {
  CONFIG.HIDDEN.forEach(function (h) {
    if (!map[h]) return;
    if (hide) sh.hideColumns(map[h]); else sh.showColumns(map[h]);
  });
}
function showTechnicalColumns() { var sh = getSheet_(); applyHidden_(sh, headerMap_(sh), false); }
function hideTechnicalColumns() { var sh = getSheet_(); applyHidden_(sh, headerMap_(sh), true); }

/* ---------------- edit trigger ---------------- */
function installEditTrigger() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onEditInstallable'; });
  if (!exists) ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  toast_(exists ? 'Auto-update trigger was already installed.' : 'Auto-update trigger installed. Edits now refresh Status and Last Updated automatically.');
}
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() !== CONFIG.SHEET_NAME) return;
    var row = e.range.getRow();
    if (row < 2) return;
    var map = headerMap_(sh);
    var col = e.range.getColumn();
    var header = Object.keys(map).filter(function (h) { return map[h] === col; })[0];
    var lock = LockService.getDocumentLock();
    if (!lock.tryLock(5000)) return;
    try {
      if (header === 'EventbriteURL') {
        var norm = normalizeEventbriteUrl_(e.range.getValue());
        if (norm !== str_(e.range.getValue())) e.range.setValue(norm);
        if (map.EventbriteID && norm) setCell_(sh, row, map, 'EventbriteID', eventbriteIdFromUrl_(norm));
      }
      if (header === 'Address' || header === 'City' || header === 'State') {
        var o = rowObj_(sh, map, row);
        if (header === 'Address' || !isFinite(parseFloat(o.Latitude))) fillCoordinatesRow_(sh, map, row, header === 'Address');
      }
      updateRowStatus_(sh, map, row);
      setCell_(sh, row, map, 'Last Updated', new Date());
    } finally { lock.releaseLock(); }
  } catch (err) {
    console.error('onEditInstallable failed: ' + err);
  }
}
