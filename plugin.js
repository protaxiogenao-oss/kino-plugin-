// Capibara Traductor — Kino plugin v3.0.2
// Autor: Hotaru Yume (hotaruyume)
// Lector de mangas SOLO por pantalla (como Yuri Online).
// v3.0.1 — arreglo carga Inicio y buscador:
//   - every siempre activo en la raíz (como Yuri)
//   - búsqueda: parsea /org/manga/slug; lee q desde ev.value
//   - AppBar simple (sin barra duplicada)
//   - open carga el catálogo al instante (every solo como respaldo)

const BASE = "https://capibaratraductor.com";
const MAX_CAPS = 490;

// ===================== Descifrado ph / ls =====================
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
  if (!ls || !Array.isArray(pages) || !pages.length) return pages;
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

// ===================== Red / helpers =====================
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
    throw kino.error("unavailable", "HTTP " + r.status, {
      userMessage: "Capibara no respondió (" + r.status + ").",
    });
  }
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw kino.error("unavailable", "JSON", { userMessage: "Respuesta inválida de Capibara." });
  }
  if (j && j.status === false) {
    throw kino.error("unavailable", j.message || "API", {
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
    .replace(/\s+/g, " ")
    .trim();
}

function isNovelType(t) {
  const s = String(t || "").toLowerCase();
  return s.indexOf("novel") !== -1 || s === "novela" || s === "novela_ligera";
}

function parseOrgSlugFromUrl(url) {
  const m = String(url || "").match(/\/([a-z0-9][a-z0-9-]*)\/manga\/([a-z0-9][a-z0-9-]*)/i);
  if (!m) return null;
  return { org: m[1], slug: m[2] };
}

function orgOf(item) {
  if (item.organization && item.organization.slug) return item.organization.slug;
  if (item.scanSlug) return item.scanSlug;
  const fromUrl = parseOrgSlugFromUrl(item.url || item.mangaUrl || "");
  if (fromUrl) return fromUrl.org;
  return "";
}
function slugOf(item) {
  if (item.manga && item.manga.slug) return item.manga.slug;
  if (item.mangaSlug) return item.mangaSlug;
  if (item.slug) return item.slug;
  const fromUrl = parseOrgSlugFromUrl(item.url || item.mangaUrl || "");
  if (fromUrl) return fromUrl.slug;
  return "";
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

function workKey(org, slug) {
  return String(org || "") + "|" + String(slug || "");
}
function parseWorkKey(key) {
  const i = String(key || "").indexOf("|");
  if (i < 0) return { org: "", slug: key || "" };
  return { org: key.slice(0, i), slug: key.slice(i + 1) };
}

function cardFromFeatured(f) {
  const org = f.scanSlug || "";
  const slug = f.mangaSlug || "";
  if (!org || !slug) return null;
  return {
    key: workKey(org, slug),
    org: org,
    slug: slug,
    title: clean(f.title || slug),
    poster: f.cover || "",
    scan: f.scanName || org,
  };
}
function cardFromWork(w) {
  const typeCode =
    (w.manga && w.manga.bookType && w.manga.bookType.code) || w.workType || w.type || "";
  if (isNovelType(typeCode)) return null;
  const org = orgOf(w);
  const slug = slugOf(w);
  if (!slug) return null;
  return {
    key: workKey(org, slug),
    org: org,
    slug: slug,
    title: titleOf(w),
    poster: posterOf(w),
    scan: (w.organization && w.organization.name) || w.scanName || org,
  };
}

function getJson(k, fallback) {
  try {
    const v = kino.storage.get(k);
    return v ? JSON.parse(v) : fallback;
  } catch (_) {
    return fallback;
  }
}
function setJson(k, val) {
  try {
    kino.storage.set(k, JSON.stringify(val));
  } catch (_) {}
}

function chaptersDe(key) {
  const c = getJson("serie:" + key, null);
  return c && Array.isArray(c.chapters) ? c.chapters : [];
}
function metaDe(key) {
  const c = getJson("serie:" + key, null);
  return (c && c.meta) || {};
}

// ===================== Carga de datos =====================
async function loadFeatured() {
  const j = await api("/api/landing/featured-manga?limit=24&page=1&nsfw=false&sort=daily&mix=1");
  return (j.data || []).map(cardFromFeatured).filter(Boolean);
}
async function loadMangaList(order, page) {
  const j = await api(
    "/api/manga-custom?order=" + order + "&limit=24&page=" + (page || 1) + "&nsfw=false"
  );
  const items = ((j.data && j.data.items) || []).map(cardFromWork).filter(Boolean);
  return items;
}
async function loadSearch(q) {
  const j = await api("/api/search?q=" + encodeURIComponent(q) + "&limit=40&nsfw=false");
  const obras =
    (j.data && (j.data.obras || j.data.items || j.data.results)) || j.data || [];
  const list = Array.isArray(obras) ? obras : [];
  return list.map(cardFromWork).filter(Boolean);
}

async function loadWorkDetail(org, slug) {
  const j = await api("/api/manga-custom/" + encodeURIComponent(slug), org);
  const data = j.data || j;
  const chapters = (data.chapters || [])
    .filter(function (c) {
      return !c.isUnreleased && !c.hiddenAt && !c.deletedAt;
    })
    .sort(function (a, b) {
      return Number(a.number) - Number(b.number);
    })
    .map(function (c) {
      return {
        number: c.number,
        title: clean(c.title || "Cap. " + c.number),
        releasedAt: c.releasedAt ? String(c.releasedAt).slice(0, 10) : "",
      };
    });
  let list = chapters;
  if (list.length > MAX_CAPS) list = list.slice(list.length - MAX_CAPS);
  const meta = {
    title: titleOf(data),
    poster: posterOf(data),
    overview: clean(data.shortDescription || data.description || "").slice(0, 800),
    org: org || orgOf(data),
    slug: slug || slugOf(data),
    scan: (data.organization && data.organization.name) || org || "",
  };
  const key = workKey(meta.org, meta.slug);
  setJson("serie:" + key, { meta: meta, chapters: list, ts: Date.now() });
  try {
    const ks = kino.storage.keys().filter(function (k) {
      return k.indexOf("serie:") === 0;
    });
    if (ks.length > 12) {
      for (let i = 0; i < ks.length - 12; i++) kino.storage.remove(ks[i]);
    }
  } catch (_) {}
  return { key: key, meta: meta, chapters: list };
}

async function loadChapterImages(org, slug, number) {
  const path =
    "/api/manga-custom/" +
    encodeURIComponent(slug) +
    "/chapter/" +
    encodeURIComponent(number) +
    "/pages";
  const body = await api(path, org);
  const decrypted = await decryptPagesPayload(body);
  const urls = [];
  for (let i = 0; i < decrypted.length; i++) {
    const u = decrypted[i].imageUrl || decrypted[i].url;
    if (u) urls.push(u);
  }
  return urls;
}

// ===================== UI helpers =====================
const TABS = [
  { value: "inicio", label: "Inicio", labelEn: "Home" },
  { value: "buscar", label: "Buscar", labelEn: "Search" },
];

function pagesDisponible() {
  try {
    return (
      typeof kino === "object" &&
      kino !== null &&
      typeof kino.screen === "object" &&
      kino.screen !== null &&
      Array.isArray(kino.screen.widgets) &&
      kino.screen.widgets.indexOf("pages") >= 0
    );
  } catch (e) {
    return false;
  }
}

function titleCard(it) {
  return {
    type: "Card",
    key: "c-" + String(it.key).replace(/[^a-z0-9]/gi, "-"),
    flush: true,
    onTap: "openWork",
    arg: it.key,
    children: [
      {
        type: "Image",
        url: it.poster || "",
        aspect: "2:3",
        fit: "cover",
        fallback: {
          type: "Column",
          padding: 16,
          crossAxisAlignment: "center",
          children: [{ type: "Icon", name: "list", color: "muted" }],
        },
      },
      {
        type: "Text",
        text: it.title,
        style: "caption",
        maxLines: 2,
        padding: 8,
      },
    ],
  };
}

function railSkeleton(prefix) {
  const sk = [];
  for (let i = 0; i < 6; i++) {
    sk.push({
      type: "Card",
      key: prefix + "sk" + i,
      flush: true,
      children: [
        { type: "Skeleton", shape: "block", width: 120, height: 180 },
        { type: "Skeleton", shape: "line", padding: 8 },
      ],
    });
  }
  return {
    type: "SingleChildScrollView",
    key: prefix + "skrail",
    direction: "horizontal",
    padding: 12,
    children: [{ type: "Row", gap: 8, children: sk }],
  };
}

function railOf(items, prefix, loading) {
  if (!items || !items.length) {
    if (loading) return railSkeleton(prefix);
    return {
      type: "Text",
      text: "Nada por aquí.",
      textEn: "Nothing here.",
      color: "muted",
      padding: 16,
    };
  }
  return {
    type: "SingleChildScrollView",
    key: prefix + "rail",
    direction: "horizontal",
    padding: 12,
    children: [
      {
        type: "Row",
        gap: 8,
        children: items.slice(0, 24).map(function (it) {
          return {
            type: "SizedBox",
            width: 120,
            children: [titleCard(it)],
          };
        }),
      },
    ],
  };
}

function gridOf(items) {
  if (!items || !items.length) {
    return {
      type: "emptyState",
      icon: "search",
      title: "Sin resultados.",
      titleEn: "No results.",
    };
  }
  return {
    type: "Row",
    wrap: true,
    gap: 8,
    padding: 12,
    children: items.slice(0, 40).map(function (it) {
      return {
        type: "SizedBox",
        span: { compact: 6, medium: 4, expanded: 3 },
        children: [titleCard(it)],
      };
    }),
  };
}

// ===================== Árboles =====================
function homeTree(state) {
  const children = [];
  if (state.homeError) {
    children.push({
      type: "Text",
      text: state.homeError,
      color: "error",
      padding: 16,
    });
    children.push({
      type: "ElevatedButton",
      key: "retryHome",
      labelText: "Reintentar",
      labelTextEn: "Retry",
      onPressed: "retryHome",
      margin: 16,
    });
  }
  children.push({
    type: "Text",
    text: "Destacados",
    style: "h3",
    padding: { left: 16, top: 12, right: 16 },
  });
  const loading = !(state.homeLoaded);
  children.push(railOf(state.featured || [], "feat", loading));
  children.push({
    type: "Text",
    text: "Últimos",
    style: "h3",
    padding: { left: 16, top: 16, right: 16 },
  });
  children.push(railOf(state.latest || [], "lat", loading));
  children.push({
    type: "Text",
    text: "Populares",
    style: "h3",
    padding: { left: 16, top: 16, right: 16 },
  });
  children.push(railOf(state.popular || [], "pop", loading));
  if (state.homeLoaded && !(state.featured || []).length && !state.homeError) {
    children.push({
      type: "ElevatedButton",
      key: "retryHome2",
      labelText: "Recargar catálogo",
      labelTextEn: "Reload catalog",
      onPressed: "retryHome",
      margin: 16,
    });
  }

  return {
    type: "Scaffold",
    every: { ms: 1200, event: "cargarHome" },
    appBar: {
      title: "Capibara",
      actions: [
        {
          type: "IconButton",
          icon: "search",
          key: "goSearch",
          labelText: "Buscar",
          labelTextEn: "Search",
          onPressed: { event: "goSearch" },
        },
      ],
      bottom: {
        type: "TabBar",
        key: "tabs",
        tabs: TABS,
        value: state.tab || "inicio",
        onChanged: { event: "tab" },
      },
    },
    body: {
      type: "SingleChildScrollView",
      key: "homeBody",
      children: [{ type: "Column", children: children }],
    },
  };
}

function searchTree(state) {
  const q = typeof state.resultsQ === "string" ? state.resultsQ : "";
  const results = Array.isArray(state.results) ? state.results : null;
  return {
    type: "Scaffold",
    appBar: {
      title: "Buscar manga",
      titleEn: "Search manga",
      actions: [],
    },
    body: {
      type: "SingleChildScrollView",
      key: "searchBody",
      children: [
        {
          type: "Column",
          children: [
            {
              type: "Form",
              key: "search",
              onSubmitted: "doSearch",
              gap: 8,
              padding: 16,
              children: [
                {
                  type: "TextField",
                  key: "q",
                  kind: "search",
                  value: q,
                  labelText: "Título",
                  labelTextEn: "Title",
                  hintText: "P. ej. Chainsaw Man",
                  required: true,
                },
                {
                  type: "ElevatedButton",
                  icon: "search",
                  labelText: "Buscar",
                  labelTextEn: "Search",
                  submit: true,
                },
              ],
            },
            results
              ? results.length
                ? gridOf(results)
                : {
                    type: "emptyState",
                    icon: "search",
                    title: "Sin resultados.",
                    titleEn: "No results.",
                  }
              : {
                  type: "Text",
                  text: "Escribe un título y pulsa Buscar.",
                  textEn: "Type a title and press Search.",
                  color: "muted",
                  padding: 16,
                },
          ],
        },
      ],
    },
  };
}

function detailTree(state) {
  const d = state.detail || {};
  const meta = d.meta || {};
  const chapters = Array.isArray(d.chapters) ? d.chapters : chaptersDe(d.key);
  const items = [];

  items.push({
    type: "Row",
    gap: 12,
    padding: 16,
    crossAxisAlignment: "start",
    children: [
      {
        type: "SizedBox",
        width: 110,
        children: [
          {
            type: "Image",
            url: meta.poster || "",
            aspect: "2:3",
            fit: "cover",
          },
        ],
      },
      {
        type: "Column",
        flex: 1,
        gap: 6,
        children: [
          { type: "Text", text: meta.title || d.slug || "", style: "h3" },
          meta.scan
            ? { type: "Text", text: meta.scan, style: "caption", color: "muted" }
            : null,
          {
            type: "Text",
            text: chapters.length + " capítulos",
            textEn: chapters.length + " chapters",
            style: "caption",
          },
        ].filter(Boolean),
      },
    ],
  });

  if (meta.overview) {
    items.push({
      type: "Text",
      text: meta.overview,
      style: "body",
      padding: { left: 16, right: 16, bottom: 8 },
    });
  }

  if (d.loading) {
    items.push({ type: "Skeleton", height: 24, margin: 16 });
    items.push({ type: "Skeleton", height: 24, margin: 16 });
    items.push({ type: "Skeleton", height: 24, margin: 16 });
  } else if (!chapters.length) {
    items.push({
      type: "emptyState",
      icon: "list",
      title: "Sin capítulos publicados.",
      titleEn: "No published chapters.",
    });
  } else {
    for (let i = 0; i < chapters.length; i++) {
      const c = chapters[i];
      items.push({
        type: "ListTile",
        key: "ch-" + c.number,
        title: c.title || "Cap. " + c.number,
        subtitle: c.releasedAt || undefined,
        onTap: "read",
        arg: String(i),
      });
    }
  }

  return {
    type: "Scaffold",
    every: d.loading ? { ms: 600, event: "cargarDetalle" } : undefined,
    appBar: {
      title: (meta.title || "Manga").slice(0, 40),
      actions: [],
    },
    body: { type: "ListView", key: "detailBody", items: items },
  };
}

let navSeq = 0;

function readerTree(state) {
  const r = state.reader;
  if (!r || !r.imgs || !r.imgs.length) {
    return {
      type: "Scaffold",
      body: {
        type: "emptyState",
        icon: "image",
        title: "Sin páginas",
        titleEn: "No pages",
      },
    };
  }
  const chapters = chaptersDe(r.key) || [];
  const pages = r.imgs;
  const puedePages = pagesDisponible() && pages.length >= 2 && pages.length <= 250;
  const modo = puedePages && getJson("modoLector", "tira") === "paginas" ? "paginas" : "tira";
  const pre = "r" + (r.tk || 0) + "-";

  function pageImg(url, i) {
    return {
      type: "Image",
      key: pre + "p" + i,
      url: url,
      fit: "width",
      fill: true,
      alt: "Página " + (i + 1),
    };
  }

  const finCard = {
    type: "Card",
    key: "finCap",
    margin: 12,
    padding: 12,
    gap: 8,
    children: [
      {
        type: "Text",
        text: "Capítulo " + (r.idx + 1) + " de " + (chapters.length || "?"),
        textEn: "Chapter " + (r.idx + 1) + " of " + (chapters.length || "?"),
        style: "caption",
        color: "muted",
      },
      {
        type: "Row",
        gap: 8,
        children: [
          {
            type: "ElevatedButton",
            key: "prev",
            icon: "arrow_back",
            labelText: "Anterior",
            labelTextEn: "Previous",
            onPressed: "prevChap",
            flex: 1,
            enabled: r.idx > 0,
          },
          {
            type: "ElevatedButton",
            key: "next",
            icon: "arrow_forward",
            labelText: "Siguiente",
            labelTextEn: "Next",
            onPressed: "nextChap",
            flex: 1,
            enabled: r.idx + 1 < chapters.length,
          },
        ],
      },
      pagesDisponible()
        ? {
            type: "TextButton",
            labelText: modo === "paginas" ? "Modo tira" : "Modo páginas",
            labelTextEn: modo === "paginas" ? "Strip mode" : "Page mode",
            onPressed: "modoLector",
          }
        : null,
    ].filter(Boolean),
  };

  const body = [];
  if (modo === "paginas") {
    body.push({
      type: "pages",
      key: "pgs-" + (r.tk || 0),
      flex: 1,
      position: "bar",
      children: pages.map(function (u, i) {
        return {
          type: "SingleChildScrollView",
          key: pre + "z" + i,
          zoom: true,
          children: [pageImg(u, i)],
        };
      }),
    });
    body.push(finCard);
  } else {
    body.push({
      type: "SingleChildScrollView",
      key: "strip-" + (r.tk || 0),
      flex: 1,
      zoom: true,
      children: [
        {
          type: "Column",
          gap: 4,
          crossAxisAlignment: "center",
          fill: true,
          children: pages
            .map(function (u, i) {
              return pageImg(u, i);
            })
            .concat([finCard]),
        },
      ],
    });
  }

  return {
    type: "Scaffold",
    appBar: {
      title: (r.chTitle || "Capítulo").slice(0, 40),
      actions: [],
    },
    body: { type: "Column", children: body },
  };
}

// ===================== Exports =====================
export async function screen({ state, route }) {
  const r = route || { name: "main" };
  const st = state || {};
  try {
    if (r.name === "detail") return detailTree(st);
    if (r.name === "read") return readerTree(st);
    if (r.name === "search") return searchTree(st);
  } catch (e) {
    return {
      type: "Scaffold",
      body: {
        type: "errorState",
        title: "Error",
        message: (e && (e.userMessage || e.message)) || "Error",
      },
    };
  }
  return homeTree(st);
}

export async function screenEvent(ev) {
  const name = ev.name;
  const state = ev.state || {};
  try {
    if (name === "open") {
      // Carga inmediata al abrir (no depender solo del every)
      if (state.homeLoaded && (state.featured || []).length) {
        return { state: { tab: state.tab || "inicio" } };
      }
      try {
        const featured = await loadFeatured();
        const latest = await loadMangaList("latest", 1);
        const popular = await loadMangaList("popular", 1);
        kino.log(
          "open-home",
          "f=" + featured.length + " l=" + latest.length + " p=" + popular.length
        );
        return {
          state: {
            tab: state.tab || "inicio",
            featured: featured,
            latest: latest,
            popular: popular,
            homeLoaded: true,
            homeError: null,
          },
        };
      } catch (e) {
        kino.log("open-home", (e && (e.message || e.code)) || "error");
        return {
          state: {
            tab: state.tab || "inicio",
            homeLoaded: true,
            homeError:
              (e && e.userMessage) ||
              (e && e.message) ||
              "Error al cargar. ¿Aprobaste el host capibaratraductor.com?",
          },
        };
      }
    }

    if (name === "tab") {
      const v = ev.value != null ? ev.value : ev.arg;
      if (v === "buscar") {
        return { route: { push: "search" }, state: { tab: "buscar" } };
      }
      return { state: { tab: "inicio" } };
    }

    if (name === "goSearch") {
      return { route: { push: "search" } };
    }

    if (name === "retryHome") {
      return {
        state: {
          homeLoaded: false,
          featured: [],
          latest: [],
          popular: [],
          homeError: null,
        },
      };
    }

    if (name === "cargarHome") {
      if (state.homeLoaded && (state.featured || []).length) return null;
      try {
        const featured = await loadFeatured();
        const latest = await loadMangaList("latest", 1);
        const popular = await loadMangaList("popular", 1);
        kino.log(
          "home",
          "ok f=" + featured.length + " l=" + latest.length + " p=" + popular.length
        );
        return {
          state: {
            featured: featured,
            latest: latest,
            popular: popular,
            homeLoaded: true,
            homeError: null,
          },
        };
      } catch (e) {
        kino.log("home", (e && (e.message || e.code)) || "error");
        return {
          state: {
            homeLoaded: true,
            homeError: (e && e.userMessage) || (e && e.message) || "Error al cargar el inicio",
          },
        };
      }
    }

    if (name === "doSearch") {
      const q = String(
        (ev.value && ev.value.q) ||
          (state.inputs && state.inputs.q) ||
          state.resultsQ ||
          ""
      ).trim();
      if (!q) return { toast: "Escribe un título" };
      try {
        const results = await loadSearch(q);
        kino.log("search", q + " → " + results.length);
        return {
          state: { results: results, resultsQ: q },
          toast: results.length ? results.length + " resultados" : "Sin resultados",
        };
      } catch (e) {
        return {
          toast: (e && e.userMessage) || (e && e.message) || "Error de búsqueda",
        };
      }
    }

    if (name === "openWork") {
      const key = String(ev.arg || "");
      const p = parseWorkKey(key);
      if (!p.slug) return { toast: "Obra inválida" };
      return {
        route: { push: "detail", params: { key: key } },
        state: {
          detail: {
            key: key,
            org: p.org,
            slug: p.slug,
            loading: true,
            meta: { title: "", poster: "", org: p.org, slug: p.slug },
            chapters: [],
          },
        },
      };
    }

    if (name === "cargarDetalle") {
      const d = state.detail;
      if (!d || !d.loading) return null;
      try {
        const loaded = await loadWorkDetail(d.org, d.slug);
        return {
          state: {
            detail: {
              key: loaded.key,
              org: loaded.meta.org,
              slug: loaded.meta.slug,
              loading: false,
              meta: loaded.meta,
              chapters: loaded.chapters,
            },
          },
        };
      } catch (e) {
        return {
          state: {
            detail: Object.assign({}, d, { loading: false, chapters: [] }),
          },
          toast: (e && e.userMessage) || (e && e.message) || "No se pudo cargar",
        };
      }
    }

    if (name === "read" || name === "nextChap" || name === "prevChap") {
      let key, chapters, idx, meta;
      if (name === "read") {
        const d = state.detail;
        if (!d) return null;
        key = d.key;
        chapters = d.chapters && d.chapters.length ? d.chapters : chaptersDe(key);
        idx = parseInt(String(ev.arg || "0"), 10) || 0;
        meta = d.meta || metaDe(key);
        if (idx < 0 || idx >= chapters.length) return null;
      } else {
        const r = state.reader;
        if (!r) return null;
        key = r.key;
        chapters = chaptersDe(key) || [];
        idx = r.idx + (name === "nextChap" ? 1 : -1);
        meta = { title: r.title, poster: r.poster, org: r.org, slug: r.slug };
        if (idx >= chapters.length) return { toast: "Ya estás en el último capítulo" };
        if (idx < 0) return { toast: "Ya estás en el primer capítulo" };
      }
      const ch = chapters[idx];
      const org = meta.org || parseWorkKey(key).org;
      const slug = meta.slug || parseWorkKey(key).slug;
      let imgs;
      try {
        imgs = await loadChapterImages(org, slug, ch.number);
      } catch (e) {
        return {
          toast: (e && e.userMessage) || (e && e.message) || "No se pudieron cargar las páginas",
        };
      }
      if (!imgs.length) return { toast: "Sin páginas en este capítulo" };
      const reader = {
        key: key,
        org: org,
        slug: slug,
        title: meta.title || slug,
        poster: meta.poster || "",
        idx: idx,
        chTitle: ch.title || "Cap. " + ch.number,
        chNumber: ch.number,
        imgs: imgs,
        tk: ++navSeq,
      };
      const resp = { state: { reader: reader } };
      if (name === "read") resp.route = { push: "read" };
      return resp;
    }

    if (name === "modoLector") {
      if (!pagesDisponible()) return null;
      const nuevo = getJson("modoLector", "tira") === "paginas" ? "tira" : "paginas";
      setJson("modoLector", nuevo);
      return {
        state: { _r: Date.now() },
        toast: nuevo === "paginas" ? "Modo páginas" : "Modo tira",
      };
    }
  } catch (e) {
    return { toast: "Algo falló: " + ((e && e.code) || (e && e.message) || "error") };
  }
  return null;
}
