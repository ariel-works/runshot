#!/usr/bin/env node
// smoke.mjs — base-path smoke test for the runshot gallery hub.
//
// Verifies the URL helpers plus the live server under both root and sub-path
// hosting, against a throwaway fixture base (no dependency on the user's repos):
//
//   node test/smoke.mjs
//
// Exits non-zero on the first failure so it can gate CI.
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeBasePath } from "../urls.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const gallery = join(here, "..", "gallery.mjs");
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++; };

// --- 1. Pure helper: normalizeBasePath ---
ok(normalizeBasePath("/") === "", 'normalizeBasePath("/") → ""');
ok(normalizeBasePath("") === "", 'normalizeBasePath("") → ""');
ok(normalizeBasePath(undefined) === "", "normalizeBasePath(undefined) → \"\"");
ok(normalizeBasePath("/runshot") === "/runshot", 'normalizeBasePath("/runshot") → "/runshot"');
ok(normalizeBasePath("runshot") === "/runshot", 'normalizeBasePath("runshot") → "/runshot"');
ok(normalizeBasePath("/runshot/") === "/runshot", 'normalizeBasePath("/runshot/") → "/runshot"');
ok(normalizeBasePath("//runshot//") === "/runshot", 'normalizeBasePath("//runshot//") → "/runshot"');

// --- fixture: a fake project "heirlooming" with one run ---
const base = await mkdtemp(join(tmpdir(), "runshot-smoke-"));
const runDir = join(base, "heirlooming", "runshot", "artifacts", "2026-06-19T00-00-00-000Z");
await mkdir(runDir, { recursive: true });
await writeFile(join(runDir, "summary.json"), JSON.stringify({ ok: true, ranAt: "2026-06-19T00:00:00.000Z", runNumber: 1, stepsRun: 0 }));
await writeFile(join(runDir, "manifest.json"), JSON.stringify({ screens: [], devices: [] }));

// pick a high, unlikely-busy port per mode
async function withServer(env, fn) {
  const child = spawn(process.execPath, [gallery, "--serve", "--base", base], {
    env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });
  try {
    // wait for the listening log line (or bail after ~5s)
    await new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error(`server did not start:\n${out}`)), 5000);
      const iv = setInterval(() => { if (/listening locally/i.test(out)) { clearTimeout(t); clearInterval(iv); res(); } }, 50);
      child.on("exit", (c) => { clearTimeout(t); clearInterval(iv); rej(new Error(`server exited (${c}):\n${out}`)); });
    });
    return await fn(out);
  } finally {
    child.kill("SIGKILL");
  }
}

const get = async (port, path) => {
  const r = await fetch(`http://127.0.0.1:${port}${path}`);
  return { status: r.status, body: await r.text(), ct: r.headers.get("content-type") || "" };
};

try {
  // --- 2. Sub-path mode: BASE_PATH=/runshot ---
  const PORT = "8231";
  await withServer({ PORT, BASE_PATH: "/runshot", PUBLIC_BASE_URL: "https://your-machine.your-tailnet.ts.net/runshot" }, async (log) => {
    ok(/Base path: \/runshot/.test(log), "startup logs `Base path: /runshot`");
    ok(/Public URL: https:\/\/your-machine\.your-tailnet\.ts\.net\/runshot/.test(log), "startup logs the Public URL");
    ok(/listening locally at http:\/\/127\.0\.0\.1:8231\/runshot/.test(log), "startup logs local URL with base path");

    const hub = await get(PORT, "/runshot");
    ok(hub.status === 200, "GET /runshot → 200");
    ok(hub.body.includes('href="/runshot/heirlooming/"'), "hub links app under base path (/runshot/heirlooming/)");
    ok(!/href="\/heirlooming\/"/.test(hub.body), "hub never emits a base-escaping href=\"/heirlooming/\"");

    ok((await get(PORT, "/runshot/")).status === 200, "GET /runshot/ → 200");
    ok((await get(PORT, "/runshot/heirlooming")).status === 200, "GET /runshot/heirlooming → 200");
    ok((await get(PORT, "/runshot/heirlooming/")).status === 200, "GET /runshot/heirlooming/ → 200");

    const health = await get(PORT, "/runshot/api/health");
    ok(health.status === 200 && /application\/json/.test(health.ct), "GET /runshot/api/health → 200 JSON");
    let hj = {}; try { hj = JSON.parse(health.body); } catch {}
    ok(hj.ok === true && hj.basePath === "/runshot", "health reports ok + basePath /runshot");

    // requests outside the base path must 404, not leak
    ok((await get(PORT, "/")).status === 404, "GET / (outside base) → 404");
    ok((await get(PORT, "/heirlooming")).status === 404, "GET /heirlooming (outside base) → 404");
  });

  // --- 3. Root mode: BASE_PATH=/ ---
  const PORT2 = "8232";
  await withServer({ PORT: PORT2, BASE_PATH: "/", PUBLIC_BASE_URL: "http://localhost:8232" }, async (log) => {
    ok(/Base path: \//.test(log), "root mode logs `Base path: /`");
    const hub = await get(PORT2, "/");
    ok(hub.status === 200, "root: GET / → 200");
    ok(hub.body.includes('href="/heirlooming/"'), "root: hub links app at /heirlooming/");
    ok((await get(PORT2, "/api/health")).status === 200, "root: GET /api/health → 200");
    ok((await get(PORT2, "/heirlooming")).status === 200, "root: GET /heirlooming → 200");
  });
} finally {
  await rm(base, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll smoke checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
