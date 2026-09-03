// Feed The Country Event Finder — environment values.
// This is the ONLY file that changes between environments. Everything else reads from here.
window.FTC_COUNTRY_CONFIG = {
  // The Google Sheet "Feed The Country Events" (Deven's Drive > Feed The Country Finder).
  // Sheet id 18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4, first tab (gid=0) = Events.
  // All three URLs work as soon as the Sheet is shared as "Anyone with the link: Viewer".
  csvUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?tqx=out:csv&gid=0",

  // Same tab as JSONP, used only if the CSV fetch is blocked (Wix iframe quirks).
  gvizUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?gid=0&tqx=out:json;responseHandler:ftcCountryLoaded",

  // The "Settings" tab (Key / Value). Optional: words and links Nick can change without code.
  settingsUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?tqx=out:csv&sheet=Settings",

  // Snapshot shipped with the site (2026-09-02). Used when Google cannot be reached.
  seedUrl: "seed/events.csv",

  // The one morning everything happens. ISO date, local time.
  eventDate: "2026-09-19",
  eventLabel: "Saturday, September 19, 2026",
  eventShort: "Sat, Sept 19",

  // Defaults for the Settings tab keys (the Sheet wins when a value is present there).
  whatToBring: "Enough for 25–30 meals: sliced bread (wheat preferred), pre-packaged deli meat, sliced cheese, yellow mustard, easy-peel tangerines, a large bag of chips, and zip-top sandwich bags. The first 30 minutes are arrival time; packing starts after that. Full details on each event's Eventbrite page.",
  notifyUrl: "https://www.tangocharities.org/country",
  hostUrl: "https://www.tangocharities.org/start",

  // Basemap style for the real map (MapLibre GL + OpenFreeMap, no API key, no usage cap).
  // Alternatives: https://tiles.openfreemap.org/styles/positron (muted grey) or /styles/bright.
  mapStyle: "https://tiles.openfreemap.org/styles/liberty",

  // Where the page sends people after the event is over.
  monthlyFinderUrl: "https://www.tangocharities.org/feed-the-city",

  // Eventbrite attribution code added to every Register link so reports stay complete.
  affCode: "oddtdtcreator",

  // How often the page silently re-reads the Sheet while open (ms).
  refreshMs: 10 * 60 * 1000
};
