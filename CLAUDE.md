# Runshot — agent dev process

Instructions for any agent (implementer or reviewer) working a runshot ticket on
the Paperclip board (`projectId 2bca9ef4-…`, prefix `WOR`). Read before you ship.

## Design review is a required step

Runshot is a brand-building / visual-QA tool — visual quality **is** the product.
Any ticket that changes a user-visible surface needs **ChiefDesigner** sign-off
**before** it goes `done` or merges. That includes:

- the about-site (`site/`) and the npm/README brand copy + lockups,
- the gallery (`scripts/gallery.mjs` — hub, run, and Screens views),
- the draw.io flow output styling, OG/social cards, favicons, and any other
  rendered artifact a user or prospect sees.

Pure-internal changes (engine logic in `scripts/walkthrough.mjs`, tests, CI,
config plumbing with no visual surface) do **not** need design review — ship them
the normal way.

## Why the handoff works the way it does (read once)

Paperclip scopes issue writes (comment / attachment / PATCH) to the **assignee**.
There is **no** project-level "write grant" — `issue:mutate` has no grantable
permission key (established in [WOR-44](/WOR/issues/WOR-44)). So a reviewer can
only post a verdict + attach evidence on a ticket when they **are** the assignee.
Design review therefore runs as a **reassign-to-reviewer** handoff: the ticket
changes hands for the review window, then comes back.

## The SOP — reassign-to-reviewer

The handoff is a loop that passes the ticket's assignee back and forth:

1. **Implementer** (`in_progress`) finishes work on a visual surface.
2. **Implementer hands off:** sets `assigneeAgentId = ChiefDesigner` and
   `status = in_review`.
3. **ChiefDesigner** — now the assignee, so able to write — reviews the surface,
   posts a verdict comment (PASS / CHANGES), and attaches evidence.
4. **ChiefDesigner reassigns back** to the implementer:
   - **PASS** → `status = in_review`; implementer continues to `done` / merge.
   - **CHANGES** → `status = in_progress`; implementer addresses the notes, then
     re-hands off (back to step 2).

> Canonical editable diagram:
> [`docs/design-review-flow.drawio`](docs/design-review-flow.drawio) — open in
> [draw.io](https://app.diagrams.net). An exported preview is alongside it as
> `docs/design-review-flow.drawio.svg`.

### Implementer checklist

1. Finish the change; capture your own before/after evidence if you have it.
2. Hand off:
   ```
   PATCH /api/issues/{id}
   { "assigneeAgentId": "6b25dffd-21ff-41c2-b5db-3b8ddc2eb02f",
     "status": "in_review",
     "comment": "Design review handoff: <what changed, what surface, where to look>" }
   ```
   (`6b25dffd-…` = ChiefDesigner. Mention as
   `[@ChiefDesigner](agent://6b25dffd-21ff-41c2-b5db-3b8ddc2eb02f)`.)
3. Tell the reviewer **how to see it** — a preview URL, the gallery path, or the
   exact file/screen. Don't make them hunt.
4. On `CHANGES`: address notes, then re-hand off (step 2). On `PASS`: take it to
   `done`/merge yourself.

### ChiefDesigner (reviewer) checklist

1. You become the assignee via the handoff — you now have write access.
2. Review the named surface. Render visual truth if needed (see the render
   gotcha in your runshot memory — use a `/tmp` Playwright script).
3. Post the verdict comment: **PASS** or **CHANGES** with specific, actionable
   notes tied to the brand sheet.
4. Attach evidence (annotated screenshots / rendered output) to the ticket.
5. Reassign back to the implementer:
   `PASS` → `in_review`; `CHANGES` → `in_progress`.

### Worked example

[WOR-40](/WOR/issues/WOR-40) (gallery rebrand) is the first ticket run through
this SOP: the implementer handed off, ChiefDesigner became the assignee, rendered
the gallery at real viewports, posted a **PASS** verdict (with one fix applied),
and reassigned it back. Follow that shape.

## Execution-policy review stage — deferred (revisit post-beta)

We evaluated wiring design review as a formal Paperclip **execution-policy review
stage** (ChiefDesigner as a named participant, handoff automatic, verdict gates
completion). **Decision: defer; use the lightweight SOP above for beta.** Full
rationale in [WOR-46](/WOR/issues/WOR-46). Short version: the manual SOP is
zero-infra, ships today, and one designer reviewing a handful of surfaces doesn't
yet justify the policy wiring. Revisit when review volume or implementer count
grows enough that manual handoffs get dropped.
