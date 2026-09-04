/**
 * Feed The Country Events — Sheet tools.
 * Bound to the Google Sheet "Feed The Country Events". Adds the "Feed The Country Tools" menu.
 *
 * What it does: keeps the Events tab tidy and readable (column order, widths, colors by Status,
 * checkbox for Paused, hidden technical columns, a "Start Here" tab), computes Status, fills
 * coordinates from the address, stamps Last Updated, and normalizes Eventbrite links.
 * The optional Eventbrite sync lives in Eventbrite.gs.
 *
 * Nothing here deletes rows. The `Paused` column is never renamed.
 */

var CONFIG = {
  SHEET_NAME: 'Events',
  START_SHEET: 'Start Here',
  // Column order Nick sees, left to right. Everything from Latitude onward is hidden.
  HEADERS: ['City', 'State', 'Venue', 'Address', 'Time', 'Host', 'HostType', 'EventbriteURL', 'Status', 'Paused', 'Registered', 'Capacity', 'Notes',
            'Latitude', 'Longitude', 'EventbriteID', 'LastSynced', 'EventID', 'FirstAdded', 'Last Updated'],
  USER_FIELDS: ['City', 'State', 'Venue', 'Address', 'Time', 'Host', 'HostType', 'EventbriteURL', 'Notes'],
  HIDDEN: ['Latitude', 'Longitude', 'EventbriteID', 'LastSynced', 'EventID', 'FirstAdded', 'Last Updated'],
  COMPUTED: ['Status', 'Latitude', 'Longitude', 'EventbriteID', 'LastSynced', 'EventID', 'FirstAdded', 'Last Updated'],
  WIDTHS: { City: 170, State: 62, Venue: 210, Address: 280, Time: 150, Host: 140, HostType: 140, EventbriteURL: 240,
            Status: 118, Paused: 76, Registered: 96, Capacity: 90, Notes: 320, Latitude: 90, Longitude: 90, EventbriteID: 120, LastSynced: 140,
            EventID: 120, FirstAdded: 120, 'Last Updated': 140 },
  SETTINGS_SHEET: 'Settings',
  SETTINGS: [
    ['what_to_bring', 'Enough for 25–30 meals: sliced bread (wheat preferred), pre-packaged deli meat, sliced cheese, yellow mustard, easy-peel tangerines, a large bag of chips, and zip-top sandwich bags. The first 30 minutes are arrival time; packing starts after that. Full details on each event\'s Eventbrite page.', 'One line shown above the city list on the finder.'],
    ['notify_url', '', 'Optional. Leave blank: the finder shows its own email box. Put a link here only if you want "Notify me" to open a form instead.'],
    ['host_url', 'https://www.tangocharities.org/start', 'Shown when someone searches a place with nothing nearby: "Bring Feed The City to your town".'],
    ['hero_note', '', 'Optional. Replaces the sentence under the big title on the finder. Leave blank for the default.'],
    ['thank_you_note', '', 'Optional. The sentence shown after September 19. Leave blank for the default.']
  ],
  HOST_TYPES: ['Monthly chapter', 'One-day host'],
  STATUS: { LIVE: 'Live', SOON: 'Coming soon', HIDDEN: 'Hidden', MISSING: 'Missing info' },
  AFF_CODE: 'oddtdtcreator',
  LIVE_PAGE: 'https://ftc-country-finder.netlify.app',
  COLORS: {
    header: '#003366', headerText: '#FFFFFF', orange: '#FF6500', gold: '#F2A71E',
    live: '#E3F4FB', soon: '#FFF4DC', hidden: '#E9ECEF', missing: '#FCEEEC',
    hiddenText: '#6B7280', missingText: '#8A2A1F', grid: '#D9E0E8'
  }
};

/* ---------------- menu ---------------- */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Feed The Country Tools')
    .addItem('Organize sheet (sort by state, refresh colors)', 'organizeSheet')
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
      .addItem('Rebuild "Start Here" tab', 'buildStartHere')
      .addItem('Install auto-update trigger', 'installEditTrigger'))
    .addToUi();
}

