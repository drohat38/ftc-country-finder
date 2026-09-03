/**
 * "Notify me" signups from the finder.
 *
 * The finder POSTs {email, city, state, source} here (this script deployed as a web app).
 * Each signup is appended to the "Notify me" tab of this Sheet, and, if the Settings tab has a
 * notify_email value, an email is sent to that address for each signup.
 *
 * Deploy: clasp deploy (or Deploy > New deployment > Web app: execute as Me, access Anyone).
 * The deploying account must have authorized the script once (run Setup from the menu).
 */

var NOTIFY = {
  SHEET: 'Notify me',
  HEADERS: ['Timestamp', 'Email', 'City', 'State', 'Source', 'Emailed'],
  MAX_PER_MINUTE: 60
};

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, service: 'Feed The Country notify', method: 'POST JSON {email, city, state}' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var out = { ok: false };
  try {
    var body = {};
    var raw = e && e.postData && e.postData.contents ? e.postData.contents : '';
    try { body = JSON.parse(raw || '{}'); } catch (err) { body = (e && e.parameter) || {}; }
    var email = str_(body.email).toLowerCase();
    var city = str_(body.city).slice(0, 80), state = str_(body.state).toUpperCase().slice(0, 2), source = str_(body.source).slice(0, 120);
    if (str_(body.website)) { out.ok = true; return json_(out); } // honeypot filled: pretend success, store nothing
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { out.error = 'invalid_email'; return json_(out); }
    if (!rateOk_()) { out.error = 'busy'; return json_(out); }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sh = ensureNotifySheet_();
      var map = notifyHeaderMap_(sh);
      var dup = isDuplicate_(sh, map, email, city);
      var emailed = '';
      if (!dup) {
        var to = notifyEmailSetting_();
        if (to) { try { sendNotifyEmail_(to, email, city, state); emailed = 'Yes'; } catch (mailErr) { emailed = 'Failed: ' + mailErr; } }
        sh.appendRow([new Date(), email, city, state, source, emailed]);
      }
      out.ok = true; out.duplicate = dup;
    } finally { lock.releaseLock(); }
  } catch (err) {
    out.error = String(err && err.message || err);
  }
  return json_(out);
}

function json_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

function ensureNotifySheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(NOTIFY.SHEET);
  if (!sh) {
    sh = ss.insertSheet(NOTIFY.SHEET);
    sh.getRange(1, 1, 1, NOTIFY.HEADERS.length).setValues([NOTIFY.HEADERS]);
  }
  var c = CONFIG.COLORS;
  sh.getRange(1, 1, 1, NOTIFY.HEADERS.length).setBackground(c.header).setFontColor(c.headerText).setFontWeight('bold');
  sh.setFrozenRows(1);
  sh.setColumnWidth(1, 170); sh.setColumnWidth(2, 260); sh.setColumnWidth(3, 170); sh.setColumnWidth(4, 60); sh.setColumnWidth(5, 220); sh.setColumnWidth(6, 120);
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).setNumberFormat('MMM d, yyyy h:mm am/pm');
  sh.setTabColor('#39BAE4');
  return sh;
}
function notifyHeaderMap_(sh) {
  var hdr = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0], m = {};
  hdr.forEach(function (h, i) { if (str_(h)) m[str_(h)] = i + 1; });
  return m;
}
function isDuplicate_(sh, map, email, city) {
  var last = sh.getLastRow();
  if (last < 2 || !map.Email) return false;
  var emails = sh.getRange(2, map.Email, last - 1, 1).getValues();
  var cities = map.City ? sh.getRange(2, map.City, last - 1, 1).getValues() : [];
  for (var i = 0; i < emails.length; i++) {
    if (str_(emails[i][0]).toLowerCase() === email && (!cities.length || str_(cities[i][0]).toLowerCase() === city.toLowerCase())) return true;
  }
  return false;
}
function notifyEmailSetting_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(CONFIG.SETTINGS_SHEET);
  if (!sh || sh.getLastRow() < 2) return '';
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  for (var i = 0; i < rows.length; i++) if (str_(rows[i][0]).toLowerCase() === 'notify_email') return str_(rows[i][1]);
  return '';
}
function sendNotifyEmail_(to, email, city, state) {
  var where = [city, state].filter(Boolean).join(', ') || 'a city';
  MailApp.sendEmail({
    to: to,
    subject: 'Feed The Country: someone wants ' + where,
    body: email + ' asked to be notified when the ' + where + ' Feed The Country event opens for registration.\n\n' +
      'All signups: ' + SpreadsheetApp.getActiveSpreadsheet().getUrl() + ' (tab "Notify me")\n\n' +
      'When the event is live on Eventbrite, email the people listed for that city with the Register link.'
  });
}
function rateOk_() {
  // Cheap flood guard: at most NOTIFY.MAX_PER_MINUTE signups per minute across everyone.
  var cache = CacheService.getScriptCache(), key = 'notify_' + Math.floor(Date.now() / 60000);
  var n = parseInt(cache.get(key) || '0', 10) + 1;
  cache.put(key, String(n), 120);
  return n <= NOTIFY.MAX_PER_MINUTE;
}
