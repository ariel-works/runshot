---
name: walkthrough
disable-model-invocation: true
description: >-
  Record a full "new user" onboarding walkthrough of a web app in a mobile
  browser viewport, capturing a video plus screenshots of every screen and any
  emails the flow triggers. Use when the user asks to "record a walkthrough",
  "do an onboarding video", "test onboarding on mobile", "preview the signup
  emails", or wants a watchable QA artifact of a fresh-account flow. This is for
  producing a human-reviewable artifact, NOT a pass/fail merge gate (that runs in
  CI with the same script in assert mode). Invoke explicitly — do not trigger
  this on your own, because it launches a browser and creates real accounts/emails.
---

# Onboarding Walkthrough (mobile)

Drives a fresh-account onboarding flow against a running app in a mobile
viewport, records the session as a video, screenshots each screen (including its
zero-state), and captures any emails the flow sends. Everything is config-driven
so the same procedure works for any app — the per-app specifics live in that
app's `qa/skills.config.json` (the `walkthrough` section).

## When NOT to run
- The user only wants a yes/no "did the flow pass?" → that's the CI gate
  (`scripts/walkthrough.mjs --mode=assert`), not this skill.
- No app is running and no `baseUrl` is reachable → ask which environment
  (local `http://localhost:3000`, a Vercel preview URL, or staging) first.

## Prerequisites (check these before running)
1. The target app is reachable at the config's `baseUrl`.
2. For local email capture, the app's mail catcher is up. For Supabase local dev
   that's Inbucket (default `http://127.0.0.1:54324`); confirm `supabase status`
   shows it running. If capturing transactional email instead, the config points
   at Mailpit or a provider sandbox inbox.
3. Node deps are installed in the script dir: `npm install` then
   `npx playwright install chromium` (only needed once per machine).

## How to run
1. Resolve the config. Default path is `./qa/skills.config.json` in the
   current repo. If it's missing, offer to scaffold one from
   `templates/app-repo/qa/skills.config.json` and stop until the user fills
   in the selectors and expected emails.
2. Run the script from the repo root:
   ```bash
   node "${CLAUDE_PLUGIN_ROOT}/scripts/walkthrough.mjs" \
     --config ./qa/skills.config.json \
     --mode record
   ```
   `${CLAUDE_PLUGIN_ROOT}` is set by Claude Code to this plugin's install path —
   always reference the script through it so the skill works from any repo.
3. The script writes everything under the config's `outputDir`
   (default `qa/artifacts/<timestamp>/`):
   - `video/*.webm` — the full session recording
   - `screens/NN-<route>-<state>.png` — one screenshot per step
   - `emails/<mailbox>-<n>.html` and matching `.png` — captured + rendered emails
   - `manifest.json` — ordered list of every artifact with route + state labels
   - `summary.json` — `{ ok, stepsRun, emailsExpected, emailsFound, failures[] }`
4. Read `summary.json`. Report a short result to the user: pass/fail, how many
   screens and emails were captured, and any failures. Then surface the video
   path and the emails directory so they can review.

## Modes
- `--mode record` (default): never throws on a missing assertion; the point is
  to produce artifacts even if the flow is imperfect. Failures are logged in
  `summary.json` so you can mention them.
- `--mode assert`: exits non-zero on any failed step or missing expected email.
  This is what CI runs; you generally don't invoke it from here.

## Notes
- The video is for human eyes; the assertions are advisory in this mode. Don't
  describe the run as "passing" unless `summary.json.ok` is true.
- The flow creates a real account each run. The config's `freshIdentity` block
  controls how a unique email/username is generated per run (e.g. plus-addressing
  `you+run-<timestamp>@…`) so reruns don't collide.
- If the user then asks to put these screens into Figma, hand off to the
  `flow-doc` skill — it consumes this run's `screens/` and `manifest.json`.