/* ---------------- helpers ---------------- */
function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET_NAME);
  if (!sh) {
    // First run: the tab is still named after the imported file. Adopt it if it is the only real tab.
    var skip = { 'Sync Report': 1 }; skip[CONFIG.START_SHEET] = 1;
    var candidates = ss.getSheets().filter(function (s) { return !skip[s.getName()]; });
    if (candidates.length === 1) { sh = candidates[0]; sh.setName(CONFIG.SHEET_NAME); }
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
function colLetter_(n) {
  var s = '';
  while (n > 0) { var m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); }
  return s;
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
function isPaused_(v) { var s = str_(v).toLowerCase(); return s === 'yes' || s === 'true'; }
function isRealRow_(o) {
  return CONFIG.USER_FIELDS.some(function (f) { return str_(o[f]) !== ''; });
}
function toast_(msg) { SpreadsheetApp.getActiveSpreadsheet().toast(msg, 'Feed The Country Tools', 6); }

/* ---------------- status ---------------- */
function computeStatus_(o) {
  if (!str_(o.City) || !str_(o.State)) return CONFIG.STATUS.MISSING;
  if (isPaused_(o.Paused)) return CONFIG.STATUS.HIDDEN;
  if (str_(o.EventbriteURL)) return CONFIG.STATUS.LIVE;
  return CONFIG.STATUS.SOON;
}
function statusNote_(o, status) {
  if (status === CONFIG.STATUS.MISSING) return 'Needs a City and a two-letter State before it can show.';
  if (status === CONFIG.STATUS.HIDDEN) return 'Paused is ticked. Hidden from the finder. Untick Paused to show it.';
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
    if (str_(cell.getValue()) !== status) cell.setValue(status);
    cell.setNote(statusNote_(o, status));
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
    if (!range || range.getSheet().getName() !== CONFIG.SHEET_NAME) { toast_('Select one or more rows on the Events tab first.'); return; }
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

/* ---------------- setup & formatting ---------------- */
function setupSheet() {
  withLock_(function () {
    var sh = getSheet_();
    ensureHeaders_(sh);
    reorderColumns_(sh);
    var map = headerMap_(sh);
    for (var r = 2; r <= sh.getLastRow(); r++) updateRowStatus_(sh, map, r);
    applyFormatting_(sh, map);
    buildSettings_();
    ensureNotifySheet_();
    ensureComingSoonSheet_();
    buildStartHere_();
    SpreadsheetApp.getActiveSpreadsheet().setActiveSheet(sh);
    toast_('Sheet is set up. Next: Feed The Country Tools > Setup & repair > Install auto-update trigger.');
  });
}
function organizeSheet() {
  withLock_(function () {
    var sh = getSheet_();
    ensureHeaders_(sh);
    var map = headerMap_(sh);
    var last = sh.getLastRow();
    if (last > 2 && map.State && map.City) {
      sh.getRange(2, 1, last - 1, sh.getLastColumn()).sort([{ column: map.State, ascending: true }, { column: map.City, ascending: true }]);
    }
    for (var r = 2; r <= last; r++) updateRowStatus_(sh, map, r);
    applyFormatting_(sh, map);
    toast_('Organized: sorted by state and city, statuses and colors refreshed.');
  });
}
function ensureHeaders_(sh) {
  var map = headerMap_(sh);
  var missing = CONFIG.HEADERS.filter(function (h) { return !map[h]; });
  if (!missing.length) return;
  var col = sh.getLastColumn() || 0;
  missing.forEach(function (h, i) { sh.getRange(1, col + i + 1).setValue(h); });
}
function reorderColumns_(sh) {
  // Walk the wanted order; each header is pulled left into place. Unknown extra columns drift to the right.
  for (var i = 0; i < CONFIG.HEADERS.length; i++) {
    var map = headerMap_(sh);
    var cur = map[CONFIG.HEADERS[i]], target = i + 1;
    if (!cur || cur === target) continue;
    sh.showColumns(cur);
    sh.moveColumns(sh.getRange(1, cur, 1, 1), target);
  }
}
function applyFormatting_(sh, map) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var lastCol = Math.max(sh.getLastColumn(), CONFIG.HEADERS.length);
  var maxRows = Math.max(sh.getMaxRows(), 200);
  if (sh.getMaxRows() < maxRows) sh.insertRowsAfter(sh.getMaxRows(), maxRows - sh.getMaxRows());
  var c = CONFIG.COLORS;

  // Header row: navy, white, bold, tall, frozen. Freeze City so it stays visible when scrolling right.
  var header = sh.getRange(1, 1, 1, lastCol);
  header.setBackground(c.header).setFontColor(c.headerText).setFontWeight('bold').setFontSize(11)
    .setVerticalAlignment('middle').setHorizontalAlignment('left').setWrap(false);
  sh.setRowHeight(1, 36);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(1);

  // Body: readable defaults.
  var body = sh.getRange(2, 1, maxRows - 1, lastCol);
  body.setFontSize(10).setVerticalAlignment('middle').setWrapStrategy(SpreadsheetApp.WrapStrategy.CLIP)
    .setBorder(true, true, true, true, true, true, c.grid, SpreadsheetApp.BorderStyle.SOLID);
  if (map.Notes) sh.getRange(2, map.Notes, maxRows - 1, 1).setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
  if (map.City) sh.getRange(2, map.City, maxRows - 1, 1).setFontWeight('bold');
  if (map.State) sh.getRange(2, map.State, maxRows - 1, 1).setHorizontalAlignment('center');
  if (map.Paused) sh.getRange(2, map.Paused, maxRows - 1, 1).setHorizontalAlignment('center');
  ['LastSynced', 'FirstAdded', 'Last Updated'].forEach(function (h) {
    if (map[h]) sh.getRange(2, map[h], maxRows - 1, 1).setNumberFormat('mmm d, yyyy h:mm am/pm');
  });

  // Widths.
  Object.keys(CONFIG.WIDTHS).forEach(function (h) { if (map[h]) sh.setColumnWidth(map[h], CONFIG.WIDTHS[h]); });

  // Dropdowns and the Paused checkbox (writes Yes / No, so the finder and the sync keep working).
  if (map.HostType) sh.getRange(2, map.HostType, maxRows - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(CONFIG.HOST_TYPES, true).setAllowInvalid(false).setHelpText('Monthly chapter or One-day host').build());
  if (map.Paused) sh.getRange(2, map.Paused, maxRows - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireCheckbox('Yes', 'No').setAllowInvalid(false).setHelpText('Tick to hide this city from the finder').build());
  if (map.State) sh.getRange(2, map.State, maxRows - 1, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireTextLengthBetween(2, 2).setAllowInvalid(true).setHelpText('Two-letter state code, e.g. TX').build());

  // Row colors by Status (whole row), so Nick can scan the sheet at a glance.
  if (map.Status) {
    var S = colLetter_(map.Status);
    var rows = sh.getRange(2, 1, maxRows - 1, lastCol);
    var rules = [
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + S + '2="' + CONFIG.STATUS.LIVE + '"').setBackground(c.live).setRanges([rows]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + S + '2="' + CONFIG.STATUS.SOON + '"').setBackground(c.soon).setRanges([rows]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + S + '2="' + CONFIG.STATUS.HIDDEN + '"').setBackground(c.hidden).setFontColor(c.hiddenText).setRanges([rows]).build(),
      SpreadsheetApp.newConditionalFormatRule().whenFormulaSatisfied('=$' + S + '2="' + CONFIG.STATUS.MISSING + '"').setBackground(c.missing).setFontColor(c.missingText).setRanges([rows]).build()
    ];
    sh.setConditionalFormatRules(rules);
    sh.getRange(2, map.Status, maxRows - 1, 1).setFontWeight('bold');
  }

  // Filter on the header so Nick can filter by State or Status from the column arrows.
  if (!sh.getFilter()) sh.getRange(1, 1, maxRows, lastCol).createFilter();

  protectComputed_(sh, map);
  applyHidden_(sh, map, true);
  sh.setTabColor(c.orange);
}
function protectComputed_(sh, map) {
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) {
    if (/\[FTC\]/.test(p.getDescription())) p.remove();
  });
  var headerP = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), 1)).protect();
  headerP.setDescription('[FTC] Header row: please do not rename columns');
  headerP.setWarningOnly(true);
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

