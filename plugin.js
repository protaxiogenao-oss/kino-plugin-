// Capibara Traductor — Kino plugin v2.1.0
// Autor: Hotaru Yume (hotaruyume)
// Solo mangas: catálogo, capítulos ordenados (asc) y lector de páginas en pantalla.
// Descifrado ph + header x-organization requerido por la API.
// Requiere Kino 0.9.74+ (apiVersion 14, screen).

const BASE = "https://capibaratraductor.com";
const MAX_CAPS = 500;

// ===================== Descifrado de páginas (ph / ls / lh) =====================
const B64 = "CDoIL78Qqwj9zKM6mOFdf0niV_AByGg4aNhbEetPsHr1x-TpZJYRk5lWu32vUcSX";
const X64 = "tgEib4lqMSha5TU13QX28deN-xuk6KywP0m_roGYvBWAnzFfjcJIVROp7CsDZ9HL";
const U_TBL = [
  [12, 2, 13, 7, 1, 9, 8],
  [11, 4, 5, 6, 3, 9, 12],
  [9, 8, 2, 3, 1, 6, 13],
  [8, 7, 2, 13, 1, 3, 6],
  [13, 2, 11, 6, 4, 3, 8],
  [6, 1, 3, 4, 7, 5, 11],
  [4, 8, 7, 9, 1, 10, 13],
  [8, 3, 6, 13, 12, 10, 11],
];
const W_TBL = [234, 55, 192, 73, 249, 251, 2, 58];
const B64MAP = {};
const X64MAP = {};
for (let i = 0; i < 64; i++) {
  B64MAP[B64[i]] = i;
  X64MAP[X64[i]] = i;
}

function imul(a, b) {
  const ah = (a >>> 16) & 0xffff;
  const al = a & 0xffff;
  const bh = (b >>> 16) & 0xffff;
  const bl = b & 0xffff;
  return ((al * bl + (((ah * bl + al * bh) << 16) >>> 0)) >>> 0) | 0;
}

function Ihash(e) {
  e = e >>> 0;
  e = (e ^ (e >>> 16)) >>> 0;
  e = imul(e, 2146121005) >>> 0;
  e = (e ^ (e >>> 15)) >>> 0;
  e = imul(e, 2221713035) >>> 0;
  e = (e ^ (e >>> 16)) >>> 0;
  return e >>> 0;
}

function Lhash(s) {
  let t = 2166136261;
  s = String(s || "");
  for (let n = 0; n < s.length; n++) {
    t = (t ^ s.charCodeAt(n)) >>> 0;
    t = imul(t, 16777619) >>> 0;
  }
  return t >>> 0;
}

function Rhash(arr) {
  let t = 2166136261;
  for (let n = 0; n < arr.length; n++) {
    t = (t ^ (arr[n] & 255)) >>> 0;
    t = imul(t, 16777619) >>> 0;
  }
  return t >>> 0;
}

function Fdecode(e) {
  const t = [];
  let n = 0;
  let r = 0;
  for (let i = 0; i < e.length; i++) {
    const a = B64MAP[e[i]];
    if (a === undefined) return null;
    n = (n << 6) | a;
    r += 6;
    if (r >= 8) {
      r -= 8;
      t.push((n >>> r) & 255);
      n &= (1 << r) - 1;
    }
  }
  return t;
}

function toBase36(n) {
  n = n >>> 0;
  if (n === 0) return "0";
  const digits = "0123456789abcdefghijklmnopqrstuvwxyz";
  let out = "";
  while (n > 0) {
    out = digits[n % 36] + out;
    n = Math.floor(n / 36);
  }
  return out;
}

function Jname(e) {
  return "_" + toBase36(Ihash((e ^ 1000283751) >>> 0));
}

function qseed(e) {
  const t = Fdecode(e);
  if (!t || t.length !== 14) return null;
  const row = U_TBL[t[0] & 7];
  const n = [];
  for (let i = 0; i < 7; i++) {
    n.push((t[row[i]] ^ W_TBL[(i + t[0]) & 7] ^ t[0]) & 255);
  }
  return {
    p: (n[0] << 16) | (n[1] << 8) | n[2],
    v: ((n[3] << 24) | (n[4] << 16) | (n[5] << 8) | n[6]) >>> 0,
  };
}

