/// <reference path="./kino.d.ts" />
/**
 * 18eu.net — Kino plugin v1.0.0
 * Author: Hotaru Yume / hotaruyume
 * Fuente: 18eu.net — European erotic movies & TV series
 */

const BASE = "https://18eu.net";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

function hdr(extra) {
  var h = {
    "User-Agent": UA,
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9,es;q=0.8",
    Referer: BASE + "/",
  };
  if (extra) for (var k in extra) h[k] = extra[k];
  return h;
}

function strip(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function abs(u) {
  if (!u) return "";
  u = String(u);
  if (u.indexOf("//") === 0) return "https:" + u;
  if (u.indexOf("http") === 0) return u;
  if (u.charAt(0) === "/") return BASE + u;
  return BASE + "/" + u;
}

/** Prefer a solid poster size from /uploads/ (site uses w200, w320, etc.) */
function posterUrl(thumb) {
  if (!thumb) return undefined;
  var u = abs(thumb);
  // Upgrade tiny thumbs to a larger derivative when path is /uploads/xxx
  if (u.indexOf("/uploads/") !== -1 && u.indexOf("/uploads/w") === -1) {
    var name = u.split("/uploads/")[1];
    if (name && !/[?#]/.test(name)) {
      return BASE + "/uploads/w320/" + name;
    }
  }
  return u;
}

function makeId(s) {
  return String(s || "x")
    .replace(/[^A-Za-z0-9._~-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

async function fetchText(url, extraHeaders) {
  var r = await kino.fetch(url, {
    headers: hdr(extraHeaders),
    timeoutMs: 20000,
  });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
  return await r.text();
}

async function fetchJson(url, extraHeaders) {
  var r = await kino.fetch(url, {
    headers: hdr(
      Object.assign(
        { Accept: "application/json" },
        extraHeaders || {}
      )
    ),
    timeoutMs: 20000,
  });
  if (!r.ok) throw new Error("HTTP " + r.status + " " + url);
  return JSON.parse(await r.text());
}

/**
 * Parse card grid from list pages (home, movies, tv-series, top).
 * Cards: <a class="card" href="/slug"> ... poster img ... card-title ... card-sub
 */
function parseCards(html) {
  var items = [];
  var seen = {};
  // Match card anchors: href="/slug" (not /movies, /tv-series, /top, /watch, /genre, /year, /favorites)
  var re =
    /<a[^>]*class="[^"]*card[^"]*"[^>]*href="(\/[^"\/?#]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  var m;
  while ((m = re.exec(html))) {
    var path = m[1];
    if (
      /\/(movies|tv-series|top|favorites|watch|genre|year|search|_ajax|api|static|uploads)/i.test(
        path
      )
    )
      continue;
    var slug = path.replace(/^\//, "");
    if (!slug || seen[slug]) continue;
    seen[slug] = true;

    var block = m[2];
    var title = "";
    var tm = block.match(/class="card-title"[^>]*>([\s\S]*?)<\//i);
    if (tm) title = strip(tm[1]);
    if (!title) {
      tm = block.match(/class="card-meta"[^>]*>[\s\S]*?class="card-title"[^>]*>([\s\S]*?)<\//i);
      if (tm) title = strip(tm[1]);
    }
    if (!title) {
      title = slug.replace(/-/g, " ");
      title = title.charAt(0).toUpperCase() + title.slice(1);
    }

    var year = "";
    var sub = block.match(/class="card-sub"[^>]*>([\s\S]*?)<\//i);
    if (sub) {
      var subT = strip(sub[1]);
      var ym = subT.match(/(\d{4})/);
      if (ym) year = ym[1];
    }

    var kind = "movie";
    if (/class="[^"]*badge[^"]*"[^>]*>\s*TV\s*</i.test(block) || /TV\s*SERIES/i.test(block)) {
      kind = "series";
    }
    // format badge MOVIE / TV
    var fmt = block.match(/>(MOVIE|TV)</i);
    if (fmt && fmt[1].toUpperCase() === "TV") kind = "series";

    var poster = "";
    var im =
      block.match(/src="((?:https?:)?\/\/[^"]*\/uploads\/[^"]+)"/i) ||
      block.match(/src="(\/uploads\/[^"]+)"/i) ||
      block.match(/data-src="((?:https?:)?\/\/[^"]*\/uploads\/[^"]+)"/i) ||
      block.match(/data-src="(\/uploads\/[^"]+)"/i);
    if (im) poster = abs(im[1]);

    items.push({
      id: makeId(slug),
      ref: "title:" + slug + ":" + kind,
      title: title,
      kind: kind,
      year: year || undefined,
      poster: posterUrl(poster),
      adult: true,
    });
  }

  // Fallback: simpler href + nearby img for pages that differ
  if (items.length < 3) {
    var re2 = /href="(\/[a-z0-9][a-z0-9-]{1,80})"[^>]*>[\s\S]{0,400}?src="(\/uploads\/[^"]+)"/gi;
    while ((m = re2.exec(html))) {
      var path2 = m[1];
      if (
        /\/(movies|tv-series|top|favorites|watch|genre|year|static|api)/i.test(path2)
      )
        continue;
      var slug2 = path2.replace(/^\//, "");
      if (seen[slug2]) continue;
      seen[slug2] = true;
      var title2 = slug2.replace(/-/g, " ");
      title2 = title2.charAt(0).toUpperCase() + title2.slice(1);
      items.push({
        id: makeId(slug2),
        ref: "title:" + slug2 + ":movie",
        title: title2,
        kind: "movie",
        poster: posterUrl(abs(m[2])),
        adult: true,
      });
    }
  }
  return items;
}

function parseSearchResults(data) {
  var items = [];
  var list = (data && data.results) || [];
  for (var i = 0; i < list.length; i++) {
    var m = list[i];
    if (!m || !m.slug) continue;
    var kind = /tv|series/i.test(String(m.format || "")) ? "series" : "movie";
    items.push({
      id: makeId(m.slug),
      ref: "title:" + m.slug + ":" + kind,
      title: m.title || m.slug,
      kind: kind,
      year: m.year ? String(m.year) : undefined,
      poster: posterUrl(m.thumb),
      adult: true,
    });
  }
  return items;
}

/**
 * Extract episode buttons and meta from a watch page HTML.
 * data-ep = episode id for sources API, data-no = number, data-ss = season, data-sv = server
 */
function parseWatchMeta(html) {
  var meta = {
    movieId: 0,
    slug: "",
    isSeries: false,
    episodes: [],
    servers: [],
  };
  var mid = html.match(/window\.__movieId\s*=\s*(\d+)/);
  if (mid) meta.movieId = parseInt(mid[1], 10);
  var slug = html.match(/window\.__slug\s*=\s*"([^"]+)"/);
  if (slug) meta.slug = slug[1];
  var isSer = html.match(/window\.__isSeries\s*=\s*(true|false)/);
  if (isSer) meta.isSeries = isSer[1] === "true";

  // Episode buttons
  var re =
    /<button[^>]*class="[^"]*epbtn[^"]*"[^>]*data-ep="(\d+)"[^>]*data-name="([^"]*)"[^>]*data-sv="(\d+)"[^>]*data-ss="(\d+)"[^>]*data-no="(\d+)"[^>]*>/gi;
  var m;
  var seenEp = {};
  while ((m = re.exec(html))) {
    var eid = m[1];
    var key = m[4] + "-" + m[5]; // season-no
    if (seenEp[key]) continue;
    seenEp[key] = true;
    meta.episodes.push({
      id: eid,
      name: strip(m[2]) || "Ep " + m[5],
      sv: parseInt(m[3], 10) || 1,
      ss: parseInt(m[4], 10) || 1,
      no: parseInt(m[5], 10) || 1,
    });
  }
  // Alternate attribute order
  if (!meta.episodes.length) {
    re =
      /data-ep="(\d+)"[^>]*data-name="([^"]*)"[^>]*data-sv="(\d+)"[^>]*data-ss="(\d+)"[^>]*data-no="(\d+)"/gi;
    while ((m = re.exec(html))) {
      var key2 = m[4] + "-" + m[5];
      if (seenEp[key2]) continue;
      seenEp[key2] = true;
      meta.episodes.push({
        id: m[1],
        name: strip(m[2]) || "Ep " + m[5],
        sv: parseInt(m[3], 10) || 1,
        ss: parseInt(m[4], 10) || 1,
        no: parseInt(m[5], 10) || 1,
      });
    }
  }

  // Movie "Full" button often has data-ep
  if (!meta.episodes.length) {
    var full = html.match(
      /data-ep="(\d+)"[^>]*(?:data-name="([^"]*)")?[^>]*data-sv="(\d+)"[^>]*data-ss="(\d+)"[^>]*data-no="(\d+)"/i
    );
    if (full) {
      meta.episodes.push({
        id: full[1],
        name: strip(full[2]) || "Full",
        sv: parseInt(full[3], 10) || 1,
        ss: parseInt(full[4], 10) || 1,
        no: parseInt(full[5], 10) || 1,
      });
    }
  }

  // Server list
  var sre = /class="wserver"[^>]*data-sv="(\d+)"/gi;
  while ((m = sre.exec(html))) {
    var sv = parseInt(m[1], 10);
    if (meta.servers.indexOf(sv) === -1) meta.servers.push(sv);
  }
  if (!meta.servers.length) meta.servers = [1];

  return meta;
}

