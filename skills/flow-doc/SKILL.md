---
name: flow-doc
description: >-
  Generate or update a Figma flow document that lays out every screen of an app's
  onboarding as frames in flow order, showing zero-states and initial seeded data,
  connected with arrows and labeled by route + state. Use when the user asks to
  "build a Figma flow", "document the screens in Figma", "update the flow doc", or
  "make a flow diagram of the onboarding". Consumes the artifacts from a prior
  `walkthrough` run. This is an **optional** capability and requires the Figma MCP
  write path to be connected. The default editable flow output is draw.io (every
  gallery build emits a `flow.drawio`); use this skill only when the user
  specifically wants the flow in Figma.
---

# Figma Flow Doc (optional export)

> **Default flow output is draw.io, not Figma.** Every `runshot gallery` build
> already emits an editable `flow.drawio` next to the run — no skill, account, or
> MCP server needed (see the repo README → "draw.io flow"). Reach for this Figma
> skill only when the user explicitly wants the flow inside Figma and the Figma
> MCP **write** path is connected.

Turns the screenshots captured by the `walkthrough` skill into a maintained Figma
flow document: one frame per screen, arranged left-to-right (or in lanes per
session mode), connected with arrows, each labeled with its route and state
(e.g. `/onboarding/profile · zero-state`).

## Prerequisites (verify before doing anything)
1. A recent `walkthrough` run exists. Find the latest `qa/artifacts/<timestamp>/`
   and confirm `manifest.json` and `screens/` are present. If not, tell the user
   to run the `walkthrough` skill first and stop.
2. The Figma MCP **write-to-canvas** path is connected. As of mid-2026 this is the
   remote Figma MCP server, in open beta — free during beta, becoming a paid
   usage-based feature later. Confirm the Figma MCP tools are available in this
   session; if only read tools are present, the write path isn't connected — tell
   the user and stop.
3. Be aware of rate limits: on the official server, Dev/Full seats follow Tier-1
   REST limits and Starter/View seats are capped at ~6 tool calls/month. For a
   many-frame doc this matters — if limits are tight, suggest the plugin-bridge
   alternative (a local Plugin-API MCP that isn't REST-rate-limited) noted in the
   repo README.

## How to build / update the doc
1. Read `manifest.json` to get the ordered list of screens, each with its route,
   state label, and screenshot path.
2. Decide target file/page. If the config has `flowDoc.figma.fileKey` and
   `flowDoc.figma.pageName`, update that page in place (idempotent — match existing
   frames by the route+state
   label and replace their image, rather than duplicating). Otherwise create a new
   page named from the config's `appName` + date.
3. For each screen, via the Figma MCP write tools:
   - Create (or locate) a frame named `<route> · <state>`.
   - Place the captured screenshot into the frame at mobile dimensions.
   - Add a caption with the route, the state, and a one-line note from the manifest.
4. Lay frames out in flow order with connectors between consecutive steps. If the
   manifest marks branch points (e.g. solo vs joint session in TwoLife), put each
   branch in its own horizontal lane and connect from the branch screen.
5. Add a title block: app name, environment, run timestamp, and "auto-generated
   from walkthrough run <id> — do not hand-edit frames, re-run flow-doc to update."
6. Report the Figma file/page link back to the user.

## Alternative: live-UI import
If the connected Figma server supports turning live browser UI into editable
layers ("send pages / whole flows to Figma Design"), you can skip image placement
and import the live screens directly as editable frames — better for design
iteration, heavier on rate limits. Prefer this only when the user wants to *edit*
the screens in Figma, not just document them.

## Keep it idempotent
Re-running this skill after a fresh walkthrough should update the existing flow
doc in place, not create a pile of duplicate pages. Always match on the
route+state label first.