function Ytoken(e, globals) {
  for (let n = e - 1; n <= e + 1; n++) {
    const key = Jname(n);
    const r = globals[key];
    if (typeof r !== "string" || !/^[0-9a-f]{24}$/.test(r)) continue;
    const i = e - n + 1;
    const part = r.slice(i * 8, i * 8 + 8);
    if (part.length !== 8) continue;
    return (parseInt(part, 16) ^ Ihash(((n * 3 + i) ^ 739982445) >>> 0)) >>> 0;
  }
  return null;
}

function peTransform(e, t) {
  if (typeof e !== "string" || e.length < 2) return e;
  let n = "";
  for (let r = 0; r < e.length; r++) {
    const i = X64MAP[e[r]];
    if (i === undefined) return e;
    n += X64[(i - r * 7 - 13 - t) & 63];
  }
  const len = n.length;
  const rot = (len * 5 + t * 3 + 1) % len;
  n = n.slice(len - rot) + n.slice(0, len - rot);
  const half = Math.ceil(n.length / 2);
  const left = n.slice(0, half);
  const right = n.slice(half).split("").reverse();
  let out = "";
  for (let idx = 0; idx < n.length; idx++) {
    out += idx % 2 ? right[(idx - 1) / 2] : left[idx / 2];
  }
  return out;
}

function seDecrypt(bytes, seed, pageIdx, fieldIdx, idHash) {
  let a = Ihash((seed ^ 1821285621) >>> 0);
  let o = Ihash((a ^ imul(pageIdx + 1, 2654435761)) >>> 0);
  let s = Ihash((o ^ (imul(fieldIdx + 1, 2246822519) ^ idHash)) >>> 0);
  let c = Ihash((s ^ 374761393) >>> 0);
  function step() {
    let e = ((a + o) | 0) + c;
    e = e | 0;
    c = (c + 1) | 0;
    a = o ^ (o >>> 9);
    o = (s + (s << 3)) | 0;
    s = (s << 21) | (s >>> 11);
    s = (s + e) | 0;
    return e >>> 0;
  }
  for (let i = 0; i < 16; i++) step();
  let u = 0;
  const e = bytes.slice();
  for (let t = 0; t < e.length; t++) {
    if (t % 4 === 0) u = step();
    e[t] = (e[t] ^ ((u >>> ((t % 4) * 8)) & 255)) & 255;
  }
  if (e[0] === 4 && (Rhash(e.slice(3)) & 65535) === ((e[1] << 8) | e[2])) {
    return e;
  }
  return null;
}

function decodePh(ph, seed, pageIdx, pageId) {
  const transformed = peTransform(ph, pageIdx);
  const raw = Fdecode(transformed);
  if (!raw || raw.length < 3 || raw.length > 4096) return null;
  const idHash = Lhash(String(pageId == null ? "" : pageId));
  const dec = seDecrypt(raw, seed, pageIdx, 0, idHash);
  if (!dec) return null;
  const payload = dec.slice(3);
  let s = "";
  for (let i = 0; i < payload.length; i++) s += String.fromCharCode(payload[i]);
  try {
    return decodeURIComponent(escape(s));
  } catch (_) {
    return s;
  }
}

let cachedToken = null;
let cachedTokenAt = 0;

async function fetchPageToken() {
  const now = Date.now();
  if (cachedToken && now - cachedTokenAt < 10 * 60 * 1000) return cachedToken;
  const r = await kino.fetch(BASE + "/", {
    headers: { Accept: "text/html", Referer: BASE + "/" },
    timeoutMs: 15000,
  });
  if (!r.ok) return cachedToken || {};
  const html = await r.text();
  const g = {};
  const re = /(_[a-z0-9]+)="([0-9a-f]{24})"/g;
  let m;
  while ((m = re.exec(html)) !== null) g[m[1]] = m[2];
  cachedToken = g;
  cachedTokenAt = now;
  return g;
}

