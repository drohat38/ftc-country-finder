// Feed The Country Event Finder — environment values.
// This is the ONLY file that changes between environments. Everything else reads from here.
window.FTC_COUNTRY_CONFIG = {
  // The Google Sheet "Feed The Country Events" (Deven's Drive > Feed The Country Finder).
  // Sheet id 18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4, first tab (gid=0) = Events.
  // Both URLs work as soon as the Sheet is shared as "Anyone with the link: Viewer".
  csvUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?tqx=out:csv&gid=0",

  // Same tab as JSONP, used only if the CSV fetch is blocked (Wix iframe quirks).
  gvizUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?gid=0&tqx=out:json;responseHandler:ftcCountryLoaded",

  // Snapshot shipped with the site (2026-09-02). Used when Google cannot be reached.
  seedUrl: "seed/events.csv",

  // The one morning everything happens. ISO date, local time.
  eventDate: "2026-09-19",
  eventLabel: "Saturday, September 19, 2026",

  // Where a volunteer goes when their city says "Coming soon". Nick can point this at a
  // Google Form or the Wix subscribe form; until then it opens the Feed The Country page.
  notifyUrl: "https://www.tangocharities.org/country",

  // Where the page sends people after the event is over.
  monthlyFinderUrl: "https://www.tangocharities.org/feed-the-city",

  // Eventbrite attribution code added to every Register link so reports stay complete.
  affCode: "oddtdtcreator",

  // How often the page silently re-reads the Sheet while open (ms).
  refreshMs: 10 * 60 * 1000
};