/** Build playable HLS URL; index.m3u8 works on phone and TV. */
function toPlayableUrl(file) {
  if (!file) return "";
  var u = String(file).replace(/\/+$/, "");
  if (/\.m3u8(\?|$)/i.test(u) || /\.mp4(\?|$)/i.test(u)) return u;
  // JW-style token path → index.m3u8
  return u + "/index.m3u8";
}

function isAdOrJunk(url) {
  if (!url) return true;
  var low = url.toLowerCase();
  if (
    /adsco\.|connatix|doubleclick|googlesyndication|exoclick|juicyads|premiumvertising|ads\./i.test(
      low
    )
  )
    return true;
  if (/blob:|javascript:/i.test(low)) return true;
  return false;
}

/* ===================== exports ===================== */

export async function search(query) {
  var q = (query && query.q) || "";
  q = String(q).trim();
  if (!q) return [];

  try {
    var data = await fetchJson(
      BASE + "/_ajax/search?q=" + encodeURIComponent(q)
    );
    var items = parseSearchResults(data);
    // Prefer requested type first
    if (query.type === "movie" || query.type === "series") {
      items.sort(function (a, b) {
        var ap = a.kind === query.type ? 0 : 1;
        var bp = b.kind === query.type ? 0 : 1;
        return ap - bp;
      });
    }
    return items;
  } catch (e) {
    kino.log && kino.log("search error: " + (e && e.message));
    return [];
  }
}