async function decryptPagesPayload(json) {
  let pages = Array.isArray(json) ? json : (json && (json.data || json.pages)) || [];
  const ls = json && json.ls;
  if (!ls || !Array.isArray(pages) || !pages.length) {
    return pages;
  }
  const tok = qseed(ls);
  if (!tok) return pages;
  const globals = await fetchPageToken();
  const yv = Ytoken(tok.p, globals);
  if (yv == null) {
    kino.log("decrypt", "sin token de página");
    return pages;
  }
  const seed = (tok.v ^ yv) >>> 0;
  const out = [];
  for (let i = 0; i < pages.length; i++) {
    const p = pages[i];
    const copy = Object.assign({}, p);
    if (typeof p.ph === "string" && p.ph.length) {
      const url = decodePh(p.ph, seed, i, p.id);
      if (url) {
        copy.imageUrl = url;
        delete copy.ph;
      }
    }
    out.push(copy);
  }
  return out;
}

// ===================== Red =====================

async function api(path, org, timeoutMs) {
  const headers = {
    Accept: "application/json",
    Referer: BASE + "/",
    "x-site": "es",
  };
  if (org) {
    headers["x-organization"] = String(org);
    headers.Referer = BASE + "/" + org + "/";
  }
  const r = await kino.fetch(BASE + path, {
    headers: headers,
    timeoutMs: timeoutMs || 20000,
  });
  if (!r.ok) {
    throw kino.error("unavailable", "HTTP " + r.status + " " + path, {
      userMessage: "Capibara no respondió (" + r.status + ").",
    });
  }
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw kino.error("unavailable", "JSON inválido", {
      userMessage: "Respuesta inválida de Capibara.",
    });
  }
  if (j && j.status === false) {
    throw kino.error("unavailable", j.message || "API error", {
      userMessage: j.message || "Capibara rechazó la petición.",
    });
  }
  return j;
}

