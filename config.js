// Feed The Country Event Finder — environment values.
// This is the ONLY file that changes between environments. Everything else reads from here.
window.FTC_COUNTRY_CONFIG = {
  // Published-to-web CSV of the "Events" tab in the Google Sheet "Feed The Country Events".
  // Blank until the Sheet is published; the page then falls back to seedUrl.
  csvUrl: "",

  // Same tab as JSONP, used only if the CSV fetch is blocked (Wix iframe quirks).
  // Shape: https://docs.google.com/spreadsheets/d/<SHEET_ID>/gviz/tq?gid=0&tqx=out:json;responseHandler:ftcCountryLoaded
  gvizUrl: "",

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