export async function home() {
  var rows = [];
  try {
    var homeHtml = await fetchText(BASE + "/");
    var top = parseCards(homeHtml);
    if (top.length) {
      rows.push({
        id: "top",
        title: "Top",
        items: top.slice(0, 40),
        ref: "browse:top/week",
        genre: "otros",
      });
    }
  } catch (e) {
    kino.log && kino.log("home top: " + (e && e.message));
  }

  try {
    var movHtml = await fetchText(BASE + "/movies");
    var movies = parseCards(movHtml);
    if (movies.length) {
      rows.push({
        id: "movies",
        title: "Movies",
        items: movies.slice(0, 40),
        ref: "browse:movies",
        genre: "peliculas",
      });
    }
  } catch (e) {
    kino.log && kino.log("home movies: " + (e && e.message));
  }

  try {
    var tvHtml = await fetchText(BASE + "/tv-series");
    var series = parseCards(tvHtml);
    if (series.length) {
      rows.push({
        id: "tv",
        title: "TV Series",
        items: series.slice(0, 40),
        ref: "browse:tv-series",
        genre: "series",
      });
    }
  } catch (e) {
    kino.log && kino.log("home tv: " + (e && e.message));
  }

  // Extra top windows if home was thin
  if (rows.length < 2) {
    try {
      var weekHtml = await fetchText(BASE + "/top/week");
      var week = parseCards(weekHtml);
      if (week.length) {
        rows.push({
          id: "top-week",
          title: "Top of the week",
          items: week.slice(0, 40),
          ref: "browse:top/week",
          genre: "otros",
        });
      }
    } catch (e) {}
  }

  return rows;
}

