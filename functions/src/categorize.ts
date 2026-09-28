import * as admin from "firebase-admin";

export type Category = "RED" | "YELLOW" | "GREEN" | "GRAY";

export interface CategorizeResult {
  category: Category;
  source: string;
}

// In-memory cache for the lifetime of this function instance
const cache = new Map<string, CategorizeResult>();

/**
 * Strip subdomains down to the registrable domain.
 * www.reddit.com -> reddit.com
 * m.youtube.com -> youtube.com
 * Handles .co.uk style TLDs for the most common cases.
 */
function stripSubdomains(domain: string): string {
  domain = domain.toLowerCase().trim();
  // Remove trailing dot if present
  if (domain.endsWith(".")) {
    domain = domain.slice(0, -1);
  }
  const parts = domain.split(".");
  if (parts.length <= 2) return domain;

  // Common two-part TLDs
  const twoPartTlds = new Set([
    "co.uk", "co.jp", "co.kr", "co.nz", "co.za", "co.in",
    "com.au", "com.br", "com.cn", "com.mx", "com.sg",
    "org.uk", "net.au", "ac.uk", "gov.uk",
  ]);

  const lastTwo = parts.slice(-2).join(".");
  if (twoPartTlds.has(lastTwo) && parts.length > 2) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

// ------------------------------------------------------------------
// Built-in domain lists
// ------------------------------------------------------------------

const RED_DOMAINS = new Set([
  // Adult content
  "pornhub.com", "xvideos.com", "xnxx.com", "xhamster.com", "redtube.com",
  "youporn.com", "tube8.com", "spankbang.com", "eporner.com", "beeg.com",
  "brazzers.com", "bangbros.com", "realitykings.com", "naughtyamerica.com",
  "mofos.com", "twistys.com", "babes.com", "digitalplayground.com",
  "porntrex.com", "hqporner.com", "porn.com", "sex.com", "livejasmin.com",
  "chaturbate.com", "bongacams.com", "stripchat.com", "cam4.com",
  "myfreecams.com", "camsoda.com", "flirt4free.com", "streamate.com",
  "onlyfans.com", "fansly.com", "manyvids.com",
  "rule34.xxx", "rule34.paheal.net", "e-hentai.org", "nhentai.net",
  "hanime.tv", "hentaihaven.xxx",
  // Gambling
  "draftkings.com", "fanduel.com", "bovada.lv", "betonline.ag",
  "betmgm.com", "caesars.com", "pointsbet.com", "bet365.com",
  "888casino.com", "pokerstars.com", "wsop.com", "globalpoker.com",
  "stake.com", "roobet.com", "duelbits.com",
  // Drug marketplaces / harm
  "silkroad.com", "erowid.org",
  // Malware / phishing (known bad)
  "malwaredomainlist.com",
  // Proxy / VPN bypass sites
  "hide.me", "hidemyass.com", "kproxy.com", "proxysite.com",
  "unblockit.cam", "croxyproxy.com", "megaproxy.com",
  // Violence / gore
  "bestgore.fun", "theync.com", "documenting.org",
  // Weapons sales
  "gunbroker.com", "armslist.com",
  // Dark web access
  "torproject.org",
  // Self-harm / pro-ana
  "pro-ana.com",
  // Escort / hookup
  "seeking.com", "ashleymadison.com", "adultfriendfinder.com",
  "skipthegames.com", "bedpage.com", "escortbabylon.net",
  "listcrawler.com", "megapersonals.com", "eros.com",
  // Additional adult
  "motherless.com", "imagefap.com", "hentai-foundry.com",
  "literotica.com", "fetlife.com",
  // Piracy
  "thepiratebay.org", "1337x.to", "rarbg.to", "nyaa.si",
  "fitgirl-repacks.site",
]);

const YELLOW_DOMAINS = new Set([
  // Social media
  "reddit.com", "tiktok.com", "discord.com", "snapchat.com",
  "instagram.com", "twitter.com", "x.com", "facebook.com",
  "threads.net", "mastodon.social", "bsky.app", "tumblr.com",
  "pinterest.com", "linkedin.com", "twitch.tv", "kick.com",
  // Messaging
  "telegram.org", "signal.org", "kik.com", "whatsapp.com",
  // AI chatbots
  "chatgpt.com", "openai.com", "claude.ai", "anthropic.com",
  "character.ai", "janitor.ai", "crushon.ai", "chai-ml.com",
  "perplexity.ai", "poe.com", "replika.com",
  // Risky chat / anonymous
  "omegle.com", "chatroulette.com", "chatrandom.com",
  "emeraldchat.com", "monkey.app",
  // Forums
  "4chan.org", "8kun.top", "kiwifarms.net", "lolcow.farm",
  // Video / streaming
  "youtube.com", "youtu.be", "vimeo.com", "dailymotion.com",
  "rumble.com", "bitchute.com", "odysee.com",
  // Gaming platforms
  "store.steampowered.com", "steampowered.com", "epicgames.com",
  "roblox.com", "fortnite.com", "minecraft.net",
  // Misc
  "imgur.com", "giphy.com", "knowyourmeme.com",
  "urbandictionary.com", "wattpad.com", "ao3.org",
  "archiveofourown.org", "fanfiction.net", "deviantart.com",
  "newgrounds.com",
  // News / opinion (potentially mature content)
  "buzzfeed.com", "vice.com", "worldstarhiphop.com",
  // Dating
  "tinder.com", "bumble.com", "hinge.co",
  // VPN apps (not blockers, but worth flagging)
  "nordvpn.com", "expressvpn.com", "surfshark.com",
  // Crypto
  "coinbase.com", "binance.com", "robinhood.com",
]);

const GREEN_DOMAINS = new Set([
  // Education
  "khanacademy.org", "wikipedia.org", "britannica.com",
  "wolframalpha.com", "mathway.com", "desmos.com",
  "quizlet.com", "coursera.org", "edx.org", "udemy.com",
  "duolingo.com", "codecademy.com", "scratch.mit.edu",
  "code.org", "brilliant.org", "ixl.com", "brainpop.com",
  "readworks.org", "newsela.com", "commonlit.org",
  "noredink.com", "zearn.org", "prodigygame.com",
  "coolmathgames.com", "mathplayground.com", "abcya.com",
  "starfall.com", "pbslearningmedia.org", "ted.com",
  "ted-ed.com",
  // Government
  "nasa.gov", "usa.gov", "loc.gov", "si.edu",
  "archives.gov", "census.gov", "usgs.gov", "noaa.gov",
  "whitehouse.gov", "congress.gov", "nih.gov", "cdc.gov",
  "epa.gov", "nps.gov", "energy.gov",
  // Reference / library
  "pbs.org", "nationalgeographic.com", "smithsonianmag.com",
  "worldbookonline.com", "merriam-webster.com",
  "dictionary.com", "thesaurus.com",
  // School platforms
  "schoology.com", "clever.com", "classdojo.com",
  "seesaw.me", "canvas.instructure.com", "blackboard.com",
  "powerschool.com", "infinite-campus.com",
  "schoolmessenger.com",
  // Library
  "overdrive.com", "libbyapp.com", "gutenberg.org",
  "openlibrary.org",
  // Productivity / safe tools
  "google.com", "docs.google.com", "drive.google.com",
  "classroom.google.com", "mail.google.com",
  "outlook.com", "office.com", "microsoft.com",
  "zoom.us", "teams.microsoft.com",
  // News (kid-safe)
  "timeforkids.com", "dogonews.com", "youngzine.org",
  "sciencenewsforstudents.org",
  // Science
  "sciencedaily.com", "space.com", "nature.com",
  "sciencemag.org",
  // Weather
  "weather.gov", "weather.com",
]);

/**
 * Categorize a domain into RED, YELLOW, GREEN, or GRAY.
 *
 * Layer 1: Parent overrides (Firestore)
 * Layer 2: Built-in category map
 * Layer 3: TLD heuristics (.edu, .gov -> GREEN)
 * Layer 4: Default GRAY
 */
export async function categorize(
  domain: string,
  familyId: string
): Promise<CategorizeResult> {
  const stripped = stripSubdomains(domain);
  const cacheKey = `${familyId}:${stripped}`;

  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Layer 1: Parent overrides
  try {
    const overrideDoc = await admin
      .firestore()
      .collection("families")
      .doc(familyId)
      .collection("overrides")
      .doc(stripped)
      .get();

    if (overrideDoc.exists) {
      const data = overrideDoc.data();
      if (data && data.category) {
        const result: CategorizeResult = {
          category: data.category as Category,
          source: "parent_override",
        };
        cache.set(cacheKey, result);
        return result;
      }
    }
  } catch (_err) {
    // Firestore read failed - fall through to built-in lists
  }

  // Layer 2: Built-in lists
  if (RED_DOMAINS.has(stripped)) {
    const result: CategorizeResult = { category: "RED", source: "builtin" };
    cache.set(cacheKey, result);
    return result;
  }

  if (YELLOW_DOMAINS.has(stripped)) {
    const result: CategorizeResult = { category: "YELLOW", source: "builtin" };
    cache.set(cacheKey, result);
    return result;
  }

  if (GREEN_DOMAINS.has(stripped)) {
    const result: CategorizeResult = { category: "GREEN", source: "builtin" };
    cache.set(cacheKey, result);
    return result;
  }

  // Layer 3: TLD heuristics
  if (stripped.endsWith(".edu") || stripped.endsWith(".gov")) {
    const result: CategorizeResult = { category: "GREEN", source: "tld_heuristic" };
    cache.set(cacheKey, result);
    return result;
  }

  // Layer 4: Default
  const result: CategorizeResult = { category: "GRAY", source: "default" };
  cache.set(cacheKey, result);
  return result;
}
