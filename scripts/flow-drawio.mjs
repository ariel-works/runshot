#!/usr/bin/env node
// flow-drawio.mjs — turn a walkthrough run's manifest into an editable draw.io
// (diagrams.net) flow diagram. Same source of truth as the gallery canvas
// (each screen's flow:{col,row} grid in manifest.json), but emitted as mxGraph
// XML so humans can open, rearrange, annotate, restyle, and re-export it in the
// draw.io desktop/web app or the VS Code draw.io extension.
//
//   node flow-drawio.mjs <run-dir> [--out flow.drawio] [--device <name>] [--link]
//
//   <run-dir>     a walkthrough artifact dir containing manifest.json + screens/
//   --out         output path (default: <run-dir>/flow.drawio)
//   --device      which device's screenshots to embed (default: first device)
//   --link        reference screenshots by relative path instead of embedding
//                 base64 (smaller file, but only resolves next to the run dir)
//
// Used as a library too: `import { buildDrawioXml } from "./flow-drawio.mjs"`.
import { readFile, writeFile, readdir } from "node:fs/promises";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Layout constants mirror gallery.mjs so the draw.io diagram lands on the same
// grid as the hand-rolled canvas (col → x journey, row → y depth).
const GX = 90, GY = 60, PAD = 20, CAP = 36;
const cardWidthFor = (vw) => (vw >= 1000 ? 480 : 280);

const xmlEsc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const variantOf = (sc) => sc.variant || "Zero state";

// Distinct variants in first-seen order (matches the gallery's variant toggle).
function variantsOf(screens) {
  const vs = [];
  for (const sc of screens) { const v = variantOf(sc); if (!vs.includes(v)) vs.push(v); }
  return vs.length ? vs : ["Zero state"];
}

// Embed a screenshot as a draw.io image style. draw.io accepts either a data URI
// (self-contained, portable) or a relative URL (small file, resolves next to the
// run). Returns the `image=...` fragment, or null when the PNG is missing.
async function imageStyleFor(screensDir, deviceSub, label, embed) {
  const rel = `screens/${deviceSub}${label}.png`;
  if (!embed) return `image=${rel}`;
  try {
    const buf = await readFile(join(screensDir, "screens", deviceSub, `${label}.png`));
    return `image=data:image/png,${buf.toString("base64")}`;
  } catch {
    return null; // fall back to a plain box when the capture is absent
  }
}