/* ---------------- "Settings" tab (words and links the finder reads) ---------------- */
function buildSettings_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  var c = CONFIG.COLORS;
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SETTINGS_SHEET);
    sh.getRange(1, 1, 1, 3).setValues([['Key', 'Value', 'What it does']]);
  }
  var existing = {};
  var last = sh.getLastRow();
  if (last >= 2) sh.getRange(2, 1, last - 1, 1).getValues().forEach(function (r, i) { if (str_(r[0])) existing[str_(r[0])] = i + 2; });
  CONFIG.SETTINGS.forEach(function (row) {
    if (existing[row[0]]) { sh.getRange(existing[row[0]], 3).setValue(row[2]); return; }
    sh.appendRow(row);
  });
  var rows = Math.max(sh.getLastRow(), 2);
  sh.getRange(1, 1, 1, 3).setBackground(c.header).setFontColor(c.headerText).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 520); sh.setColumnWidth(3, 420);
  sh.getRange(2, 1, rows - 1, 1).setFontWeight('bold').setFontColor('#4C5A6B');
  sh.getRange(2, 2, rows - 1, 2).setWrap(true).setVerticalAlignment('top');
  sh.getRange(2, 3, rows - 1, 1).setFontColor('#4C5A6B').setFontStyle('italic');
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { if (/\[FTC\]/.test(p.getDescription())) p.remove(); });
  var p = sh.getRange(1, 1, rows, 1).protect();
  p.setDescription('[FTC] Setting names: edit the Value column, not this one');
  p.setWarningOnly(true);
  sh.setTabColor(c.gold);
}

