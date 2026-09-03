// Feed The Country Event Finder — environment values.
// This is the ONLY file that changes between environments. Everything else reads from here.
window.FTC_COUNTRY_CONFIG = {
  // 1) Primary source: Eventbrite, through the Netlify function in netlify/functions/events.mjs.
  //    The Eventbrite token is a Netlify environment variable (EVENTBRITE_TOKEN); it never reaches the browser.
  apiUrl: "/api/events",

  // 2) Fallback + overrides: the Google Sheet "Feed The Country Events" (Deven's Drive > Feed The Country Finder).
  //    Sheet id 18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4, first tab (gid=0) = Events.
  //    Works as soon as the Sheet is shared as "Anyone with the link: Viewer".
  //    Rows here fill gaps (a city with no Eventbrite event yet shows as Coming soon), add a Host name,
  //    and Paused = Yes hides a city even if Eventbrite still lists it.
  sheetCsvUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?tqx=out:csv&gid=0",
  settingsUrl: "https://docs.google.com/spreadsheets/d/18plECfE3DnjTu_31KXJABJA-I7uTCNqrCv8Ndf8OsT4/gviz/tq?tqx=out:csv&sheet=Settings",

  // 3) Last resort: snapshot shipped with the site (2026-09-02).
  seedUrl: "seed/events.csv",

  // Google Maps JavaScript API key. Same key family as the monthly Feed The City map.
  // The key is referrer-restricted in Google Cloud Console; this site's domain must be on that list:
  //   https://ftc-country-finder.netlify.app/*   (plus localhost for testing)
  // A different key can be passed on the URL as ?k=YOUR_KEY (that overrides this value).
  googleMapsKey: "AIzaSyBh58fDra3R2In7HZXKTOpQhPze1kuNbyg",

  // The one morning everything happens.
  eventDate: "2026-09-19",
  eventLabel: "Saturday, September 19, 2026",

  // Short line shown in each event's details. The Settings tab key what_to_bring overrides it.
  whatToBring: "Bring enough for 25–30 meals: sliced bread, deli meat, sliced cheese, yellow mustard, tangerines, a large bag of chips, and zip-top bags. Full list on Eventbrite.",

  // Where a "Coming soon" city sends people. Settings tab key notify_url overrides it.
  notifyUrl: "https://www.tangocharities.org/country",

  // Where the page sends people after the event is over.
  monthlyFinderUrl: "https://www.tangocharities.org/feed-the-city",

  // Eventbrite attribution code added to every Register link so reports stay complete.
  affCode: "oddtdtcreator",

  // How often the page silently re-reads its data while open (ms).
  refreshMs: 10 * 60 * 1000
};