// Build one <diagram> page (a single variant) of mxGraph XML.
async function buildPage({ screens, idxs, runDir, deviceSub, vw, vh, embed, name }) {
  const W = cardWidthFor(vw);
  const frameH = Math.round(W * (vh / vw));
  const cardH = frameH + CAP;

  const cols = idxs.map((i) => screens[i].flow?.col ?? 0);
  const rows = idxs.map((i) => screens[i].flow?.row ?? 0);
  const minCol = idxs.length ? Math.min(...cols) : 0;
  const minRow = idxs.length ? Math.min(...rows) : 0;
  const xOf = (i) => PAD + ((screens[i].flow?.col ?? 0) - minCol) * (W + GX);
  const yOf = (i) => PAD + ((screens[i].flow?.row ?? 0) - minRow) * (cardH + GY) + 40; // +40 for the title band

  const cells = [];
  // Title band so the page is self-describing when opened standalone.
  cells.push(`<mxCell id="title" value="${xmlEsc(name)}" style="text;html=1;fontSize=16;fontStyle=1;align=left;verticalAlign=middle;strokeColor=none;fillColor=none;" vertex="1" parent="1"><mxGeometry x="${PAD}" y="8" width="600" height="28" as="geometry"/></mxCell>`);

  const idOf = (i) => `n${i}`;
  for (let k = 0; k < idxs.length; k++) {
    const i = idxs[k];
    const sc = screens[i];
    const img = await imageStyleFor(runDir, deviceSub, sc.label, embed);
    const labelTxt = `${sc.route || sc.label}${sc.state ? `\n${sc.state}` : ""}`;
    // An image shape carries the screenshot; a rounded box stands in when missing.
    const style = img
      ? `shape=image;${img};imageAspect=0;aspect=fixed;verticalLabelPosition=bottom;verticalAlign=top;labelBackgroundColor=#ffffff;fontSize=12;`
      : `rounded=1;whiteSpace=wrap;html=1;verticalLabelPosition=bottom;verticalAlign=top;fillColor=#f5f5f5;strokeColor=#999999;fontSize=12;`;
    cells.push(`<mxCell id="${idOf(i)}" value="${xmlEsc(labelTxt)}" style="${style}" vertex="1" parent="1"><mxGeometry x="${xOf(i)}" y="${yOf(i)}" width="${W}" height="${frameH}" as="geometry"/></mxCell>`);
  }
  // Orthogonal edges between consecutive screens (the journey order), rounded
  // with an arrowhead — draw.io auto-routes them and they stay editable.
  for (let k = 0; k < idxs.length - 1; k++) {
    const a = idOf(idxs[k]), b = idOf(idxs[k + 1]);
    cells.push(`<mxCell id="e${k}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#297041;strokeWidth=2;endArrow=block;endFill=1;" edge="1" parent="1" source="${a}" target="${b}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
  }

  return `<diagram id="${xmlEsc(name).replace(/[^\w-]+/g, "_")}" name="${xmlEsc(name)}">` +
    `<mxGraphModel dx="1200" dy="800" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" math="0" shadow="0">` +
    `<root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join("")}</root></mxGraphModel></diagram>`;
}

// Build a full .drawio (mxfile) for a run — one page per variant of the chosen
// device. `manifest` is the parsed manifest.json; `runDir` locates screens/.
export async function buildDrawioXml({ manifest, runDir, device, embed = true }) {
  const screens = manifest?.screens || [];
  const devices = (manifest?.devices && manifest.devices.length) ? manifest.devices : [{ name: "", label: "screens" }];
  const dev = devices.find((d) => d.name === device) || devices[0];
  const deviceSub = dev.name ? dev.name + "/" : "";
  const vp = dev.viewport || { width: 393, height: 660 };

  const variants = variantsOf(screens);
  const pages = [];
  for (const v of variants) {
    const idxs = screens.map((sc, i) => [variantOf(sc), i]).filter(([vv]) => vv === v).map(([, i]) => i);
    const pageName = `${manifest?.appName ? manifest.appName + " · " : ""}${dev.label || dev.name || "screens"}${variants.length > 1 ? " · " + v : ""}`;
    pages.push(await buildPage({ screens, idxs, runDir, deviceSub, vw: vp.width, vh: vp.height, embed, name: pageName }));
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="runshot" type="device" version="21.0.0">${pages.join("")}</mxfile>\n`;
}

// Convenience: read a run dir, write <run-dir>/flow.drawio (or `out`). Returns
// the output path, or null if there's no usable manifest (caller decides).
export async function writeDrawioForRun(runDir, { out, device, embed = true } = {}) {
  let manifest;
  try { manifest = JSON.parse(await readFile(join(runDir, "manifest.json"), "utf8")); }
  catch { return null; }
  if (!manifest?.screens?.length) return null;
  const xml = await buildDrawioXml({ manifest, runDir, device, embed });
  const dest = out || join(runDir, "flow.drawio");
  await writeFile(dest, xml, "utf8");
  return dest;
}

// ---------- CLI ----------
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const runDir = argv.find((a) => !a.startsWith("--"));
  const flag = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? (argv[i + 1]?.startsWith("--") || argv[i + 1] === undefined ? true : argv[i + 1]) : undefined; };
  if (!runDir) {
    console.error("usage: node flow-drawio.mjs <run-dir> [--out flow.drawio] [--device <name>] [--link]");
    process.exit(1);
  }
  const out = flag("out") && flag("out") !== true ? flag("out") : undefined;
  const device = flag("device") && flag("device") !== true ? flag("device") : undefined;
  const embed = !flag("link");
  const dest = await writeDrawioForRun(runDir, { out, device, embed });
  if (!dest) { console.error(`flow-drawio: no screens in ${join(runDir, "manifest.json")}`); process.exit(1); }
  console.log(`✓ wrote ${dest}${embed ? " (screenshots embedded)" : " (linked screenshots)"}`);
}
