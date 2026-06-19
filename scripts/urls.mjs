// urls.mjs — central URL helpers for the runshot gallery hub.
//
// One source of truth for the deployment base path and canonical public URL, so
// every internal link, redirect, asset path, and API call works the same whether
// runshot is hosted at "/", under a sub-path like "/runshot", or on its own
// subdomain. Configured entirely from the environment:
//
//   BASE_PATH        URL prefix the app is mounted under. "/" (default) = no
//                    prefix; "/runshot" = everything lives under /runshot.
//   PUBLIC_BASE_URL  canonical external URL, already including the base path
//                    (e.g. https://your-machine.your-tailnet.ts.net/runshot). Used to
//                    build absolute URLs; falls back to relative when unset.
//
// All helpers are pure and read the normalized base path captured at import.

// Normalize a raw BASE_PATH into either "" (root, no prefix) or "/seg[/seg...]"
// with a leading slash and no trailing slash. "", "/", null, undefined → "".
export function normalizeBasePath(raw) {
  if (raw == null) return "";
  let p = String(raw).trim();
  if (p === "" || p === "/") return "";
  if (!p.startsWith("/")) p = "/" + p;
  return p.replace(/\/{2,}/g, "/").replace(/\/+$/, "");
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || "").replace(/\/+$/, "");

// The normalized base path ("" for root). Display callers should show "/" for "".
export function getBasePath() { return BASE_PATH; }

// Prefix a root-relative internal path with the base path. Preserves any query
// string / fragment, collapses accidental double slashes, and never returns ""
// ("/" at minimum). Already-absolute URLs (with a scheme) pass through untouched.
export function withBasePath(path = "/") {
  const s = String(path);
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(s)) return s; // leave absolute URLs alone
  const cut = s.search(/[?#]/);
  const pathPart = cut === -1 ? s : s.slice(0, cut);
  const suffix = cut === -1 ? "" : s.slice(cut);
  const lead = pathPart.startsWith("/") ? pathPart : "/" + pathPart;
  const joined = (BASE_PATH + lead).replace(/\/{2,}/g, "/");
  return (joined || "/") + suffix;
}

// URL for an app/project page (a top-level folder served by the hub). Always
// trailing-slashed so the run page's relative asset links resolve correctly.
export function appUrl(appSlug) {
  return withBasePath(`/${String(appSlug).replace(/^\/+/, "")}/`);
}

// URL for a same-origin API path (e.g. apiUrl("/api/health")).
export function apiUrl(path) {
  return withBasePath(String(path));
}

// Canonical absolute URL for a base-relative path. `path` must NOT include the
// base path — PUBLIC_BASE_URL already carries it. Falls back to a base-prefixed
// relative path when PUBLIC_BASE_URL is unset.
export function absoluteUrl(path = "/") {
  const lead = String(path).startsWith("/") ? String(path) : "/" + String(path);
  if (!PUBLIC_BASE_URL) return withBasePath(lead);
  return PUBLIC_BASE_URL + lead.replace(/^\/{2,}/, "/");
}

// Strip the base path from an incoming request path. Returns the internal,
// root-relative path (always starts with "/"), or null when the request is not
// under the configured base path (caller should 404). Query strings are handled
// by the caller; pass only the path component here.
export function stripBasePath(urlPath) {
  const p = urlPath || "/";
  if (!BASE_PATH) return p;
  if (p === BASE_PATH) return "/";
  if (p.startsWith(BASE_PATH + "/")) return p.slice(BASE_PATH.length) || "/";
  return null;
}