/* ---------------- "Start Here" tab ---------------- */
function buildStartHere() { withLock_(function () { buildStartHere_(); toast_('"Start Here" tab rebuilt.'); }); }
function buildStartHere_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var ev = getSheet_();
  var map = headerMap_(ev);
  var S = map.Status ? colLetter_(map.Status) : 'I';
  var sh = ss.getSheetByName(CONFIG.START_SHEET) || ss.insertSheet(CONFIG.START_SHEET, 0);
  sh.clear();
  sh.getConditionalFormatRules().length && sh.clearConditionalFormatRules();
  var c = CONFIG.COLORS;
  var cnt = function (status) { return '=COUNTIF(' + CONFIG.SHEET_NAME + '!$' + S + ':$' + S + ',"' + status + '")'; };
  var rows = [
    ['Feed The Country Events', '', '', ''],
    ['One row per city on the Events tab. The finder on tangocharities.org/country reads this sheet, so you never edit Wix for event changes.', '', '', ''],
    ['', '', '', ''],
    ['Right now', '', '', ''],
    ['Live (Register button)', cnt(CONFIG.STATUS.LIVE), '', ''],
    ['Coming soon (Notify me button)', cnt(CONFIG.STATUS.SOON), '', ''],
    ['Hidden (Paused ticked)', cnt(CONFIG.STATUS.HIDDEN), '', ''],
    ['Missing info (needs City and State)', cnt(CONFIG.STATUS.MISSING), '', ''],
    ['', '', '', ''],
    ['How to', '', '', ''],
    ['Change an event', 'Find the row on the Events tab and edit Venue, Address, Time, Host, or the Eventbrite link. Status updates itself.', '', ''],
    ['Add a city', 'Add a row at the bottom: City, State (two letters), Eventbrite link if there is one, and HostType. The map dot places itself.', '', ''],
    ['Hide a city', 'Tick the Paused box. Untick to bring it back. Rows are never deleted.', '', ''],
    ['Turn "Coming soon" into "Register"', 'Paste the Eventbrite link into EventbriteURL.', '', ''],
    ['Keep it tidy', 'Feed The Country Tools > Organize sheet sorts by state and refreshes the colors.', '', ''],
    ['Change the words on the finder', 'The Settings tab holds the "what to bring" line, the Notify me link, and the after-event message. Edit the Value column.', '', ''],
    ['', '', '', ''],
    ['Colors on the Events tab', '', '', ''],
    ['Live', 'Has an Eventbrite link. Shows with a Register button.', '', ''],
    ['Coming soon', 'No link yet. Shows with a Notify me button.', '', ''],
    ['Hidden', 'Paused is ticked. Not shown on the page.', '', ''],
    ['Missing info', 'Needs a City and a two-letter State.', '', ''],
    ['', '', '', ''],
    ['Links', '', '', ''],
    ['Live finder page', CONFIG.LIVE_PAGE, '', ''],
    ['Feed The Country on Wix', 'https://www.tangocharities.org/country', '', ''],
    ['Monthly Feed The City finder', 'https://www.tangocharities.org/feed-the-city', '', ''],
    ['', '', '', ''],
    ['Changes reach the page within about 10 minutes, or right away when you refresh it. Questions: Deven Rohatgi.', '', '', '']
  ];
  sh.getRange(1, 1, rows.length, 4).setValues(rows);
  sh.setColumnWidth(1, 300); sh.setColumnWidth(2, 640); sh.setColumnWidth(3, 40); sh.setColumnWidth(4, 40);
  sh.getRange(1, 1, rows.length, 2).setVerticalAlignment('middle').setWrap(true).setFontSize(11);
  sh.getRange(1, 1, 1, 4).merge().setBackground(c.header).setFontColor(c.headerText).setFontSize(20).setFontWeight('bold').setVerticalAlignment('middle');
  sh.setRowHeight(1, 52);
  sh.getRange(2, 1, 1, 4).merge().setFontColor('#4C5A6B').setWrap(true);
  sh.setRowHeight(2, 40);
  [4, 10, 18, 24].forEach(function (r) {
    sh.getRange(r, 1, 1, 4).merge().setFontColor(c.orange).setFontWeight('bold').setFontSize(13);
  });
  sh.getRange(5, 1, 4, 1).setFontWeight('bold');
  sh.getRange(5, 2, 4, 1).setFontSize(16).setFontWeight('bold').setFontColor(c.header).setHorizontalAlignment('left');
  sh.getRange(11, 1, 6, 1).setFontWeight('bold');
  sh.getRange(19, 1, 1, 1).setBackground(c.live).setFontWeight('bold');
  sh.getRange(20, 1, 1, 1).setBackground(c.soon).setFontWeight('bold');
  sh.getRange(21, 1, 1, 1).setBackground(c.hidden).setFontColor(c.hiddenText).setFontWeight('bold');
  sh.getRange(22, 1, 1, 1).setBackground(c.missing).setFontColor(c.missingText).setFontWeight('bold');
  sh.getRange(25, 1, 3, 1).setFontWeight('bold');
  sh.getRange(29, 1, 1, 4).merge().setFontColor('#4C5A6B').setFontStyle('italic');
  sh.setHiddenGridlines(true);
  sh.setTabColor(c.header);
  if (sh.getMaxColumns() > 4) sh.deleteColumns(5, sh.getMaxColumns() - 4);
  if (sh.getMaxRows() > rows.length + 2) sh.deleteRows(rows.length + 3, sh.getMaxRows() - rows.length - 2);
  ss.setActiveSheet(sh);
  ss.moveActiveSheet(1);
}

