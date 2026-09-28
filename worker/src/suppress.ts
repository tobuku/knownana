/**
 * Infrastructure / CDN / analytics / ad domains that generate high-volume
 * queries with no parental-monitoring value.  Logging is skipped when the
 * queried domain (or its parent) appears in this set.
 */
export const SUPPRESS_LIST: ReadonlySet<string> = new Set([
  // --- Google infrastructure ---
  "google.com",
  "googleapis.com",
  "gstatic.com",
  "google-analytics.com",
  "googleadservices.com",
  "googlesyndication.com",
  "googletagmanager.com",
  "googletagservices.com",
  "googlevideo.com",
  "gvt1.com",
  "gvt2.com",
  "1e100.net",
  "google.ca",
  "google.co.uk",
  "ggpht.com",
  "android.clients.google.com",
  "clients1.google.com",
  "clients2.google.com",
  "clients3.google.com",
  "clients4.google.com",

  // --- Apple ---
  "apple.com",
  "apple-dns.net",
  "icloud.com",
  "icloud-content.com",
  "mzstatic.com",
  "apple-cloudkit.com",
  "cdn-apple.com",
  "push.apple.com",
  "ls.apple.com",
  "gs-loc.apple.com",

  // --- Cloudflare ---
  "cloudflare.com",
  "cloudflare-dns.com",
  "cloudflareinsights.com",
  "cdnjs.cloudflare.com",

  // --- Amazon / AWS ---
  "amazonaws.com",
  "cloudfront.net",
  "amazon.com",
  "amazontrust.com",
  "amazonwebservices.com",
  "elasticbeanstalk.com",
  "awsstatic.com",
  "media-amazon.com",
  "ssl-images-amazon.com",

  // --- Microsoft / Azure ---
  "microsoft.com",
  "microsoftonline.com",
  "msedge.net",
  "msftconnecttest.com",
  "msftncsi.com",
  "live.com",
  "live.net",
  "office.com",
  "office.net",
  "office365.com",
  "windows.com",
  "windows.net",
  "windowsupdate.com",
  "azure.com",
  "azureedge.net",
  "bing.com",
  "bing.net",
  "skype.com",
  "visualstudio.com",
  "vo.msecnd.net",
  "trafficmanager.net",
  "login.microsoftonline.com",

  // --- Facebook / Meta ---
  "facebook.com",
  "fbcdn.net",
  "fbsbx.com",
  "facebook.net",
  "fb.com",
  "accountkit.com",

  // --- Ad / tracking networks ---
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "moatads.com",
  "scorecardresearch.com",
  "quantserve.com",
  "adsrvr.org",
  "demdex.net",
  "krxd.net",
  "bluekai.com",
  "rubiconproject.com",
  "pubmatic.com",
  "casalemedia.com",
  "openx.net",
  "adnxs.com",
  "criteo.com",
  "criteo.net",
  "outbrain.com",
  "taboola.com",
  "tapad.com",
  "chartbeat.com",
  "chartbeat.net",
  "optimizely.com",
  "newrelic.com",
  "nr-data.net",
  "hotjar.com",
  "hotjar.io",
  "mouseflow.com",
  "segment.io",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "branch.io",
  "app.link",
  "adjust.com",
  "appsflyer.com",
  "kochava.com",
  "mparticle.com",

  // --- CDNs ---
  "akamai.net",
  "akamaiedge.net",
  "akamaihd.net",
  "akamaized.net",
  "edgekey.net",
  "edgesuite.net",
  "fastly.net",
  "fastlylb.net",
  "edgecastcdn.net",
  "stackpathdns.com",
  "stackpathcdn.com",
  "jsdelivr.net",
  "unpkg.com",
  "bootstrapcdn.com",
  "maxcdn.com",
  "netdna-cdn.com",
  "limelight.com",
  "llnwd.net",
  "hwcdn.net",
  "incapdns.net",
  "impervadns.net",
  "sucuri.net",

  // --- DNS / certificate / NTP infrastructure ---
  "root-servers.net",
  "in-addr.arpa",
  "ip6.arpa",
  "letsencrypt.org",
  "digicert.com",
  "verisign.com",
  "pki.goog",
  "ocsp.int-x3.letsencrypt.org",
  "ntp.org",
  "pool.ntp.org",
  "time.windows.com",
  "time.apple.com",
  "time.google.com",

  // --- OS connectivity checks ---
  "captive.apple.com",
  "connectivitycheck.gstatic.com",
  "connectivitycheck.android.com",
  "detectportal.firefox.com",
  "msftconnecttest.com",

  // --- Telemetry / crash reporting ---
  "sentry.io",
  "bugsnag.com",
  "crashlytics.com",
  "firebaseio.com",
  "firebaseinstallations.googleapis.com",
  "firebase.googleapis.com",
  "fcm.googleapis.com",
  "app-measurement.com",

  // --- Common trackers / widgets ---
  "twitter.com",
  "twimg.com",
  "t.co",
  "typekit.net",
  "fontawesome.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "recaptcha.net",
  "hcaptcha.com",
  "gravatar.com",
  "wp.com",
  "s.w.org",

  // --- Miscellaneous infra ---
  "cloudflare-dns.com",
  "quad9.net",
  "opendns.com",
  "dnscrypt.info",
  "edns.ip",
  "use-application-dns.net",
  "arpa",
  "localhost",
  "local",
  "internal",
  "lan",
  "home",
  "gateway",
  "router",

  // --- Akamai / Edgecast alternate domains ---
  "akadns.net",
  "akam.net",
  "edgekey.net",

  // --- Push / notification services ---
  "onesignal.com",
  "pushwoosh.com",
  "urbanairship.com",
  "airship.com",
  "pusher.com",
  "pushover.net",

  // --- Analytics continued ---
  "comscore.com",
  "omtrdc.net",
  "2o7.net",
  "marketo.net",
  "marketo.com",
  "hubspot.com",
  "hsforms.com",
  "pardot.com",
  "eloqua.com",
  "salesloft.com",
  "intercom.io",
  "intercomcdn.com",
  "zendesk.com",
  "zdassets.com",
  "statuspage.io",
  "atlassian.net",
  "atlassian.com",

  // --- Common device / OS update domains ---
  "xboxlive.com",
  "playstation.net",
  "playstation.com",
  "nintendo.net",
  "nianticlabs.com",
]);

/**
 * Returns true if the domain (or any parent zone) is in the suppress list.
 * Example: "foo.bar.gstatic.com" matches "gstatic.com".
 */
export function isSuppressed(domain: string): boolean {
  const lower = domain.toLowerCase();
  if (SUPPRESS_LIST.has(lower)) return true;

  // Walk parent zones: strip one label at a time
  let dot = lower.indexOf(".");
  while (dot !== -1) {
    const parent = lower.slice(dot + 1);
    if (SUPPRESS_LIST.has(parent)) return true;
    dot = lower.indexOf(".", dot + 1);
  }

  return false;
}
