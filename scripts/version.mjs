// Single source of truth for the runshot version. Bump it with each PR
// (0.1.<PR #>) in BOTH ../.claude-plugin/plugin.json (the Claude Code plugin
// manifest) and ./package.json (the npm package) — keep the two in sync.
// walkthrough.mjs stamps it into summary.json at capture time; gallery.mjs
// shows it in the footer — so a stale gallery vs the version that captured a
// run is visible side by side when debugging.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
let VERSION = "0.0.0";
// In-repo: read the plugin manifest. Published standalone (npx): plugin.json
// isn't shipped, so fall back to this package's own package.json.
for (const rel of [["..", ".claude-plugin", "plugin.json"], ["package.json"]]) {
  try {
    const v = JSON.parse(readFileSync(join(here, ...rel), "utf8")).version;
    if (v) { VERSION = v; break; }
  } catch { /* try next */ }
}

export { VERSION };