export async function browse(ref, cursor) {
  var path = String(ref || "").replace(/^browse:/, "");
  if (!path) path = "movies";
  var page = 1;
  if (cursor) {
    var cm = String(cursor).match(/page=(\d+)/);
    if (cm) page = parseInt(cm[1], 10) || 1;
  }

  var url = BASE + "/" + path.replace(/^\//, "");
  if (page > 1) {
    url += (url.indexOf("?") >= 0 ? "&" : "?") + "page=" + page;
  }

  var html = await fetchText(url);
  var items = parseCards(html);

  var next = null;
  // Site uses ?page=N
  if (items.length >= 12) {
    next = "page=" + (page + 1);
  } else if (/page=\d+/.test(html) && new RegExp("page=" + (page + 1)).test(html)) {
    next = "page=" + (page + 1);
  }

  return { items: items, next: next || undefined };
}

export async function episodes(ref) {
  // ref: title:slug:series
  var parts = String(ref || "").split(":");
  var slug = parts[1] || parts[0] || "";
  if (!slug) throw kino.error("not_found", "Título no encontrado");

  // Load watch page to get full episode list (servers + ep buttons)
  var watchUrl = BASE + "/watch/" + encodeURIComponent(slug) + "?sv=1&ep=1";
  var html = await fetchText(watchUrl);
  var meta = parseWatchMeta(html);

  if (!meta.episodes.length) {
    // try without ep param
    html = await fetchText(BASE + "/watch/" + encodeURIComponent(slug) + "?sv=1");
    meta = parseWatchMeta(html);
  }

  var eps = meta.episodes
    .slice()
    .sort(function (a, b) {
      if (a.ss !== b.ss) return a.ss - b.ss;
      return a.no - b.no;
    })
    .map(function (ep) {
      return {
        season: ep.ss,
        number: ep.no,
        ref: "ep:" + slug + ":" + ep.id + ":" + ep.sv,
        title: ep.name || "Episode " + ep.no,
      };
    });

  // Title from page
  var title = slug.replace(/-/g, " ");
  var tm = html.match(/<title>([^<]+)</i);
  if (tm) {
    title = strip(tm[1].split("—")[0].split("|")[0]).replace(/^Watch\s+/i, "");
  }

  return {
    series: {
      title: title,
      poster: undefined,
      overview: undefined,
    },
    episodes: eps,
  };
}

export async function resolve(ref) {
  var s = String(ref || "");
  var slug = "";
  var episodeId = "";
  var preferredSv = 1;

  if (s.indexOf("ep:") === 0) {
    // ep:slug:episodeId:sv
    var p = s.split(":");
    slug = p[1] || "";
    episodeId = p[2] || "";
    preferredSv = parseInt(p[3], 10) || 1;
  } else if (s.indexOf("title:") === 0) {
    // title:slug:kind
    var p2 = s.split(":");
    slug = p2[1] || "";
  } else {
    slug = s;
  }

  if (!slug) throw kino.error("not_found", "Referencia inválida");

  // If we don't have episode id yet, load watch page
  if (!episodeId) {
    var isSeries = s.indexOf(":series") !== -1;
    var watchUrl =
      BASE +
      "/watch/" +
      encodeURIComponent(slug) +
      (isSeries ? "?sv=1&ep=1" : "?sv=1&part=1");
    var html = await fetchText(watchUrl);
    var meta = parseWatchMeta(html);
    if (meta.episodes.length) {
      // Prefer lowest season/ep (first playable)
      meta.episodes.sort(function (a, b) {
        if (a.ss !== b.ss) return a.ss - b.ss;
        return a.no - b.no;
      });
      episodeId = meta.episodes[0].id;
      preferredSv = meta.episodes[0].sv || 1;
    } else {
      // Last resort: scrape sources URL from scripts / links
      var sm = html.match(/\/api\/v1\/episodes\/(\d+)\/sources/i);
      if (sm) episodeId = sm[1];
    }
  }

  if (!episodeId) {
    throw kino.error("not_found", "No se encontró fuente de video");
  }

  // Primary sources
  var sourcesUrl =
    BASE +
    "/api/v1/episodes/" +
    episodeId +
    "/sources?slug=" +
    encodeURIComponent(slug);
  var data;
  try {
    data = await fetchJson(sourcesUrl);
  } catch (e) {
    throw kino.error("network", "No se pudo obtener el stream");
  }

  if (!data || !data.success || !Array.isArray(data.sources) || !data.sources.length) {
    throw kino.error("not_found", "Sin fuentes reproducibles");
  }

  // Collect playable candidates, skip ads
  var candidates = [];
  for (var i = 0; i < data.sources.length; i++) {
    var src = data.sources[i];
    if (!src || !src.file) continue;
    var url = toPlayableUrl(src.file);
    if (isAdOrJunk(url)) continue;
    var mime =
      src.type === "hls" || /\.m3u8/i.test(url)
        ? "application/x-mpegURL"
        : src.type === "mp4" || /\.mp4/i.test(url)
          ? "video/mp4"
          : undefined;
    candidates.push({
      url: url,
      mime: mime,
      label: "Server " + preferredSv,
      score: 10,
    });
  }

  // Backup from response
  if (data.backup && typeof data.backup === "string" && !isAdOrJunk(data.backup)) {
    // backup is often a player page; try to resolve token if it looks like stream path
    var bak = data.backup;
    if (/master\.|player\.|abyss/i.test(bak) && !/\/watch\//i.test(bak)) {
      candidates.push({
        url: toPlayableUrl(bak),
        mime: "application/x-mpegURL",
        label: "Backup",
        score: 5,
      });
    }
  }

  // Optional second server: try loading watch with sv=2 if primary failed pattern
  if (candidates.length === 0) {
    try {
      var html2 = await fetchText(
        BASE + "/watch/" + encodeURIComponent(slug) + "?sv=2&part=1"
      );
      var sm2 = html2.match(/\/api\/v1\/episodes\/(\d+)\/sources/i);
      if (sm2) {
        var data2 = await fetchJson(
          BASE +
            "/api/v1/episodes/" +
            sm2[1] +
            "/sources?slug=" +
            encodeURIComponent(slug)
        );
        if (data2 && data2.sources) {
          for (var j = 0; j < data2.sources.length; j++) {
            var s2 = data2.sources[j];
            if (!s2 || !s2.file || isAdOrJunk(s2.file)) continue;
            candidates.push({
              url: toPlayableUrl(s2.file),
              mime: "application/x-mpegURL",
              label: "Server 2",
              score: 8,
            });
          }
        }
      }
    } catch (e2) {
      /* ignore */
    }
  }

  candidates.sort(function (a, b) {
    return b.score - a.score;
  });

  if (!candidates.length) {
    throw kino.error("not_found", "Sin stream reproducible (solo anuncios)");
  }

  var best = candidates[0];
  var alternatives = [];
  for (var k = 1; k < candidates.length && k < 4; k++) {
    alternatives.push({
      url: candidates[k].url,
      mime: candidates[k].mime,
      label: candidates[k].label,
    });
  }

  var stream = {
    url: best.url,
    mime: best.mime || "application/x-mpegURL",
    headers: {
      "User-Agent": UA,
      Referer: BASE + "/",
      Origin: BASE,
    },
    label: best.label,
  };
  if (alternatives.length) stream.alternatives = alternatives;

  // portable HLS for TV / cast when possible
  if (stream.mime === "application/x-mpegURL") {
    stream.portable = { url: stream.url, mime: "application/x-mpegURL" };
  }

  return stream;
}
