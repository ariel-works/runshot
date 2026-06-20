#!/usr/bin/env node
// drawio.mjs — unit test for the draw.io flow generator (flow-drawio.mjs).
//
// Builds a .drawio from a throwaway fixture run (a tiny manifest + one real PNG)
// and asserts the mxGraph XML is well-formed: right page count, one image cell
// per screen, embedded screenshot, and orthogonal edges between consecutive
// screens. No GUI / draw.io binary needed.
//
//   node test/drawio.mjs
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { buildDrawioXml, writeDrawioForRun } from "../flow-drawio.mjs";

const here = dirname(fileURLToPath(import.meta.url));
let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? "✓" : "✗"} ${msg}`); if (!cond) failures++; };

// Smallest valid 1×1 PNG, so image embedding has real bytes to base64.
const PNG_1x1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMCAQDJ/0XmAAAAAElFTkSuQmCC",
  "base64",
);

const base = await mkdtemp(join(tmpdir(), "runshot-drawio-"));
try {
  const runDir = join(base, "run");
  await mkdir(join(runDir, "screens", "phone"), { recursive: true });
  const manifest = {
    appName: "Acme",
    devices: [{ name: "phone", label: "iPhone", viewport: { width: 393, height: 660 } }],
    screens: [
      { idx: 0, label: "00-welcome-default", route: "/welcome", state: "zero", flow: { col: 0, row: 0 }, variant: null },
      { idx: 1, label: "01-signup-default", route: "/signup", state: "form", flow: { col: 1, row: 0 }, variant: null },
      { idx: 2, label: "02-home-seeded", route: "/home", state: "seeded", flow: { col: 0, row: 0 }, variant: "Seeded" },
    ],
  };
  await writeFile(join(runDir, "manifest.json"), JSON.stringify(manifest));
  for (const sc of manifest.screens) await writeFile(join(runDir, "screens", "phone", `${sc.label}.png`), PNG_1x1);

  // --- library API: buildDrawioXml ---
  const xml = await buildDrawioXml({ manifest, runDir, device: "phone", embed: true });
  ok(xml.startsWith("<?xml"), "emits an XML declaration");
  ok(xml.includes("<mxfile"), "has an <mxfile> root");
  // Two variants ("Zero state" default for the first two, "Seeded" for the third) → two pages.
  ok((xml.match(/<diagram /g) || []).length === 2, "one <diagram> page per variant (2)");
  // Three screens → three image cells across the pages.
  ok((xml.match(/shape=image/g) || []).length === 3, "one image cell per screen (3)");
  ok(xml.includes("image=data:image/png,"), "screenshots embedded as base64 data URIs");
  // The default variant has 2 screens → exactly 1 connecting edge; Seeded has 1 screen → 0 edges.
  ok((xml.match(/edge="1"/g) || []).length === 1, "orthogonal edges only between consecutive same-variant screens (1)");
  ok(xml.includes("edgeStyle=orthogonalEdgeStyle"), "edges use orthogonal routing");
  ok(xml.includes("value=\"/welcome"), "node value carries the route");
  ok(xml.includes("Acme · iPhone"), "page title carries app + device");

  // --- linked (non-embedded) mode ---
  const linked = await buildDrawioXml({ manifest, runDir, device: "phone", embed: false });
  ok(linked.includes("image=screens/phone/00-welcome-default.png"), "linked mode references relative screenshot paths");
  ok(!linked.includes("data:image/png"), "linked mode embeds no base64");

  // --- missing screenshot degrades to a box, never throws ---
  const noShots = await buildDrawioXml({ manifest: { ...manifest, devices: [{ name: "ghost", label: "Ghost", viewport: { width: 400, height: 800 } }] }, runDir, device: "ghost", embed: true });
  ok((noShots.match(/rounded=1/g) || []).length >= 3, "missing screenshots fall back to boxes");

  // --- writeDrawioForRun writes the file and skips empty manifests ---
  const dest = await writeDrawioForRun(runDir, { device: "phone" });
  ok(dest === join(runDir, "flow.drawio"), "writeDrawioForRun returns the default flow.drawio path");
  const onDisk = await readFile(dest, "utf8");
  ok(onDisk.includes("<mxfile"), "flow.drawio written to disk");

  const emptyDir = join(base, "empty");
  await mkdir(emptyDir, { recursive: true });
  await writeFile(join(emptyDir, "manifest.json"), JSON.stringify({ screens: [], devices: [] }));
  ok((await writeDrawioForRun(emptyDir)) === null, "skips runs with no screens (returns null)");
} finally {
  await rm(base, { recursive: true, force: true });
}

console.log(failures === 0 ? "\nAll draw.io checks passed." : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);