/* ---------------- edit trigger ---------------- */
function installEditTrigger() {
  var exists = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'onEditInstallable'; });
  if (!exists) ScriptApp.newTrigger('onEditInstallable').forSpreadsheet(SpreadsheetApp.getActiveSpreadsheet()).onEdit().create();
  toast_(exists ? 'Auto-update trigger was already installed.' : 'Auto-update trigger installed. Edits now refresh Status and Last Updated automatically.');
}
/* ---------------- "Coming soon" tab: cities Nick lists before they exist on Eventbrite ---------------- */
var COMING_SOON = { SHEET: 'Coming soon', HEADERS: ['City', 'State', 'Note', 'Host', 'Hide', 'Latitude', 'Longitude', 'Status'] };
function ensureComingSoonSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(COMING_SOON.SHEET);
  if (!sh) {
    sh = ss.insertSheet(COMING_SOON.SHEET, 1);
    sh.getRange(1, 1, 1, COMING_SOON.HEADERS.length).setValues([COMING_SOON.HEADERS]);
    sh.getRange(2, 1, 1, 3).setValues([['Tulsa', 'OK', 'Example row. Delete me. Type a city and its two-letter state; the finder shows it as Coming soon.']]);
  }
  var c = CONFIG.COLORS;
  sh.getRange(1, 1, 1, COMING_SOON.HEADERS.length).setBackground(c.header).setFontColor(c.headerText).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 60); sh.setColumnWidth(3, 320); sh.setColumnWidth(4, 150); sh.setColumnWidth(5, 60);
  var maxRows = Math.max(sh.getMaxRows(), 100);
  sh.getRange(2, 5, maxRows - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireCheckbox('Yes', 'No').setAllowInvalid(false).setHelpText('Tick to take this city off the finder').build());
  sh.getRange(2, 2, maxRows - 1, 1).setDataValidation(SpreadsheetApp.newDataValidation().requireTextLengthBetween(2, 2).setAllowInvalid(true).setHelpText('Two-letter state code, e.g. TX').build());
  sh.getRange(1, 1, 1, COMING_SOON.HEADERS.length).setNote('Cities that are not on Eventbrite yet. The finder shows them as "Coming soon". Once the Eventbrite event exists, this row is ignored automatically; delete it whenever.');
  [6, 7, 8].forEach(function (col) { sh.hideColumns(col); });
  sh.getProtections(SpreadsheetApp.ProtectionType.RANGE).forEach(function (p) { if (/\[FTC\]/.test(p.getDescription())) p.remove(); });
  var p = sh.getRange(2, 6, maxRows - 1, 3).protect(); p.setDescription('[FTC] Filled by the tools'); p.setWarningOnly(true);
  sh.setTabColor(c.gold);
  for (var r = 2; r <= sh.getLastRow(); r++) comingSoonRow_(sh, r);
  return sh;
}
function comingSoonRow_(sh, row) {
  var vals = sh.getRange(row, 1, 1, COMING_SOON.HEADERS.length).getValues()[0];
  var city = str_(vals[0]), state = str_(vals[1]).toUpperCase();
  if (!city && !state) return;
  if (state && state !== str_(vals[1])) sh.getRange(row, 2).setValue(state);
  var lat = parseFloat(vals[5]), lng = parseFloat(vals[6]);
  if (city && state && !(isFinite(lat) && isFinite(lng))) {
    try {
      var res = Maps.newGeocoder().setRegion('us').geocode(city.replace(/\s*\(.*?\)\s*/g, '') + ', ' + state);
      if (res && res.status === 'OK' && res.results && res.results.length) {
        var loc = res.results[0].geometry.location;
        sh.getRange(row, 6, 1, 2).setValues([[loc.lat, loc.lng]]);
        lat = loc.lat; lng = loc.lng;
      }
    } catch (err) { /* leave blank; the finder lists the city without a pin */ }
  }
  var status = !city || !state ? 'Needs city and state' : (str_(vals[4]).toLowerCase() === 'yes' ? 'Hidden' : (isFinite(lat) ? 'On the finder' : 'Listed, no pin yet'));
  sh.getRange(row, 8).setValue(status);
}
function onEditInstallable(e) {
  try {
    if (!e || !e.range) return;
    var sh = e.range.getSheet();
    if (sh.getName() === COMING_SOON.SHEET) { if (e.range.getRow() >= 2) comingSoonRow_(sh, e.range.getRow()); return; }
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