function clean(s) {
  return String(s || "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

function isNovelType(t) {
  const s = String(t || "").toLowerCase();
  return s.indexOf("novel") !== -1 || s === "novela" || s === "novela_ligera";
}

function posterOf(item) {
  return (
    item.cover ||
    item.imageUrl ||
    item.thumbnailUrl ||
    (item.manga && (item.manga.imageUrl || item.manga.cover)) ||
    ""
  );
}

function titleOf(item) {
  return clean(item.title || (item.manga && item.manga.title) || item.name || "Sin título");
}

function orgOf(item) {
  if (item.organization && item.organization.slug) return item.organization.slug;
  if (item.scanSlug) return item.scanSlug;
  if (item.scanName) return String(item.scanName).toLowerCase().replace(/\s+/g, "");
  return "";
}

function slugOf(item) {
  if (item.manga && item.manga.slug) return item.manga.slug;
  if (item.mangaSlug) return item.mangaSlug;
  if (item.slug) return item.slug;
  return "";
}

function workRef(item) {
  const org = orgOf(item);
  const slug = slugOf(item);
  if (org && slug) return "work:manga:" + org + ":" + slug;
  if (slug) return "slug:" + slug;
  if (item.id) return "id:" + String(item.id);
  return "slug:unknown";
}

function parseRef(ref) {
  if (!ref) return null;
  if (ref.indexOf("work:") === 0) {
    const parts = ref.slice(5).split(":");
    return {
      kind: "work",
      type: parts[0] || "manga",
      org: parts[1] || "",
      slug: parts[2] || "",
    };
  }
  if (ref.indexOf("slug:") === 0) return { kind: "slug", slug: ref.slice(5), org: "" };
  if (ref.indexOf("ch:") === 0) {
    const rest = ref.slice(3);
    const p = rest.split(":");
    // ch:manga:org:slug:number  or  ch:org:slug:number
    if (p[0] === "manga" && p.length >= 4) {
      return {
        kind: "chapter",
        type: "manga",
        org: p[1],
        slug: p[2],
        number: p.slice(3).join(":"),
      };
    }
    if (p.length >= 3) {
      return {
        kind: "chapter",
        type: "manga",
        org: p[0],
        slug: p[1],
        number: p.slice(2).join(":"),
      };
    }
  }
  if (ref.indexOf("id:") === 0) return { kind: "id", id: ref.slice(3) };
  return null;
}

function itemFromWork(w) {
  const typeCode =
    (w.manga && w.manga.bookType && w.manga.bookType.code) || w.workType || w.type || "";
  if (isNovelType(typeCode)) return null;
  const ref = workRef(w);
  return {
    id: String(w.id || w.mangaId || ref)
      .replace(/[^A-Za-z0-9._~-]/g, "_")
      .slice(0, 128),
    ref: ref,
    title: titleOf(w).slice(0, 200),
    kind: "series",
    poster: posterOf(w),
    overview: clean(
      w.shortDescription ||
        w.description ||
        (w.manga && (w.manga.shortDescription || w.manga.description)) ||
        ""
    ).slice(0, 400),
    adult: !!(w.isNSFW || (w.manga && w.manga.isNSFW)),
  };
}

function itemFromFeatured(f) {
  const org = f.scanSlug || "";
  const slug = f.mangaSlug || "";
  if (!org || !slug) return null;
  return {
    id: String(f.id || org + "-" + slug)
      .replace(/[^A-Za-z0-9._~-]/g, "_")
      .slice(0, 128),
    ref: "work:manga:" + org + ":" + slug,
    title: clean(f.title || slug).slice(0, 200),
    kind: "series",
    poster: f.cover || "",
    overview: "",
    badges: f.scanName ? [String(f.scanName).slice(0, 24)] : undefined,
  };
}

function itemFromSearchObra(o) {
  if (isNovelType(o.type)) return null;
  const ref = workRef(o);
  return {
    id: String(o.id || ref)
      .replace(/[^A-Za-z0-9._~-]/g, "_")
      .slice(0, 128),
    ref: ref,
    title: titleOf(o).slice(0, 200),
    kind: "series",
    poster: posterOf(o),
  };
}

function logErr(where, e) {
  try {
    kino.log(where, (e && (e.message || e.code || String(e))) || "error");
  } catch (_) {}
}

// ===================== home / browse / search =====================

export async function home() {
  const rows = [];

  try {
    const feat = (
      await api("/api/landing/featured-manga?limit=18&page=1&nsfw=false&sort=daily&mix=1")
    ).data;
    const items = (feat || [])
      .map(itemFromFeatured)
      .filter(Boolean);
    if (items.length) {
      rows.push({
        id: "featured",
        title: "Destacados",
        items: items,
        ref: "browse:featured",
        genre: "anime",
      });
    }
  } catch (e) {
    logErr("home.featured", e);
  }

  try {
    const mc = (await api("/api/manga-custom?order=latest&limit=24&page=1&nsfw=false")).data;
    const items = (mc.items || [])
      .map(itemFromWork)
      .filter(Boolean);
    if (items.length) {
      rows.push({
        id: "latest",
        title: "Últimos mangas",
        items: items,
        ref: "browse:manga-latest",
        genre: "anime",
      });
    }
  } catch (e) {
    logErr("home.latest", e);
  }

  try {
    const mc = (await api("/api/manga-custom?order=popular&limit=24&page=1&nsfw=false")).data;
    const items = (mc.items || [])
      .map(itemFromWork)
      .filter(Boolean);
    if (items.length) {
      rows.push({
        id: "popular",
        title: "Populares",
        items: items,
        ref: "browse:manga-popular",
        genre: "anime",
      });
    }
  } catch (e) {
    logErr("home.popular", e);
  }

  return rows;
}

export async function browse(ref, cursor) {
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const limit = 24;

  if (ref === "browse:manga-popular" || ref === "browse:manga-latest") {
    const order = ref === "browse:manga-popular" ? "popular" : "latest";
    const data = (
      await api("/api/manga-custom?order=" + order + "&limit=" + limit + "&page=" + page + "&nsfw=false")
    ).data;
    const items = (data.items || []).map(itemFromWork).filter(Boolean);
    const hasMore = items.length >= limit;
    return {
      items: items,
      next: hasMore ? String(page + 1) : undefined,
    };
  }

  if (ref === "browse:featured") {
    const data = (
      await api(
        "/api/landing/featured-manga?limit=" + limit + "&page=" + page + "&nsfw=false&sort=daily&mix=1"
      )
    ).data;
    const items = (data || []).map(itemFromFeatured).filter(Boolean);
    const hasMore = items.length >= limit;
    return {
      items: items,
      next: hasMore ? String(page + 1) : undefined,
    };
  }

  return { items: [] };
}

export async function search(query) {
  const q = String((query && query.q) || query || "").trim();
  if (!q) return [];
  const j = await api("/api/search?q=" + encodeURIComponent(q) + "&limit=40&nsfw=false");
  const obras = (j.data && (j.data.obras || j.data.items || j.data.results)) || j.data || [];
  const list = Array.isArray(obras) ? obras : [];
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const it = itemFromSearchObra(list[i]);
    if (it) out.push(it);
  }
  return out;
}

// ===================== episodes / resolve =====================

async function loadWork(org, slug) {
  if (!slug) throw kino.error("invalid_ref", "slug", { userMessage: "Obra sin identificador." });
  const j = await api("/api/manga-custom/" + encodeURIComponent(slug), org || undefined);
  return j.data || j;
}

export async function episodes(ref) {
  const p = parseRef(ref);
  if (!p || (p.kind !== "work" && p.kind !== "slug")) {
    throw kino.error("invalid_ref", "ref", { userMessage: "No se pudo abrir esta obra." });
  }

  let data;
  try {
    data = await loadWork(p.org, p.slug);
  } catch (e) {
    throw kino.error("unavailable", "obra", {
      userMessage: "No se pudo cargar la obra. Prueba desde Inicio o búsqueda de Capibara.",
    });
  }

  const chapters = (data.chapters || [])
    .filter(function (c) {
      return !c.isUnreleased && !c.hiddenAt && !c.deletedAt;
    })
    .sort(function (a, b) {
      return Number(a.number) - Number(b.number);
    });

  const org = p.org || orgOf(data) || "";
  const slug = p.slug || slugOf(data) || "";

  const episodesList = chapters.slice(-MAX_CAPS).map(function (c, idx) {
    const num = Number(c.number);
    const chRef = "ch:manga:" + org + ":" + slug + ":" + c.number;
    return {
      season: 1,
      number: Number.isFinite(num) ? Math.max(1, Math.round(num)) : idx + 1,
      ref: chRef,
      title: clean(c.title || "Cap. " + c.number).slice(0, 200),
      airDate: c.releasedAt ? String(c.releasedAt).slice(0, 10) : undefined,
    };
  });

  return {
    series: {
      title: titleOf(data),
      poster: posterOf(data),
      overview: clean(data.shortDescription || data.description || "").slice(0, 600),
    },
    episodes: episodesList,
  };
}

async function loadChapterPages(org, slug, number) {
  const path =
    "/api/manga-custom/" +
    encodeURIComponent(slug) +
    "/chapter/" +
    encodeURIComponent(number) +
    "/pages";
  return api(path, org);
}

export async function resolve(ref) {
  const p = parseRef(ref);
  if (!p) {
    throw kino.error("invalid_ref", "ref", { userMessage: "No se puede abrir." });
  }

  if (p.kind === "chapter") {
    throw kino.error("unavailable", "usa-pantalla", {
      userMessage:
        "Abre Capibara desde el menú de plugins y elige el manga/capítulo ahí para leer las páginas.",
    });
  }

  if (p.kind === "work" || p.kind === "slug") {
    const ep = await episodes(ref);
    if (ep.episodes && ep.episodes.length) {
      throw kino.error("unavailable", "usa-pantalla", {
        userMessage:
          "Abre Capibara desde el menú de plugins para leer el manga. El reproductor de vídeo no sirve para páginas.",
      });
    }
    throw kino.error("unavailable", "sin caps", { userMessage: "Sin capítulos publicados." });
  }

  throw kino.error("invalid_ref", ref, { userMessage: "No se puede resolver este título." });
}

// ===================== Pantalla: catálogo + lector =====================

async function loadReaderPages(st) {
  try {
    const body = await loadChapterPages(st.readerOrg, st.readerSlug, st.readerNumber);
    const decrypted = await decryptPagesPayload(body);
    const urls = [];
    for (let i = 0; i < decrypted.length; i++) {
      const u = decrypted[i].imageUrl || decrypted[i].url;
      if (u) urls.push(u);
    }
    const all = st.readerAll || [];
    let prevCh = null;
    let nextCh = null;
    const num = String(st.readerNumber);
    for (let i = 0; i < all.length; i++) {
      if (String(all[i].number) === num) {
        if (i > 0) prevCh = all[i - 1];
        if (i + 1 < all.length) nextCh = all[i + 1];
        break;
      }
    }
    return {
      state: Object.assign({}, st, {
        pages: urls,
        readerLoading: false,
        readerError: urls.length ? null : "Sin páginas descifradas",
        prevCh: prevCh,
        nextCh: nextCh,
      }),
    };
  } catch (e) {
    return {
      state: Object.assign({}, st, {
        pages: [],
        readerLoading: false,
        readerError: (e && e.userMessage) || (e && e.message) || "Error al cargar páginas",
      }),
    };
  }
}

export async function screen({ state, route, lang }) {
  const st = state || {};
  const name = (route && route.name) || "main";

  if (name === "reader") {
    const pages = st.pages || [];
    const title = st.readerTitle || "Capítulo";
    const children = [];
    children.push({
      type: "Text",
      text: title,
      style: "h3",
      color: "primary",
    });
    if (st.readerError) {
      children.push({ type: "Text", text: st.readerError, color: "error" });
    }
    if (st.readerLoading) {
      children.push({
        type: "Text",
        text: lang === "en" ? "Loading pages…" : "Cargando páginas…",
      });
      children.push({ type: "Skeleton", height: 200 });
      children.push({ type: "Skeleton", height: 200 });
    }
    for (let i = 0; i < pages.length; i++) {
      const url = pages[i];
      if (!url) continue;
      children.push({
        type: "Image",
        url: url,
        fit: "contain",
        width: "expand",
      });
    }
    if (!st.readerLoading && pages.length) {
      children.push({
        type: "Row",
        gap: 8,
        children: [
          {
            type: "ElevatedButton",
            labelText: "Cap. anterior",
            labelTextEn: "Previous",
            onPressed: "readerPrev",
            enabled: !!st.prevCh,
          },
          {
            type: "ElevatedButton",
            labelText: "Cap. siguiente",
            labelTextEn: "Next",
            onPressed: "readerNext",
            enabled: !!st.nextCh,
          },
        ],
      });
    }
    return {
      type: "Scaffold",
      appBar: {
        type: "AppBar",
        mergeWithKinoBar: true,
        dense: true,
        title: title.slice(0, 40),
        leading: {
          type: "IconButton",
          icon: "arrow_back",
          labelText: "Volver",
          labelTextEn: "Back",
          onPressed: { pop: true },
        },
      },
      body: {
        type: "SingleChildScrollView",
        padding: { compact: 8, expanded: 16 },
        children: children,
      },
    };
  }

  // main
  const children = [];
  children.push({ type: "Text", text: "Capibara Traductor", style: "h2" });
  children.push({
    type: "Text",
    text:
      lang === "en"
        ? "Spanish scanlation hub. Open a title, then a chapter to read pages."
        : "Hub de scans en español. Abre un título y luego un capítulo para leer las páginas.",
    style: "body",
  });
  children.push({
    type: "TextField",
    key: "q",
    labelText: "Buscar manga",
    labelTextEn: "Search manga",
    onSubmitted: "doSearch",
  });
  children.push({
    type: "ElevatedButton",
    labelText: "Buscar",
    labelTextEn: "Search",
    onPressed: "doSearch",
  });

  if (st.searchError) {
    children.push({ type: "Text", text: st.searchError, color: "error" });
  }

  if (st.workTitle) {
    children.push({ type: "Text", text: st.workTitle, style: "h3", color: "primary" });
    if (st.workOverview) {
      children.push({ type: "Text", text: st.workOverview.slice(0, 300), style: "body" });
    }
    const chs = st.chapters || [];
    children.push({
      type: "Text",
      text: (lang === "en" ? "Chapters: " : "Capítulos: ") + chs.length,
      style: "caption",
    });
    for (let i = 0; i < Math.min(chs.length, 80); i++) {
      const c = chs[i];
      children.push({
        type: "ListTile",
        title: c.title || "Cap. " + c.number,
        onTap: "openChapter",
        arg: JSON.stringify({
          ref: c.ref,
          title: c.title,
          number: c.number,
          all: chs,
        }),
      });
    }
    if (chs.length > 80) {
      children.push({
        type: "Text",
        text: "… +" + (chs.length - 80) + " más (usa el listado de Kino para todos)",
        style: "caption",
      });
    }
  }

  const sections = st.sections || [];
  for (let s = 0; s < sections.length; s++) {
    const sec = sections[s];
    children.push({ type: "Text", text: sec.title || "Resultados", style: "h3" });
    const items = sec.items || [];
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      children.push({
        type: "ListTile",
        title: it.title,
        subtitle: it.kind || "",
        leading: it.poster
          ? { type: "Image", url: it.poster, width: 40, height: 56, fit: "cover" }
          : undefined,
        onTap: "openWork",
        arg: it.ref,
      });
    }
  }

  if (!st.workTitle && !sections.length && !st.searchError) {
    children.push({
      type: "Text",
      text:
        lang === "en"
          ? "Search above, or open titles from Home / search in Kino."
          : "Busca arriba, o abre títulos desde Inicio / búsqueda de Kino.",
      style: "caption",
    });
  }

  return {
    type: "Scaffold",
    appBar: {
      type: "AppBar",
      mergeWithKinoBar: true,
      dense: true,
      title: "Capibara",
      leading: {
        type: "IconButton",
        icon: "close",
        labelText: "Cerrar",
        labelTextEn: "Close",
        onPressed: { close: true },
      },
    },
    body: {
      type: "SingleChildScrollView",
      padding: { compact: 12, expanded: 24 },
      children: children,
    },
  };
}

export async function screenEvent({ name, arg, state, lang }) {
  const st = state || {};

  if (name === "open") {
    return { state: { sections: [], workTitle: null, chapters: [] } };
  }

  if (name === "doSearch") {
    const q = String((st.inputs && st.inputs.q) || "").trim();
    if (!q) {
      return { toast: lang === "en" ? "Type a title" : "Escribe un título" };
    }
    try {
      const items = await search({ q: q });
      return {
        state: {
          sections: [
            {
              title: (lang === "en" ? "Results: " : "Resultados: ") + q,
              items: items.map(function (it) {
                return { title: it.title, poster: it.poster, ref: it.ref, kind: it.kind };
              }),
            },
          ],
          workTitle: null,
          chapters: [],
        },
      };
    } catch (e) {
      return { state: { searchError: (e && e.message) || "Error de búsqueda" } };
    }
  }

  if (name === "openWork") {
    const ref = String(arg || "");
    try {
      const ep = await episodes(ref);
      // lista ordenada ascendente (1 → N) para lectura secuencial
      const chapters = (ep.episodes || []).map(function (c) {
        return {
          title: c.title || "Cap. " + c.number,
          number: c.number,
          ref: c.ref,
        };
      });
      const parsed = parseRef(ref);
      return {
        state: {
          workTitle: (ep.series && ep.series.title) || ref,
          workOverview: (ep.series && ep.series.overview) || "",
          workSlug: (parsed && parsed.slug) || "",
          workOrg: (parsed && parsed.org) || "",
          workRef: ref,
          chapters: chapters,
        },
      };
    } catch (e) {
      return {
        toast: (e && e.userMessage) || (e && e.message) || "No se pudo abrir",
      };
    }
  }

  if (name === "openChapter") {
    let payload = {};
    try {
      payload = typeof arg === "string" ? JSON.parse(arg) : arg || {};
    } catch (_) {
      payload = { ref: String(arg) };
    }
    const p = parseRef(payload.ref || "");
    if (!p || p.kind !== "chapter") {
      return { toast: "Capítulo inválido" };
    }
    const baseState = {
      readerTitle: payload.title || "Cap. " + p.number,
      readerLoading: true,
      readerError: null,
      pages: [],
      readerOrg: p.org || st.workOrg || "",
      readerSlug: p.slug || st.workSlug || "",
      readerNumber: p.number,
      readerAll: payload.all || st.chapters || [],
      prevCh: null,
      nextCh: null,
    };
    const loaded = await loadReaderPages(baseState);
    return {
      route: { push: "reader", params: {} },
      state: loaded.state || baseState,
    };
  }

  if (name === "readerPrev" || name === "readerNext") {
    const target = name === "readerPrev" ? st.prevCh : st.nextCh;
    if (!target) return { toast: lang === "en" ? "No more chapters" : "No hay más capítulos" };
    const baseState = {
      readerTitle: target.title || "Cap. " + target.number,
      readerLoading: true,
      readerError: null,
      pages: [],
      readerOrg: st.readerOrg,
      readerSlug: st.readerSlug,
      readerNumber: target.number,
      readerAll: st.readerAll || [],
      prevCh: null,
      nextCh: null,
    };
    const loaded = await loadReaderPages(baseState);
    return { state: loaded.state || baseState };
  }

  return null;
}
