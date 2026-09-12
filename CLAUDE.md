# Kortz Center Loot Ledger

A static, dependency-free web app that recommends the optimal secondary-loot
loadout for the GTA Online Kortz Center Heist, given crew size, difficulty,
weekly status, and Buyer's Choice picks.

## Pages
Three static pages, real navigation via `location.href`, state handed off
entirely through `localStorage` (no view-swap, no SPA framework):
- `index.html` — Page 1, Scope & Setup. Pure input collection: primary
  target, difficulty, weekly status, crew size, the full loot chart,
  Buyer's Choice picks, Elite Challenge toggle, optional per-player names.
  No live results panel — a single Submit button is the only way to reach
  Page 2. A "Copy as CSV" button (2026-08-10, next to "Clear Board" in the
  header actions bar) copies the current run's scoped item values to the
  clipboard, since the user tracks values across runs over time in their
  own external spreadsheet and had no way to preserve a scope-out before
  clearing the board. One row per **catalog** item, full stop, in catalog
  order, three columns: Item, Floor, Value — unscoped items still get a
  row, just with a blank Value field (changed 2026-08-13, user feedback:
  pasting straight into a spreadsheet is easier when every item's row is
  already present, rather than needing blank rows hand-inserted afterward
  to keep alignment with other runs' pastes; originally shipped
  2026-08-10 skipping unscoped items entirely). Floor is a real,
  load-bearing column, not decorative — two catalog
  items share a name ("Oeuf de Coquard" on both Alarm Floor and Second;
  "Fertility Statue" on both First and Crisp Gallery), so Item alone
  can't disambiguate them if both are scoped in the same run; the user
  chose a Floor column over renaming/suffixing the items themselves.
  Value is a plain number (no `$`, no thousands separator) so a
  spreadsheet treats it as numeric on paste, not text. **A Buyer's Choice
  item gets a trailing `*` on its Item name** (2026-08-23, user request),
  never on Value — appending it to Value directly would've turned just
  those rows' Value cells into text on paste, silently breaking the
  numeric-paste guarantee for exactly the up-to-3 BC rows in a run, so the
  marker goes on the one column that was always free-text anyway. The
  CSV-building logic itself (`buildScopeCsv()`) lives in `js/kch-model.js`, not here —
  same reason every other piece of shared logic does: it's pure
  (filtering/ordering/escaping, no `document`/clipboard), so it gets real
  `node --test` coverage against `fixtures/sample-run.json`
  (`test/build-scope-csv.test.js`) instead of only being checkable by eye
  in a browser. `index.html` only owns the actual
  `navigator.clipboard.writeText()` call and the button's brief
  "Copied!"/`var(--teal)` confirmation state (mirrors `guide.html`'s
  `.lock-btn.locked` pattern), reverting after ~1.5s. Deliberately not
  offered inside the "Clear the board?" confirm dialog too — header bar
  only, the user's call, on the reasoning that Copy is a general-purpose
  action rather than specifically a clear-time safety net. JSON export
  (for a future clean re-import feature) was considered and explicitly
  deferred — not a need right now.
  **Step order was reshuffled 2026-08-13** (Crew Size moved from Step 2
  to Step 4, now right after Elite Challenge, ahead of Crew Names):
  crew size might not actually be decided until after the loot's already
  been scoped, so asking for it second forced a premature choice. This
  is a pure DOM/markup reorder — every step's inner control still autosaves
  to the same `state` fields via the same element IDs, and `renderAll()`
  reads `state.players` on every change regardless of where its step
  physically sits, so nothing downstream needed touching (verified: the
  loot chart's per-floor "Needs N+ players" note already reads
  `state.players` live, not step position). The Scoped Secondary Loot
  hint text was tightened the same day (fewer clauses per sentence) and
  its "Elite Challenge (Step 4)" cross-reference was changed to "(below)"
  — a hardcoded step number would have gone stale the moment step order
  changed again, and "below" stays true regardless (Elite Challenge has
  always immediately followed the loot chart, before or after this
  reorder). The hint also now explicitly says Buyer's Choice is marked
  "by clicking the item" (user-requested addition) — the click target is
  the whole row/label, not a small checkbox, and that wasn't obvious from
  the text before.
  **"Keep Primary?" toggle (2026-08-15, user request), Step 1.** Some
  hosts keep the primary painting for display (arcade/property) instead
  of selling it. A third toggle-group in Step 1 (`state.keepPrimary`,
  `'no'`/`'yes'` — string-valued like every other toggle field here, not
  a raw boolean), same visual pattern as the Elite Challenge toggle. Purely
  a payout exclusion: nothing else in the tool changes (secondary loot,
  bonuses, bag packing all untouched) — confirmed with the user this
  doesn't map to any other mechanic. **Disabled for the mandatory story
  target** (`la-derniere-debauche`) — `renderPrimaryInfo()` already told
  the user "Mandatory story target — must be sold every run" before this
  toggle existed, and letting "Keep Primary? Yes" coexist with that line
  would contradict it, so selecting the mandatory target dims the "Yes"
  option (`.toggle-btn.disabled` — a CSS/JS click-guard, not a native
  `disabled` attribute, since these are `<div>`s) and force-resets
  `keepPrimary` back to `'no'` if it was set while a different, optional
  target was previously selected. See `guide.html` below for how `kept`
  propagates to the actual totals.
  Also **sorted by value, most → least valuable** (2026-08-15, user
  request, replacing alphabetical) — see the `primary-targets.json` entry
  under "Data model" below.
  **Map Scope-Out gateway (2026-08-22), Step 2.** A button atop the loot
  chart ("Prefer tapping a map? Try Map Scope-Out →") links to
  `map-scope.html` — see its own entry below. Gated behind a
  `MAP_SCOPE_ENABLED` const, the exact same kill-switch pattern as
  `guide.html`'s `MAP_VIEW_ENABLED` (flip to `true` and redeploy to show
  the button; direct navigation to `map-scope.html` always works
  regardless). **Shipped `false`**: the page needs real-world debugging
  via direct URL first, before it's discoverable from this page.
  **Advanced Settings accordion (2026-08-23), after Step 5, before
  Submit.** A native `<details class="step advanced-settings">` — no
  existing accordion precedent in the app before this, chosen because it
  needs no JS for expand/collapse and stays keyboard-accessible for free;
  `<summary class="step-title">` stands in for the numbered
  `.step-num`+`.step-title` pair every real step uses, since this isn't
  part of the input sequence (closed by default, easy to skip). Holds two
  independent, unchecked-by-default native checkboxes (not
  `.toggle-group` pairs like the rest of Page 1 — user-confirmed
  preference, matching this feature's own "checkbox" framing and the
  existing `.bay-check-wrap` precedent): "Skip Glass Cutter prep"
  (`state.skipPreps`, an extensible string array rather than a one-off
  boolean, so a future prep-gated toggle just adds another string — see
  `isItemReachable()` under "Model module" below) and "Experimental:
  time-optimized packing" (`state.experimentalPacking`, a plain boolean).
  Both default to values that reproduce pre-2026-08-23 behavior exactly
  (`skipPreps: []` assumes every prep done, same as always;
  `experimentalPacking: false` keeps the default value-model bag split).
  Neither setting has a live-updating effect on this page itself — both
  only change what `guide.html` computes when it calls `runOptimizer()`,
  so their handlers just update `state`/`saveState()` without triggering
  `renderAll()`'s full loot-list rerender. These were originally two
  separate backlog ideas (an "Advanced Settings accordion" for
  `skipPreps`, and a wholly separate "experimental model" for
  loot-time/travel-weighted packing) that converged onto one shared
  accordion once designed together — see "Core logic" below for the
  experimental packing model itself.
- `guide.html` — Page 2, Heist Guide. The results/manifest screen, meant to
  be screenshotted or printed during the run. Top-to-bottom: a glass-cutter
  prep reminder banner (if applicable), the security-door-combination field
  with a reversible lock control, the promoted "who grabs what" info
  (optimized bag value + per-player item lists, color-coded by floor), a
  "Map View →" button (see `map-view.html` below), then the demoted
  "Finale Result" (Primary/Secondary totals + per-player payout/bonus
  figures — no combined "Total Take" headline, see below; each player's
  own card below it does show a per-player "Career Progress" figure,
  distinct from "Payout"). These are genuinely separate render passes/DOM
  zones, not just reordered markup — the item ledger and the payout figures
  used to be welded into the same per-player card. Has a "back to edit"
  link back to `index.html`; every page hydrates from the same
  `localStorage` blob, so navigation in any direction needs no extra
  state-passing. **`state.experimentalPacking` indicator (2026-08-23).**
  When on, a small `.hint`-style line appears directly under the "Who
  Grabs What" heading ("⚡ Experimental: time-optimized packing is on —
  ..."), so a host isn't confused about why the bag split differs from a
  prior view or from what `index.html`'s scope-out would otherwise
  suggest. Purely a display toggle in `renderItemsList()` — the actual
  packing swap already happens inside `runOptimizer()` itself (see "Core
  logic" below), since `state` flows into that call by reference with no
  extra wiring needed here.
  **Shutter/EMP-role UI removed (2026-08-31), after shipping 2026-08-24.**
  `#shutterDutyNote` ("🔑 Suggested for shutters: Player 2 — guaranteed
  low-cost First Floor access this run.") and the per-player "Suggested
  order: A → B → C" route line (see "Core logic" below) both existed
  briefly on this page and are now gone — user decision: the experimental
  view shouldn't accumulate UI the normal model lacks, since that nudges
  people toward an unfinished model ahead of real job/role modeling
  (backlog item 6) existing to back it up. Both underlying guarantees
  (console operator + host in-gallery verifier — see "Core logic") are
  still fully enforced inside `packBinsForTime()`/`runOptimizer()`; only
  the display is gone. `shutterOperatorIndex` and the newer
  `neededGalleryPresence` field are still returned by `runOptimizer()`
  for tests and the dev-only `test/compare-packing.mjs` CLI.
- `map-view.html` — Page 3, Map View, added 2026-08-06. A lean,
  host-facing, screenshot/share-friendly live-reference for the *actual
  run*, reached via the "Map View →" button on `guide.html` (sitting
  between "Who Grabs What" and "Finale Result" — the seam between
  operational and planning content) and a "← Back to Guide" link back.
  **`guide.html` gates that button behind a `MAP_VIEW_ENABLED` constant**
  (added 2026-08-10, near the top of its module script) — a deploy-time
  kill switch: flip to `false` and redeploy to instantly hide the
  gateway button/section without a git revert, in case the feature ships
  with an issue post-launch. Deliberately only hides discoverability from
  `guide.html` — it doesn't gate `map-view.html` itself, so a direct URL
  still works while the flag is off; adding that would mean duplicating
  the flag onto `map-view.html` too, which already deliberately duplicates
  rather than shares render helpers with `guide.html` (see below), and
  wasn't asked for. Chosen over a full git revert because the map feature
  and any unrelated in-flight fix (e.g. to `js/kch-model.js`) live in
  different files, so this flag can be flipped independently of whatever
  else has landed since.
  Exists because `guide.html` conflates two audiences that have nothing to
  do with each other mid-heist: planning/bookkeeping (Finale Result,
  Payout by Player, Career Progress, Crew Size Comparison — relevant
  before a crew size is locked in, or after to settle up) and operational
  reference (prep warnings, security combo, who-grabs-what, floor maps —
  the only part that matters *during* the run). The host is the one who
  fills out this tool and relays results to teammates (confirmed
  2026-08-06), not each player individually — so this page is what a host
  keeps pinned on a second screen or screenshots piece-by-piece into a
  group chat, without financial math ever sharing the frame. Deliberately
  contains, top to bottom: the prep warning banner, Security Door
  Combination (identical markup/IDs to `guide.html` — editing/locking it
  here updates the same `page2State` fields `guide.html` reads, via the
  shared `localStorage` blob), Who Grabs What (shown exactly as on
  `guide.html`, dollar values and Buyer's Choice flags included — not a
  stripped-down variant), and Floor Maps (see below) — deliberately last,
  since floors with no tagged coordinates yet contribute nothing there and
  the list above is already the complete fallback, and crews who don't
  need the spatial view (the user's phrase: "sweaty folks") just stop
  scrolling once they have their list — no toggle/collapse mechanism
  needed to make maps skippable. Deliberately excludes the Optimized Bags
  $ stamp and its overflow/Buyer's-Choice-ineligible warning — the host
  already sees that on `guide.html` itself before ever clicking through,
  and it's planning-relevant, not moment-to-moment operational info.
  **Duplicates rather than shares** `guide.html`'s `PREP_LABELS`/
  `prepLabel`, `FLOOR_SLUGS`/`floorSlug`, `playerLabel()`, `variantFor()`,
  `loadPersisted()`/`saveState()`, `renderPrepWarning()`,
  `renderItemsList()`, and `wireSecurityCombo()` — checked the existing
  precedent first: `index.html` and `guide.html` already each
  independently duplicate their own persistence/hydration boilerplate,
  and the only thing actually shared between pages today is
  `js/kch-model.js` (pure logic). Introducing a shared render module for
  one page would be a new pattern the rest of the app doesn't use, so this
  stays consistent with how the app already works rather than DRY-ing it
  up. Also skips fetching `data/primary-targets.json` entirely — nothing
  on this page needs a primary-target value, so unlike the other two
  pages it only fetches `data/secondary-loot.json`.
  For the same "duplicate, don't share" reason, `guide.html`'s
  2026-08-24 shutter-duty hint (see that page's entry above) wasn't
  ported here in that pass — it would need its own duplicated render
  logic same as everything else in this list, and porting an
  *operational* hint like this to the page that's actually meant for
  during-the-run reference is arguably more natural here than on
  `guide.html`, so it's flagged as a real, plausible next step rather
  than a "maybe" — just not built in the same pass that shipped it.

Floor Maps itself (an image-based extension of "Who Grabs What," not a
replacement) lives only on `map-view.html`: one card per floor-map asset,
with a pin for every *packed* item that has real `xPct`/`yPct` data,
colored by which player's bag it landed in (reusing the `p-color-0..3`
player palette, same convention as the player cards above it). Cards are
grouped by resolved map asset rather than `floor` name, since `floorMaps`
is many-to-one — `Second` and `Crisp Gallery` share one image
(`assets/floors/second.png`), and that shared image has a dashed-rectangle
callout drawn directly in the art marking the Crisp Gallery room's
boundary, in the app's own `--floor-crisp-gallery` blue. Every mappable
floor is tagged as of 2026-08-06 (Alarm Floor, First, Vault, Second/Crisp
Gallery). Pure presentation, same as `floorSlug()` — no `kch-model.js`
logic involved. (This section briefly lived inline on `guide.html`
itself — a real density test at First Floor's item count measured it at
~2x the height of the entire existing "Who Grabs What" list, which is
what prompted splitting `map-view.html` out in the first place.)

**Cards render in catalog floor order** (fixed 2026-08-06), not the
incidental order floors happened to get walked in while assigning bags
(which is why "Level 2" could appear before Alarm Floor/First before this
fix). Reuses the exact `[...new Set(LOOT_CATALOG.map(it => it.floor))]`
technique `renderItemsList()` already uses for its per-player floor
sub-headings — the catalog's own item order already encodes the intended
building sequence (Vault → Loading Bay → Alarm Floor → First → Second →
Crisp Gallery). A merged group (Second/Crisp Gallery) sorts by whichever
of its floors appears first in that sequence.

**Each map card carries its own player-color legend** (added 2026-08-06),
dynamically generated and sized to the actual crew for that run — never
baked into the base map art, the same "pins are data" principle the pins
themselves already follow (a static legend can't adapt to crew size and
would show unusable swatches for players not even in this run). Repeated
on every card rather than shown once for the whole section, deliberately:
the host screenshots individual floor cards to share with teammates, and
each screenshot needs to read correctly on its own without the rest of
the page for context. The legend's visible label uses `playerShortLabel()`
(`"P1"`/`"P2"`/etc., 2026-08-07 UX-review fix), not `playerLabel()`'s
fuller `"Host (P1)"`/`"Player N"` form used everywhere else — a real,
genuinely long player name still overflowed the legend's ellipsis/
max-width handling because "Player 2" alone ate 8 of the label's limited
characters; dropping to a uniform `"PN"` (host included) buys back that
room without losing any information the legend's color-to-name job
actually needs. `label.title` still holds the full `playerLabel()` form,
so hovering a legend entry reveals "Host"/"Player N" same as before —
only the always-visible text is abbreviated.

**Loading Bay gets a text-only callout card, not a map — and it sits
first, ahead of every real map (moved there 2026-08-06).** It's the one
floor deliberately excluded from `floorMaps` entirely (a single item, `BAY`,
nothing to visually distinguish — see `data/secondary-loot.json`'s
`_notes`). Once every *other* floor had a real map, leaving Loading Bay
silently absent from the section (or buried at the bottom, past
everything else) started reading as a gap rather than a choice, so
`renderFloorMaps()` checks (by `floor === 'Loading Bay'`, not a hardcoded
`itemId === 'BAY'` check) whether it was packed this run and, if so,
renders it before any real map card — same `.floor-map-card`
heading+content rhythm, just without an `<img>`. Carries the same two
color signals a real card's pins would: a `--floor-loading-bay`
left-border accent (matching how every other floor-colored element in the
app already works — a border, not full-color text) and a player-color dot
next to the text for whichever player actually has `BAY` this run,
standing in for a pin — and (fixed 2026-08-06) names that player inline
in the text itself, the same way a real card's legend names each of its
dots, rather than pointing back to "Who Grabs What" to decode the color;
this card should read correctly on its own, same screenshot-sharing
reasoning as everything else in this section. Deliberately **not** baked
onto the Vault map, despite the two floors
sitting adjacent in the catalog — `Vault` and `Loading Bay` are documented
as isolated from every other floor including each other (see the
bag-assignment adjacency notes under "Core logic" below), so pinning a
Loading Bay note onto Vault's art would misrepresent the routing.

- `map-scope.html` — Page (alt), Map Scope-Out, added 2026-08-22. A
  **permanent alt-path** to `index.html`'s Step 2 loot chart — tap a pin
  on the real floor art instead of scrolling the flat list — reached via
  the gateway button described in `index.html`'s entry above (behind
  `MAP_SCOPE_ENABLED`, shipped `false`) and a "← Back to Scope & Setup"
  link back. Graduated from a scratchpad prototype (evaluated over
  several sessions, never git-tracked) once every open design question
  was settled; see `internal/model-notes.md`-style history in project
  memory rather than here. **Scope is deliberately narrow**: only
  per-item value / Buyer's Choice / the Gemstone (`2-H`) variant — Primary
  Target, Difficulty, Weekly, Crew Size, Elite Challenge, Keep Primary,
  and Player Names all stay `index.html`-only, unrendered here. Same
  `localStorage` blob, freely switchable mid-run in either direction — no
  separate submit button, since the rest of the run still only lives on
  `index.html`.
  Follows the same **duplicate-don't-share** convention `index.html`,
  `guide.html`, and `map-view.html` already each independently follow —
  its own `loadPersisted()`/`saveState()` copy, calling the same
  `js/kch-model.js` exports (`defaultPage1State`, `defaultPage2State`,
  `deserializeState`, `serializeState`, `mergeLootByItemId`, `itemById`).
  Only fetches `data/secondary-loot.json` (no `primary-targets.json`),
  same as `map-view.html`, since nothing here needs a primary-target
  value.
  Structure, top to bottom: a **Loading Bay callout** (always first, same
  placement rationale as `map-view.html`'s) with an **always-visible
  inline "Scoped" checkbox** (locks to `cat.fixedValue`, same as
  `index.html`'s BAY row) — rather than the tap/popover pattern every
  other item uses, since there's no map underneath `BAY` and nothing to
  disambiguate (one item, no coordinates). No Buyer's Choice control here
  (2026-08-22 fix, gated on `cat.buyersChoiceEligible !== false`,
  currently `false` only for `BAY`) — the truck's contents can never
  actually be a Buyer's Choice target in-game; see `secondary-loot.json`'s
  `buyersChoiceEligible` note under "Data model" below. Then one
  **floor-map card per resolved map asset**
  (Vault, Alarm Floor, First, Second/Crisp Gallery-shared), grouped and
  catalog-ordered exactly like `map-view.html`'s `renderFloorMaps()`, but
  built from the *whole* catalog (every item, not just a packed result) —
  this page is an input surface, so unscoped items need pins too.
  **Pins use a distinct `.scope-pin` class family from `.map-pin`** — the
  latter encodes which *player* a packed item landed with; here a pin
  encodes *scope-entry* state via two independent visual channels: fill =
  scoped (has a value), gold hue = Buyer's Choice — four real
  combinations, reused as a border/background treatment on the Loading
  Bay callout too.
  **Labels are always-on** (every pin's item name, not just on
  hover/tap) with a **collision-avoidance stagger**: after the floor
  image's `load` event (or immediately if `img.complete`, since real
  layout is needed to measure real label sizes), a colliding label is
  nudged straight down until it clears every label already placed above
  it (processed top-to-bottom/left-to-right for determinism) — no text
  shortening, no clustering into a count badge. Verified against the
  densest real cluster (Second/Crisp Gallery, 13 items sharing one image)
  at zero remaining overlaps.
  **Tap handling uses a Medium hit-zone (24px)**, confirmed during
  prototype evaluation against First Floor's tightest real cluster
  (Antique Bands/Art Deco Rings, ~47px apart — almost exactly the 48px
  combined-radius ambiguity boundary). `findNearestPins()` in
  `js/kch-model.js` does the actual hit-testing (see "Core logic" below)
  — zero hits is a silent no-op (a known, accepted dead zone between
  far-apart pins at this radius, not fixed here), one hit opens that
  item's entry dialog directly, two-plus hits shows a small
  disambiguation **chip list** at the tap point instead of guessing.
  The **entry dialog** reuses the native `<dialog class="confirm-dialog">`
  idiom already used for `index.html`'s Clear Board confirm (free
  focus-trap/Escape/backdrop-dismiss) — fields mirror `index.html`'s row
  controls exactly: a value input, a Buyer's Choice checkbox (disabled at
  the same 3-item max, with **no row-wide dim** on any other row/pin —
  consistent with the 2026-08-15 fix that removed that dim from
  `index.html`), and, only for items with a `variants` list (Gemstone),
  the same variant dropdown. Saving writes back to the matching
  `state.loot` entry by `itemId` and updates just that one pin's visual
  state — not a full page rebuild.

All four pages are `type="module"` and `import` directly from
`js/kch-model.js` (no separate `<script src>` tag for it). Shared visual
styling lives in `css/kch-styles.css`, linked from all four.

## Data model
- `data/primary-targets.json` — primary painting payouts. Only a base value is
  stored per painting; hard mode and first-week are the only two clean
  multipliers applied on top (see `_notes` in the file for the derived
  formula and verification). `index.html`'s Target dropdown (and
  `guide.html`'s identical, duplicated data-loading code) sorts this list
  by `baseValue` descending — most valuable first — rather than
  alphabetically (2026-08-15, user request, easier to scan/compare at a
  glance). Sorting by raw `baseValue` stays correct regardless of the
  run's difficulty/weekly selection, since `calcPrimary()`'s multipliers
  apply uniformly to every target.
- `data/secondary-loot.json` — every scoutable secondary item, its floor
  location, and its bag-weight (0–100 scale, one bag = 100). Dollar values are
  NOT stored here — they're randomized per scope-out and entered by the user
  at runtime, keyed by `itemId`. The UI shows the full catalog as an
  always-visible chart grouped by floor (not a picker you add rows to) —
  every item's value input starts blank until the user fills in what they
  actually scoped. Item weight is intentionally never shown to the user —
  bag-space math is the tool's job, not theirs.
  - **Exception: the Delivery Truck Crate (`BAY`)** renders as a checkbox,
    not a number input, driven by `valueType: "checkbox"` and
    `fixedValue: 105000` on its catalog entry (data-driven, not a
    hardcoded `itemId === 'BAY'` check in the JS). Checked locks its value
    to `fixedValue`; unchecked excludes it entirely, even if it's also
    marked Buyer's Choice. This is the one deliberate exception to "every
    item starts blank" — its true value can't be known until it's
    actually taken during the heist. `fixedValue` was $122,500 (the
    $105k-140k community range, averaged) until 2026-08-03, when the user
    reported the truck's real value running lower than that average in
    practice, dropping it to a deliberately pessimistic $110,000; on
    2026-08-09 the user asked to go further and pin it to the floor of
    that same $105k-140k range ($105,000) rather than just a
    below-average estimate. This number is
    **never shown to the user on `index.html`**: the checkbox's own label
    just reads "Scoped", not a dollar amount, since it's a planning
    assumption rather than a confirmed real value worth anchoring on.
    (`guide.html`'s results/manifest screen is unaffected by this and
    still shows the item's actual dollar contribution like any other
    packed item.)
  - **`scopeNote`** (currently only on `BAY`) — reminder-only metadata
    rendered inline under an item's name on `index.html` whenever
    present, generic to any catalog item (not a hardcoded `itemId`
    check). `BAY`'s note warns the crate isn't guaranteed to exist at
    all (the truck doesn't always spawn) — distinct from `requiresPreps`
    below, which is about needing a prep mission for an item that IS
    always there.
  - **`variants` + `variantLabel` (currently only on `2-H`, Gemstone)** —
    an optional per-run sub-type picker. When a catalog entry carries a
    non-empty `variants` array, `index.html` renders a dropdown of those
    values in the item's controls, built and appended **before** the value
    input so the dropdown is first in real DOM order — visual order, DOM
    order, and Tab order all agree: entering the row lands on the
    dropdown first ("what is it, then what's it worth"), then the value
    input, then Tab moves on to the next row. This is a real fix
    (2026-08-06) for a genuine bug: an earlier version kept the dropdown
    *second* in DOM order and used CSS (`order:-1`, then a `grid-column`
    attempt) to make it appear first only visually, on the theory that
    Tab would keep following DOM order regardless. Confirmed empirically
    in-browser that neither theory held — Tab followed plain DOM order
    both times, so a value-input-then-dropdown DOM order always put the
    dropdown *after* the value input in Tab sequence too, sending Tab
    backward into the dropdown before it would advance to the next row.
    Reordering the actual DOM (not any CSS trick) was the only fix that
    worked. The pick is saved on the loot entry as `variant`. It is purely
    descriptive: never an eligibility, weight, value, or packing input,
    and `runOptimizer()` never reads it. `guide.html` shows it in the
    "Who Grabs What" manifest **in place of** the item's `description` —
    a chosen variant is the run-specific version of the same field
    (`2-H`'s generic tag is literally "gem, color varies"). Data-driven,
    not a hardcoded `itemId === '2-H'` check: any item can grow a
    `variants` list and get the same control. `mergeLootByItemId()` drops
    a saved `variant` that the catalog no longer offers, the same way it
    drops stale `itemId`s.
  - **`requiresPreps` (e.g. `["glass-cutter"]`)** — metadata on five items
    (`0-A`, `2-B`, `2-C`, `2-H`, `2-K`) that need a prep mission to
    actually be lootable in-game. `2-H` (Gemstone, Crisp Gallery) was
    missing this flag until 2026-08-22, when the user caught it as a data
    bug. `guide.html` warns if any *packed* item carries it (regardless of
    `state.skipPreps`, since a chosen item could still carry the flag with
    the prep assumed done), naming only the ones actually present.
    **Full gating shipped 2026-08-23** as `index.html`'s "Skip Glass
    Cutter prep" Advanced Settings checkbox — `state.skipPreps` (an
    extensible string array, not a one-off boolean), consumed by the
    shared `isItemReachable(catItem, state)` predicate in `kch-model.js`
    (see "Model module" below), which both of `runOptimizer()`'s
    reachability checks (the `eligible` filter and `bcIneligibleIds`) now
    call instead of two independent inline `minPlayers` checks. Defaults
    to `skipPreps: []`, reproducing pre-2026-08-23 behavior exactly (every
    prep assumed done). This is a deliberate refinement of the older
    `state.activePreps` design in `internal/model-notes.md`'s "Glass
    cutter item gating" section (which defaulted to *populated*, an
    opt-in framing) — `skipPreps`'s opt-out framing lets the checkbox
    read "Skip Glass Cutter prep" and stay unchecked by default while
    still exactly preserving today's full-eligibility behavior. Kept
    deliberately minimal per the user's own "quick change" framing — not
    building the fuller reason-aware ineligibility messaging (distinguishing
    "needs more players" from "prep skipped" in the UI) or loot-chart
    row-dimming for prep-excluded items that `internal/model-notes.md`'s
    "Atlas's feasibility review" flagged as ideal; that stays available as
    a documented follow-up there, not built now.
  - **`buyersChoiceEligible` (2026-08-22/23), currently only `false` on
    `BAY`** — the Delivery Truck Crate's contents can never actually be
    picked as a Buyer's Choice target in-game. Absent/defaults to `true`
    on every other item. `index.html`'s loot row renders as a plain `<div>`
    instead of a `<label>` wrapping a hidden BC checkbox for such an item
    (no BC badge either), and `map-scope.html`'s Loading Bay callout skips
    its Buyer's Choice checkbox entirely (see that page's entry above).
    `mergeLootByItemId()` in `kch-model.js` force-resets `buyersChoice` to
    `false` for any `buyersChoiceEligible:false` item on every load,
    regardless of what's saved — a single point of enforcement (every
    page's `loadPersisted()` funnels through it) so a stale `true` from
    before this flag existed can't resurrect as a mandatory Elite pick on
    any page.
  - On `index.html`, the entire loot row is the Buyer's Choice click
    target (a `<label>` wrapping a visually-hidden checkbox, per-item
    `aria-label`) — not just a small checkbox — while the value input (and
    BAY's own checkbox) remain independently clickable/typeable inside it.
    Once 3 items are marked, every other row's BC checkbox is disabled
    (blocking a 4th pick) but the row itself is **not** dimmed
    (2026-08-15, dropped `.bc-locked`'s `opacity:.55` — user feedback: it
    faded the still-editable value input on unrelated rows too, hurting
    legibility for items you're actively typing values into). The 3
    picked rows' existing `.bc-active` gold highlight is the only visual
    signal now; no counter-signal on the rest.
  - **`floorMaps` (top-level, not per-item) + per-item `xPct`/`yPct`** —
    data backing `map-view.html`'s "Floor Maps" section (see "Pages"
    above — this section lives on `map-view.html`, not `guide.html`).
    `floorMaps` is a `floor` name → map image path lookup, many-to-one
    (`Second` and `Crisp Gallery` share one physical-level image, so the
    map asset can't be derived from `floor` by naive slug). A floor with
    no `floorMaps` entry (`Loading Bay` — one item, no visual value in a
    map) has no map at all; render code treats that as "skip," not an
    error. Per-item `xPct`/`yPct` are percentage-based, top-left origin
    (`x` right, `y` down — matches CSS `left`/`top` directly, zero
    conversion), giving that item's pin position on whichever image its
    floor resolves to. Alarm Floor (`0-A`/`0-B`/`0-C`) was the pilot floor
    (smallest, 3 items) used to validate pin rendering first — as of
    2026-08-06, every mappable floor (Vault, Alarm Floor, First,
    Second/Crisp Gallery) is fully tagged; only `Loading Bay` has no
    coordinates, and that's permanent (no `floorMaps` entry at all, not
    "not tagged yet" — see its text-only callout under "Pages" above).

## Model module
`js/kch-model.js` is a pure ES module — no `document`, `fetch`, or
`localStorage` anywhere in it — holding `packBins()`, `knapsack()`,
`assignItemsToBags()`, `calcPrimary()`, `bonusAmounts()`, `itemById()`,
`findNearestPins()`, `isItemReachable()`, `timeWeightFor()`,
`exhibitTravelCost()`, `packBinsForTime()`, `runOptimizer()`,
`computeGuidePayout()`, `computeCareerProgress()`, `packedPrepWarnings()`,
`buildScopeCsv()`, `money()`, and the
`serializeState`/`deserializeState`/`mergeLootByItemId` persistence
helpers. Both pages and the Node test suite (`test/*.test.js`, run via
`node --test`) import this same file, so there is exactly one
implementation of the optimizer logic. A dev-only CLI, `test/compare-
packing.mjs` (never shipped — same category as the rest of `test/`, see
"Stack" below), prints a default-vs-experimental side-by-side report for
any real scope-out JSON, for trying the experimental model locally
without the browser.

`isItemReachable(catItem, state)` (added 2026-08-23) is the shared
reachability predicate `runOptimizer()`'s two independent inline checks
(the `eligible` filter and `bcIneligibleIds`) both now call, so they can
never silently disagree the way two separately-maintained checks risked
doing once a second gate (prep-skipping, alongside crew size) existed.
`(catItem.minPlayers > state.players) → false`, else every string in
`catItem.requiresPreps` must be absent from `state.skipPreps` — see
"Skip Glass Cutter prep" under the Data model section's `requiresPreps`
entry above.

`findNearestPins(items, tapXPx, tapYPx, imageWidthPx, imageHeightPx, radiusPx)`
(added 2026-08-22) is `map-scope.html`'s tap-the-pin hit-testing helper —
given a tap position and a floor/asset's catalog items (each carrying
`xPct`/`yPct`), returns every item within `radiusPx`, nearest first. Pure
input-surface plumbing, not optimizer logic: no eligibility, weight, or
packing impact whatsoever, kept here purely so it gets real
`node --test` coverage (`test/find-nearest-pins.test.js`) instead of
being buried in page JS — same reasoning as `buildScopeCsv()`. Converts
each item's percent position to real pixels **per axis** (`x` against
`imageWidthPx`, `y` against `imageHeightPx`) before measuring Euclidean
distance — a real bug in the scratchpad prototype this graduates from
used a blended average of width+height instead, which silently shrank
the effective hit-zone on non-square rendered images (e.g. First Floor's
900×727).

A marked-and-scoped Buyer's Choice
item that the current crew size can't even reach (its `minPlayers`
exceeds `players`) forces the same forfeiture as a bag-weight overflow —
it's an illegal combo, not a silent drop — and drops Buyer's Choice
weighting from packing entirely (the *other*, reachable marked items are
no longer force-locked either, since the bonus is already guaranteed
forfeited).

`runOptimizer()` selects and assigns items via `packBins()` — see "Core
logic" below for why. `knapsack()` (plain single-bag 0/1 knapsack) and
`assignItemsToBags()` (First-Fit-Decreasing bin pack) are kept as
standalone, independently-tested primitives even though production
selection no longer calls them. `knapsack()` was originally kept as the
building block a future "Greedy" model would need for its "stack the
host's bag first" step — that model is now deprioritized (2026-08-02):
the even-split payout confirmation (see below) means stacking value into
one bag has zero effect on anyone's career progress, so Greedy no longer
has a rationale (see `internal/model-notes.md`'s "Greedy" section for the
full history). Both primitives stay only as tested building blocks now —
`knapsack()` for single-bag allocation, `assignItemsToBags()`'s
host-routing tie-break behavior covered directly by
`test/bin-packing.test.js` — not because Greedy is still on the roadmap.

`timeWeightFor(catItem)`, `exhibitTravelCost(floorSet)`, and
`packBinsForTime(items, bins, capacityPerBin)` (all added 2026-08-23) back
the "Experimental: time-optimized packing" Advanced Settings toggle — see
"Core logic" below for the full design (objective, scope, tiers,
algorithm). Kept alongside `packBins()` in the same file rather than a
separate module, matching how `knapsack()`/`assignItemsToBags()` already
sit next to it as alternate/legacy pack strategies.

## Persistence
Page 1 inputs (primary target, difficulty, weekly status, players, keep-
primary toggle, loot values/Buyer's Choice flags, Elite toggle, player
names, and the two Advanced Settings fields — `skipPreps`/
`experimentalPacking`, both added 2026-08-23) and Page 2's
`securityCombo` + `locked` fields all autosave to a single versioned
`localStorage` key (`kch-loot-ledger:v1`) on every input/change event, and
survive page refresh, closing/reopening the browser, and navigating
between pages. Parsing is defensive: a `schemaVersion` mismatch or
malformed/corrupted JSON falls back to defaults rather than throwing.
Hydration merges saved per-item loot values onto the freshly-fetched
catalog **by `itemId`**, never a wholesale replace of the loot list.
`page2.locked` toggles the security-combo input between editable and
`readonly` (never `disabled`, so it stays selectable/copyable/tabbable) —
a reversible fat-finger guard, not a security boundary, so there's no
confirmation dialog on unlock.

## Core logic
- Bag capacity = `players * 100`, but capacity is enforced **per player
  bag**, not as one pooled number — see `packBins()` below for why that
  distinction is load-bearing.
- **Optimizer is an exact multi-bin knapsack (`packBins()` in
  `kch-model.js`), not a pooled knapsack + separate bin-split.** Buyer's
  Choice items are passed in as mandatory (must all be included), the
  rest as optional (chosen to maximize value); `packBins()` searches
  directly over per-bag remaining capacity, so every value it reports is
  provably realizable as an actual per-player bag assignment. This
  replaced an earlier pooled-capacity design (2026-08-01 bug fix): fitting
  the pooled total (`players * 100`) does **not** guarantee the chosen
  items can be partitioned into fixed-size bags — bin packing can be
  infeasible even when the sum fits — and a real bug report (a bag
  showing 110% full) confirmed this happens with real catalog weights at
  every player count ≥2, not just larger crews. `packBins()` is only fast
  enough for an exact search because every catalog weight and the bag
  capacity share a common factor (10 today) — it computes that as a GCD
  rather than hardcoding /10, so it stays correct (just a bigger, still
  small, search) if a future item ever broke that pattern. (Power-drill
  loot, weight 5, was considered and deliberately excluded — its
  per-unit value is the lowest of anything in the KCH, not worth
  modeling — see the `_notes` in `secondary-loot.json`.)
- If Buyer's Choice items can't all be bin-packed into the crew's bags at
  all (`packBins()` returns null for the mandatory set), the Buyer's
  Request + Elite Challenge bonuses are marked as forfeited, and packing
  falls back to the same unconstrained value-max pack used when Elite
  isn't attempted. If a marked item is structurally unreachable for the
  crew size at all (`minPlayers` exceeds `players`), Buyer's Choice
  weighting is dropped from packing entirely the same way — the other,
  reachable marked items aren't force-included either, since forfeiture
  is already locked in and forcing them could only cost bag value for a
  bonus that can't pay out.
  **Real bug fix, 2026-09-12: combined Buyer's Choice weight is capped at
  100 (one bag), full stop — regardless of crew size.** Confirmed
  directly: "it is not possible for the heist to have elite challenge
  items going over 100 weight, PERIOD, even if there are more than one
  player." Before this fix, `runOptimizer()` called `packBins()` for the
  mandatory set against every one of the crew's bins, so at 2+ players a
  combined mandatory weight over 100 could still come back as a "fit"
  (e.g. 100 in the host's bag, 50 in a teammate's) — `allBuyerItemsFit`
  came back `true` and `guide.html`'s "Overweight" warning silently
  stopped appearing the moment a crew had more than one player, even
  though this combo is never actually legal in-game. Buyer's Choice items
  are collected as a single unit for Elite Challenge purposes; splitting
  them across separate players' bags was never how the mechanic works,
  regardless of what `packBins()`'s general-purpose multi-bin search can
  technically find room for. Fixed by checking `mandatoryWeightSum >
  bagCapacityPerPlayer` (100) BEFORE calling `packBins()` for the
  mandatory set at all, unconditionally — a no-op at 1 player (where
  `packBins()` already caught this for free, since a lone bin's capacity
  already IS the 100 cap), but now correctly forces the same forfeiture
  path at every crew size. `test/optimizer.test.js` covers this
  explicitly at 2, 3, and 4 players (three weight-50 Buyer's Choice items,
  150 combined, all individually reachable — a genuine weight-cap
  failure, not a `bcIneligibleIds`/`minPlayers` one).
- **Bag assignment follows a five-tier, value-preserving preference**
  (rewritten 2026-08-02, extended 2026-08-03, widened 2026-08-04, Vault
  tier added 2026-08-07, priority-floor processing order fixed 2026-08-09,
  refined 2026-08-10, refined again 2026-08-13, Alarm Floor added to tier
  0 2026-08-14, mandatory items given priority-pool precedence 2026-08-15):
  `packBins()`'s
  reconstruction step chooses *which bin* an item lands in — never which
  items get chosen or the total secondary value — by, in order: (0) `Vault`
  and `Alarm Floor` items exclude the
  host's bag specifically, whenever a non-host bag is also available
  (`HOST_AVOID_FLOORS`) — `Vault` confirmed with the user 2026-08-07: the host
  alone must physically enter the Vault for the Primary Target, so
  routing Vault secondary loot to a teammate instead lets it be grabbed
  in parallel rather than requiring the host to double back for it after
  the primary grab, which matters for the Elite Challenge's 17-minute
  clock. This reverses the floor's previous "deliberately neutral"
  status — falls back to including the host only when they're the sole
  remaining valid bag (a solo run, or every other bag already full).
  `Alarm Floor` joined the same set 2026-08-14, user request, for a
  different reason: the host's real route is Vault → building 2nd floor
  (tier 1 below) and never passes through Alarm Floor
  (`FLOOR_ADJACENCY`: `Alarm Floor` only touches `First`, not `Second`/
  `Crisp Gallery`), so a host bag that also picked up Alarm Floor loot —
  via tier 2/3/4, since it sat in neither `HOST_PRIORITY_FLOORS` nor
  `HOST_AVOID_FLOORS` before this — forced a genuine backtrack during the
  timed run; this is exactly the cross-floor mishmash the 2026-08-09 bug
  report showed. `First` Floor was considered and deliberately excluded
  from this tier (confirmed with the user): it neighbors `Second`/`Crisp
  Gallery` directly, so a host stop there isn't the same off-route
  detour;
  (1) `Second` and `Crisp Gallery` items prefer the host's bag
  specifically (`HOST_PRIORITY_FLOORS`, shared with
  `assignItemsToBags()`'s own separate mechanism below). `Crisp Gallery`'s
  piece of this is the original, narrower exception — the host is the more
  reliable player to verify in-room presence when using an EMP, given
  known desync behavior in that specific room. `Second` joined it
  2026-08-04, confirmed against real heist mechanics: the host must
  physically enter the Vault for the primary target at *every* crew size
  (2-4 players), and Loading Bay is mutually exclusive with that Vault
  visit by game mechanics (can be sequenced before or after, but not
  combined into one pass) — so the host's route naturally continues on to
  the building's 2nd floor (`Second` + `Crisp Gallery`) afterward.
  `Loading Bay` was deliberately **not** added to this tier: it's isolated
  with no clustering upside either way, and can still land in the host's
  bag when capacity/ordering happens to put it there — that's fine, since
  the host just sequences it before or after the Vault trip rather than
  combining them. (`Vault` is excluded from *this* tier for a different
  reason than Loading Bay — see tier 0 above, which now actively routes it
  away from the host instead of leaving it neutral.)
  **Real bug fix, 2026-08-09:** `packBins()` used to walk items strictly in
  catalog order (`Vault → Loading Bay → Alarm Floor → First → Second →
  Crisp Gallery`), so tier 1 only ever got a chance to fire once a
  Second/Crisp Gallery item's turn came up — it had no way to reserve host
  capacity ahead of time. A real 3-player run reported the host ending up
  with a cross-floor mishmash (Alarm Floor + First + only two of four
  scoped Second items) while a teammate got the Second/Crisp-Gallery-heavy
  bag that was supposed to be the host's: an early, low-priority item
  (Alarm Floor, processed first purely because tier 4/5's fallback still
  defaults perfectly-tied bins to bin 0) claimed the host bag, and tiers
  2/3's floor/adjacency clustering then snowballed more of that same floor
  into it before any Second/Crisp Gallery item was ever reached. Fixed by
  having `packBins()` walk every `HOST_PRIORITY_FLOORS` item ahead of every
  other floor, regardless of catalog position or mandatory/optional status
  — catalog order (the `order` field) remains the tiebreak *within* each
  priority bucket, so this is exactly as Elite-toggle-independent as
  before. Reordering only changes which of several equally-optimal bin
  partitions gets realized (the DP's optimal total value is provably
  invariant to processing order for a fixed set of symmetric bins) — it
  never changes total secondary value or which items get selected.
  **Real bug fix, 2026-08-10:** the 2026-08-09 fix above walked
  `HOST_PRIORITY_FLOORS` items ahead of every other floor, but *within*
  that priority bucket itself the two floors still fell back to plain
  catalog order — `Second`'s items (`2-A`..`2-D`) come before `Crisp
  Gallery`'s (`2-E`/`2-F`) in the catalog. A real report: when combined
  `Second` + `Crisp Gallery` weight exceeds one host bag, the smaller
  `Second` items greedily claimed most of the host's capacity first,
  leaving no room for a larger `Crisp Gallery` item that arrived later —
  it fell through to a teammate instead, and an unrelated `First`-floor
  item got adjacency-clustered in to round out the leftover capacity,
  forcing an avoidable extra floor stop. This was backwards: `Crisp
  Gallery`'s host-preference is the *stronger* of the two rationales (the
  EMP-desync room-verification requirement above), while `Second`'s is
  the *softer* one (the host's route just happens to pass through).
  Fixed by giving the priority bucket its own floor sub-rank — `Crisp
  Gallery` items are walked ahead of `Second` items whenever both are
  present, so `Crisp Gallery` always wins that capacity race regardless
  of catalog `order`. `order` still breaks ties within a single floor.
  Same invariance argument as the 2026-08-09 fix: this only changes which
  equally-optimal partition gets realized, never the total value or item
  selection.
  **Real bug fix, 2026-08-13:** even with floor-level ordering fixed, a
  same-floor problem remained *within* a single priority floor. A real
  2-player report: four smaller selected `Crisp Gallery` items (weights
  20, 30, 20, 10 — two of them Buyer's Choice-mandatory) walked in plain
  catalog order and claimed 80 of the host's 100 capacity, leaving only
  20 free — not enough for a fifth, larger selected `Crisp Gallery` item
  (Venus d'Algernon, weight 30, later in catalog order), which fell
  through to the teammate's bag while two unrelated `First`-floor items
  backfilled the host's leftover capacity instead, forcing an avoidable
  detour to First Floor. All five items summed to exactly 100 — a
  same-value, all-Crisp-Gallery host bag existed, catalog order just
  never found it. Fixed by walking priority-floor items
  largest-weight-first (a third sort key, between the floor sub-rank
  above and `order`) — the standard bin-packing fix for this shape of
  problem (place the least-flexible item first, while the most capacity
  is still open), the same rationale `assignItemsToBags()`'s own
  First-Fit-Decreasing already uses elsewhere in this file. Scoped to
  apply only *within* a priority floor (a no-op whenever either item
  being compared is non-priority), so no other tier or non-priority
  floor's processing order changes. `order` remains the final tiebreak
  among same-floor items of equal weight. Same invariance argument as the
  2026-08-09/2026-08-10 fixes: this only changes which equally-optimal
  partition gets realized, never the total value or item selection.
  **Real bug fix, 2026-08-15:** even with same-floor ordering fixed, a
  problem remained *across* the two priority floors specifically for
  mandatory items. A real 2-player report (Elite on, Buyer's Choice:
  Antique Rings, Coquard Bracelets, Horse Statue): four *optional* `Crisp
  Gallery` items were walked largest-first (per the 2026-08-13 fix) and
  greedily claimed 80 of the host's 100 capacity before the *mandatory*
  `Second` item (Horse Statue, weight 30) ever got a turn — only 20
  capacity remained, not enough for it, so it fell through to the
  non-host player purely because of processing order, while the host's
  leftover 10 capacity got backfilled by an unrelated `First`-floor item
  (Antique Rings) on what turned out to be a capacity tie between the two
  bags. Net result: the host bag carried a First-floor stray, and the
  non-host player ended up spanning Loading Bay + Alarm Floor + Second +
  First — a real cross-floor mishmash for both players. The user proposed
  pooling `Second` and `Crisp Gallery` for host-bag capacity instead of
  always ranking `Crisp Gallery` ahead of `Second`; a fully-flattened pool
  (dropping the floor sub-rank entirely) was tested and rejected — it
  broke the 2026-08-10 fix's own guarantee, letting a heavier optional
  `Second` item beat a lighter optional `Crisp Gallery` item for the
  host's last slot on a tie, reversing the EMP-desync rationale. Fixed
  instead by layering in `mandatoryRank` *above* the floor sub-rank (still
  gated to the priority pool, so it's a no-op elsewhere): a mandatory item
  now claims host capacity ahead of any optional priority-floor item on
  *either* floor. This only changes behavior when a mandatory and an
  optional item are competing in the pool — optional-vs-optional ties
  still fall through to the existing `Crisp Gallery`-over-`Second`
  sub-rank unchanged. Same invariance argument as every fix above: only
  changes which equally-optimal partition gets realized, never the total
  value or item selection.
  (2) otherwise, prefer a bin that already contains an item on the same floor (general
  floor-clustering, so a crew spends less time running between floors);
  (3) otherwise, prefer a bin that already contains an item on an
  *adjacent* floor per the real Kortz Center map (`Alarm Floor`↔`First`,
  `First`↔`Second`, `First`↔`Crisp Gallery`, `Second`↔`Crisp Gallery`;
  `Vault` and `Loading Bay` are isolated, adjacent to nothing including
  each other) — a softer nudge than exact-floor clustering, added after
  live testing showed a player routed straight from `Alarm Floor` to
  `Second`, skipping past `First`; (4) otherwise, prefer whichever bin
  has the most remaining capacity (spreads items across players by
  default). All five tiers only ever choose among bins already confirmed
  to preserve the optimizer's optimal total value — none of this can
  cost secondary value, and each tier falls through to the next when no
  value-preserving bin satisfies it, exactly like tier 1's host-bag
  fallback. Tier 1 traces to an earlier version that tried bin 0 first
  for literally *every* item (mandatory and optional alike), which is
  why Buyer's Choice loot used to land entirely in the host's bag — a
  real bug, not a rule.
  There's no fixed job-to-player-slot convention in real play (confirmed
  with the user 2026-08-04), so no per-player-index (P2/P3/P4) rules were
  added beyond the host/non-host split above — tiers 2-4 already produce
  reasonable, jobs-agnostic clustering for every non-host player once the
  host's items are placed first.
  `assignItemsToBags()` (the separate, unused-in-production
  First-Fit-Decreasing primitive — originally kept for a possible future
  "Greedy" model, since deprioritized, see `internal/model-notes.md`)
  still has its own, untouched `HOST_PRIORITY_FLOORS`/
  `HOST_PRIORITY_BOOST` logic bundling `Second`+`Crisp Gallery` — see
  `internal/model-notes.md`'s "Clarified model definitions" for the
  original "EMP" rationale that logic still reflects. `packBins()` now
  reads this same `HOST_PRIORITY_FLOORS` constant directly for tier 1
  above, rather than a separate `Crisp Gallery`-only constant, since the
  two happened to converge on the identical floor set.
- **`packBins()`'s bag assignment for a given selected item set is
  independent of Buyer's Choice/Elite status** (fixed 2026-08-04, real bug
  report: the same scope-out, resubmitted with Elite toggled on vs off,
  produced two different bag splits despite an identical secondary total
  and item selection). Root cause: `packBins()` built its working list as
  `[...mandatory, ...optional]`, so marking items Buyer's-Choice-mandatory
  pulled them to the front of the list, changing the order the four-tier
  reconstruction above walks items in — and when multiple bag partitions
  tie for the optimal value (as they did in the bug report), which one
  surfaces depended on this ordering accident, not on which was more
  sensible. Fix: every item passed to `packBins()` may carry an optional
  `order` field (mirrors the optional `floor` field — never touches
  value/weight/eligibility); the reconstruction stable-sorts by it before
  walking items, so callers that never set it (every pre-existing caller
  except `runOptimizer()`) see zero behavior change. `runOptimizer()`
  populates `order` from each item's position in the catalog-ordered
  `eligible` list, so reconstruction now always walks items in true
  catalog order regardless of which end up `mandatory` vs `optional`.
  **Reopened 2026-08-15, same day as the `mandatoryRank` fix below, and
  fixed again the same day:** `mandatoryRank` keyed its sort purely off
  `it.mandatory` — but `packBins()` only ever sets `mandatory: true` when
  Elite forces Buyer's Choice picks into the mandatory branch, so with
  Elite off `mandatoryRank` silently went back to a no-op and the
  pre-`mandatoryRank` crowding bug reappeared, even for an identical item
  selection (real report: same $712,000 scope-out, clean Second/Crisp-
  Gallery host bag with Elite on, a First-floor stray back in the host bag
  with Elite off). Fixed by threading `buyersChoice` through `toItem()` in
  `runOptimizer()` and widening the key to `(it.mandatory ||
  it.buyersChoice)` — a strict generalization, since every item
  `packBins()` ever marks `mandatory: true` is already `buyersChoice: true`
  by construction, so the Elite-on path is provably unaffected and Elite-
  off gains the missing protection. **Important scoping, discussed with the
  user before implementing:** this invariant only claims "same selected
  item set implies same bag split" — it does NOT claim Elite on/off always
  select the same items. Forcing a low value-density Buyer's Choice pick
  (e.g. a painting — every painting in this catalog is weight 50, the
  heaviest class, vs 10/20/30 for everything else) can cost enough value
  that the unconstrained Elite-off pack rationally drops it for something
  better, in which case the two states select different items and their
  splits are expected to differ too — not a regression, just two different
  knapsack problems. `test/pack-bins.test.js` has one test for each regime:
  a same-selection regression test (guarded by first asserting the
  item-id sets are actually equal) and a diverging-selection sanity test
  (guarded by asserting they're actually *not* equal, plus no overflow and
  Elite-off's value never falling below Elite-on's).
- **`compareCrewSizes()` (added 2026-08-04, two-column 2026-08-07) answers
  "would a different crew size pay more per player?"** for the loot values
  already entered — a supplementary panel on `guide.html`, never affecting
  the actual run's result above it. It sweeps player counts 1-4, calling
  `runOptimizer()` **twice** per size: once with `elite` forced to `'no'`
  (the original "No Elite" column, unchanged since 2026-08-04 —
  regardless of the real run's setting, since Elite Challenge completion
  is never guaranteed and shouldn't by itself skew which crew size looks
  best, so Buyer's Choice never constrains this column's packing, just the
  plain value-max pack), and once with `elite` forced to `'yes'` (the new
  "With Elite" column — user request: some crews still go for the Elite
  Challenge's bonus even though it's deliberately excluded from Career
  Progress, so whether the crew's actual Buyer's Choice marks still all
  fit at a given crew size matters to them too). Both columns report
  `secondaryShareEach` only (not the host's full payout with
  primary/bonuses) — precedented by `internal/kch_calculator_8.2.26.py`'s
  own solo/duo/trio/quad payout comparison, which computes the analogous
  "best secondary take" config. The With-Elite column is deliberately the
  *same* raw metric, not a fuller number with bonus dollars folded in —
  forcing Buyer's Choice items into packing can only match or reduce the
  raw share (never increase it), so the two columns stay directly
  comparable at a glance, and the bonus itself is presented as the
  separate reward for that trade-off rather than baked into this number
  (same reasoning `computeGuidePayout()` already applies to the Elite
  bonus). Each column highlights its own "best" crew size independently,
  since forcing Buyer's Choice in at one size can shift which size wins
  for that column without moving the other. Crew size still changes item
  *eligibility*, not just how a fixed total splits — Crisp Gallery items
  require `minPlayers: 2`, so a smaller crew's lower share can genuinely
  mean fewer reachable items, not just a bigger total split more ways;
  `guide.html`'s panel says this explicitly rather than leaving it to be
  inferred from the numbers alone.
  **Real bug fix, 2026-09-01: the With-Elite column's "BEST" tag could
  land on a crew size where Elite Challenge is flatly impossible.** A
  Buyer's Choice mark on a `minPlayers: 2` item (any Crisp Gallery item)
  makes Elite non-soloable — at 1 player that item drops out of
  `eligible` entirely, so the column falls back to the same unconstrained
  value-max pack the No-Elite column already shows for that crew size.
  An undivided solo share from that fallback is often the numerically
  *largest* raw number in the whole column (nobody to split with), so the
  old `Math.max()`-over-every-row logic tagged it "BEST" regardless —
  user report + screenshot, a genuinely non-soloable Elite scope showing
  a 1-Player "BEST" flag on the With-Elite column. Fixed by adding
  `eliteAchievable` to each row `compareCrewSizes()` returns
  (`withElite.attempted && withElite.allBuyerItemsFit` — mirrors
  `runOptimizer()`'s own `eliteEligible` exactly: a genuine Elite result,
  not a fallback wearing the column's raw-share metric), and gating
  `guide.html`'s `bestWith`/`isBestWith` computation on it — only rows
  where Elite is actually achievable at that crew size are eligible for
  the tag at all. A scope where Elite is unachievable at *every* crew
  size (rare, but possible) now shows no "BEST" tag on that column at
  all, rather than tagging a fallback number — the correct generalization
  of the same fix, not a special case for 1 player specifically.
- **Buyer's Choice *packing* is conditional on Elite Challenge, and needs
  at least 2 picks — but the Buyer's Request *bonus* is not conditional on
  Elite (decoupled 2026-08-07, see below).** Marking up to three items as
  Buyer's Choice only forces them into packing when Elite Challenge is
  toggled on. With Elite off, Buyer's Choice tags are purely informational
  in the manifest and the optimizer runs a single unconstrained pack over
  all scoped items to maximize bag value — no forced inclusion, no
  overflow state. **A single marked item can never satisfy Elite
  Challenge** (confirmed 2026-08-03, direct game knowledge) — 0 and 1
  marked-and-scoped picks resolve identically to "not attempted" for
  packing purposes (same unconstrained pack), only 2 or 3 actually lock
  packing. `guide.html` shows an explicit warning for both the 0- and
  1-pick case (one shared message, parameterized only by the count)
  rather than leaving it inferable only from the Finale Result's "not
  attempted" label.
- **Buyer's Request bonus is earned whenever the chosen bag selection
  happens to include every marked-and-scoped Buyer's Choice item, whether
  or not Elite Challenge was ever toggled on** (fixed 2026-08-07, real bug
  report: a 3-player run whose value-max *unconstrained* pack naturally
  contained all the marked items, but the tool still reported the bonus
  as unearned solely because Elite was off). Buyer's Request was always
  meant to reward *having* the marked items — Elite Challenge is a
  separate, harder contract (the sub-17-minute clock) layered on top, not
  a prerequisite for this bonus. The same >=2-marked-picks minimum still
  applies regardless of Elite status (confirmed with the user 2026-08-07:
  it's a Buyer's-Choice-contract minimum, not an Elite-specific one), so a
  single incidentally-packed marked item still never earns it. The Elite
  Challenge bonus itself is **not** decoupled — it still requires the
  toggle, since completing it depends on live-execution conditions (the
  clock) this tool can't verify from bag contents alone, unlike simply
  having grabbed the marked items. `runOptimizer()`'s `buyerRequestBonusEach`
  reflects this; `eliteBonusEach` is untouched.
- **Buyer's Request, Elite Challenge, and Helper bonuses all double on
  Hard mode**: $50k Buyer's Request / $50k-per-player Elite / $100k
  Helper on Normal, $100k / $100k-per-player / $200k on Hard.
- **Every player's secondary-loot cut is identical, and bag contents are
  economically irrelevant.** Confirmed 2026-08-02 against two real GTA
  payout screenshots: each player's share is `secondaryBagValue /
  players`, split evenly regardless of which bag any specific item
  physically landed in — bag/floor assignment (see above) is pure
  logistics with zero effect on payout. Host additionally gets the
  Primary Target value. **Every non-host player (P2–P4) unconditionally
  earns the flat Helper bonus** on top of everything else — not a
  per-run toggle, a fixed rule of the model (the all-even-split scenario
  from one of the two reference screenshots is deliberately no longer
  representable). If Buyer's Request is earned, every player gets the
  full bonus amount each, not a split pool. The repeat-run planning fee
  is a host-only cost, but is **not** netted against any player's payout
  (see below) — it's disclosed separately in the "Finale Result" ledger.
- **A per-player "Career Progress" figure exists, fulfilling the
  "deferred to a later round" note below.** `computeCareerProgress()` in
  `kch-model.js`: host = Primary Target + secondary share; everyone else
  = secondary share only. It excludes **every** bonus — Buyer's Request,
  Elite, and Helper alike — for every player, host included. This is
  deliberately a *different* number from Payout (below), rendered as its
  own, visually distinct line in each player's card on `guide.html`.
- **No combined "Total Take (Career Progress)" headline.** One used to
  show `primary.value + secondaryBagValue` (the crew-wide combined bag
  total), but the PM confirmed (2026-07-26, direct game knowledge) that
  career progress is actually tracked per-player, not the crew's combined
  total. The old line was removed as actively misleading rather than left
  in place. The per-player replacement that note deferred is the Career
  Progress figure above — don't reintroduce a crew-wide combined-total
  *framed as career progress*; the correct shape for that figure is
  per-player.
- **A different, plainly-labeled "Total Take" line was added 2026-08-04 —
  this is NOT a revival of the removed line above.** It shows the exact
  same arithmetic (`primary.value + secondaryBagValue`), in the Finale
  Result ledger right after the Primary Target/Secondary Targets lines it
  sums, but with a deliberately different framing: a purely comparative,
  crew-wide reference number ("how much did this heist generate in total,
  before any bonuses, fees, or splitting"), explicitly not presented as
  anyone's personal take or career progress. `guide.html` pairs it with an
  inline note saying exactly that, so the distinction from the
  still-removed career-progress framing stays unmistakable. The takeaway:
  the *number* was never the problem, the *framing* was — don't drop the
  disclaiming note if this line is ever touched again.
- **Page 2's per-player "Payout" figure (renamed from "Take" 2026-08-02 —
  it's the amount that actually hits the wallet) shows the Buyer's
  Request bonus but never projects the Elite Challenge bonus dollar
  amount**, even when one is earned at the model level. The Elite toggle
  still correctly makes Buyer's Choice mandatory for packing (an
  optimizer concern); omitting its bonus from Payout is display-only,
  because Elite success depends on live-execution conditions (the
  17-minute clock, etc.) this tool can't model or guarantee — `guide.html`
  instead shows a small note under Payout naming the exact dollar amount
  Elite would add on success. `computeGuidePayout()` in `kch-model.js` is
  the single source of truth for this total — it takes `secondaryShareEach`
  (never an individual bag's value), `buyerRequestBonusEach`, and
  `helperBonusEach` for non-hosts, but never `eliteBonusEach` and never
  the repeat-run planning fee.
- **"Keep Primary?" (`state.keepPrimary`, 2026-08-15) zeroes
  `primary.value` at the single source, `calcPrimary()`, not at each
  display/total site.** When `state.keepPrimary === 'yes'`, `calcPrimary()`
  short-circuits past the multiplier math entirely and returns `{ value:
  0, meta: p, kept: true }`. Every consumer of `primary.value` — the
  Finale Result ledger's Primary Target and Total Take rows, the host's
  player-card Primary Target row, `computeGuidePayout()`, and
  `computeCareerProgress()` — already just reads that field, so zeroing it
  once here is sufficient; **neither `computeGuidePayout()` nor
  `computeCareerProgress()` needed any changes at all.** `guide.html`
  reads the returned `kept` flag only for display, swapping the two
  Primary Target rows (ledger + host card) to "Kept — not sold" instead of
  a dollar figure, plus one small hint line under the ledger row
  reiterating that it's excluded from Total Take/Payout below — see
  `index.html`'s Step 1 entry above for the toggle itself and why it's
  disabled for the mandatory story target.
- **Experimental time-optimized packing (2026-08-23), behind
  `state.experimentalPacking`.** A second bag-*assignment* strategy for
  the exact same selected item set `packBins()` already chose — never a
  second knapsack, never a different total secondary value. Motivated by
  a real observed divergence: two identical scope-outs (same 8 items,
  same $577,500 total) produced two different bag splits when compared
  against an independent calculator — this tool's default split gave the
  host a 3-floor cross-building route (Alarm Floor → First → Crisp
  Gallery), while the other calculator kept the host to a tighter,
  fully-adjacent 2-floor route (First → Crisp Gallery) by routing the
  crew's one Alarm Floor item to the non-host player instead. Both splits
  were equally value-optimal — `packBins()`'s five-tier reconstruction
  heuristic (above) was never designed to minimize floor-hopping, only to
  cluster it a little.
  - **Scope is deliberately narrow: only exhibit floors** (Alarm Floor,
    First, Second, Crisp Gallery) **carry any time-cost at all.** Vault
    and Loading Bay contribute zero — both are effectively fixed,
    mandatory stops regardless of loot (the host must enter the Vault for
    the Primary Target either way), so this model only measures the
    genuinely discretionary exhibit-floor routing choice. Vault/Loading
    Bay items are still placed first, via a plain call to `packBins()`
    itself (as all-mandatory, no optional items) — reusing its
    already-correct `HOST_AVOID_FLOORS` tier-0 logic with zero duplicated
    code, confirmed with the user rather than assumed.
  - **Item time-weight tiers**, verified against the full catalog (no
    orphan bag-weight class left unhandled — every 30-weight exhibit item
    already requires the glass cutter): a glass-cutter item scores 3
    (takes the longest), a weight-10 item scores 1, everything else
    (weight 20, or weight 50/painting) scores 2.
  - **Travel cost is the real shortest-path distance** between the floors
    a bag touches, via a small MST over the pairwise BFS distances on the
    existing `FLOOR_ADJACENCY` graph `packBins()`'s tier 3 already uses —
    not a flat "distinct floors − 1" count. A flat count would treat
    Alarm Floor + Crisp Gallery as a single 1-hop cost, when both only
    connect through First (a real 2-hop detour) — this was a genuine hole
    identified and closed during design, before any code was written.
    With only 4 possible exhibit floors this is exact, not an
    approximation.
  - **Objective: minimize the max (bottleneck) per-player time-cost, not
    the total sum** — confirmed with the user directly (the crew is only
    as fast as its slowest player; a sum-minimizing objective could leave
    one player lopsidedly loaded if it lowered the total).
  - **An exact search, not a greedy heuristic** — a candidate max-cost
    threshold `T` is scanned from 0 upward, each checked via a memoized
    recursive feasibility search (per-bin state: remaining weight
    capacity, floor-touched bitmask, cumulative time-weight), and the
    first feasible `T` is the true minimum. A greedy "assign to the
    currently-lowest-cost bin" heuristic was considered and rejected —
    unlike an exact search, it isn't guaranteed to find a feasible
    packing even when one exists, the same class of bug `packBins()`
    itself was rewritten to avoid on 2026-08-01 (the pooled-knapsack-
    then-FFD-split bug). Reconstruction ties are broken by reusing
    `packBins()`'s existing tiers 2–4 (same-floor clustering →
    adjacent-floor → most remaining capacity → ascending bin index) —
    confirmed with the user — but *not* tier 1 (host-priority for
    Second/Crisp Gallery), since that's specifically about the value
    model's EMP-verification rationale, unrelated to this objective.
  - **Known limitation, accepted for "experimental" status**: placing
    Vault/Loading Bay items via a fresh, independent `packBins()` call
    isn't provably guaranteed to leave enough remaining capacity for the
    exhibit-item search to succeed in every theoretically possible case (a
    single joint search across both phases would close this gap, at real
    added complexity). In practice this is a non-issue for this catalog —
    Vault/Loading Bay items are few and comparatively light against
    100-capacity bags — but `packBinsForTime()` returns `null` rather
    than an invalid/overflowing bag if it ever can't find a feasible
    split, and `runOptimizer()` silently keeps the default
    value-preserving split for that run when that happens — always safe,
    since that's the split it would have produced anyway. This is a real,
    reproducible path, not just theoretical — see the shutter-duty fuzz
    test below, which hit it in practice (host-avoided Vault + Loading Bay
    items together starving the one non-host bin's remaining capacity for
    the exhibit-item phase).
  - **`tMax` bound fix (2026-08-24).** The threshold-scan's safe upper
    bound used to be hardcoded as `sum of time-weights + 3` ("3 = the max
    possible `exhibitTravelCost` across all 4 exhibit floors"), which went
    stale the moment `FLOOR_TRANSITION_COST` was bumped from `1` to `5`
    the same day this feature originally shipped — the true max is a
    3-edge MST × 5 = 15, not 3. Only misfires for a bin legitimately
    spanning 3-4 exhibit floors at a high time-weight sum (rare enough to
    have gone unnoticed), but the shutter-duty constraint below stresses
    this path harder on purpose. Fixed by deriving the bound from
    `TRAVEL_COST_BY_MASK`'s own max instead of a hardcoded number, so it
    can't drift out of sync with `FLOOR_TRANSITION_COST` again.
  - **Verification**: `test/pack-bins-for-time.test.js` includes a real
    regression fixture built from the two screenshots that motivated this
    feature (hand-verified true minimum bottleneck of 8, vs. 12 for this
    tool's own default split on the same items), direct `exhibitTravelCost()`
    adjacency tests, an `isItemReachable`/`skipPreps` gating test, a `tMax`
    regression test, and a 300-trial fuzz test asserting `experimentalPacking`
    never overflows a bag and never changes value/selection vs. the default
    run (extended 2026-08-24 to also check the shutter-duty invariant below)
    — same fuzzing convention as `test/pack-bins.test.js`'s own fuzz test.
- **Shutter/EMP hard constraints, experimental packing only** (2026-08-24;
  extended 2026-08-31 with a second role — see below). Real 3-player
  feedback on the model above (compared via `test/compare-packing.mjs`)
  surfaced a genuine blind spot: the experimental packer minimizes
  aggregate per-player time-cost, but originally had no concept of
  "shutter duty" at all — the real, mandatory task of operating the
  EMP/shutter console (physically on **First Floor**) to open Crisp
  Gallery access for the rest of the crew, which isn't represented as
  loot at all. An initial "observational" design (score whichever bags
  the packer already produced, recommend the least-bad one) was designed
  and hand-traced against the real feedback scope-out, then rejected: it
  can only ever pick the best of whatever split happened to result — if
  no bag in that split is genuinely well-positioned, "recommend the best
  of a bad set" doesn't fix anything. The real fix has to happen during
  bag *assignment* itself, as a genuine hard constraint on
  `packBinsForTime()`'s own exact search.
  **2026-08-31 correction: there are actually TWO distinct roles here,
  not one**, confirmed directly with the user after a real 4-player
  scope-out showed the host landing on Alarm Floor + First with zero
  Crisp Gallery presence at all:
  - **(a) Console operator** — opens the shutters from the First Floor
    console. Can be any non-host player. This is the ORIGINAL 2026-08-24
    design below and is unchanged.
  - **(b) In-gallery verifier** — must be physically inside Crisp Gallery
    and confirm presence BEFORE the EMP is triggered; popping it early
    (before the shutters are open, or before the verifying player is
    actually inside) locks everyone out. **Always the host**,
    unconditionally — not searched/optimized like (a), because it isn't
    interchangeable the same way. This role was missing entirely before
    2026-08-31 — see its own bullet below.
  - **Gated on Crisp Gallery actually being packed this run** (checked
    directly on the flat exhibit-item list `packBinsForTime()` already
    has) — if nothing gates access to open, there's nothing for a
    shutter operator to do, so the whole constraint is skipped, not just
    softened.
  - **Mechanism: a designated non-host bin gets a virtual First-Floor
    visit.** A key modeling gap closed during design: the model only ever
    learns a bag "touches First Floor" via an assigned First Floor loot
    item, but the console visit is a *location* requirement, not a loot
    one — a player can walk there and hit the console without carrying
    anything from there. Fixed by seeding one candidate non-host bin's
    starting floor-bitmask with the First-Floor bit *before* any items are
    assigned, rather than requiring an actual First Floor item to prove
    presence. A single-floor bitmask seeded at First costs 0 in
    `exhibitTravelCost` — specifically because First is one of the two
    real elevator stops (see the "Suggested floor-visit order" section's
    2026-08-24 elevator correction below; a single-floor bitmask is NOT
    free in general, only for First/Second), so this is free by itself —
    it only starts contributing travel cost once a second floor joins
    that same bin, exactly like a real visit combined with looting
    elsewhere. Every non-host bin is
    tried (the existing `buildChecker(T)`/threshold-scan search, wrapped
    to accept this optional seed); the lowest-bottleneck one wins, ties
    going to the lowest player index.
  - **Host is never tried FOR THIS ROLE, by design — not an oversight.**
    An earlier version tried the host as a last resort *for the
    console-operator role* if no non-host bin could satisfy the
    constraint, then fell back to an unconstrained search with a
    "constraint relaxed" warning if even that failed. Dropped after
    proving both paths are unreachable for any input this function
    actually receives: the virtual bit costs zero capacity, so for any
    bin `k`, whatever real item placement already makes the
    *unconstrained* problem feasible remains capacity-valid with the bit
    added, and that bin's cost still stays within `tMax` (which already
    accounts for the worst-case 4-floor travel cost) — so trying every
    non-host bin can never fail as long as the base problem is feasible at
    all, which callers already guarantee. The same proof extends cleanly
    to two simultaneous virtual bits on two different bins (see role (b)
    below) — they don't share capacity or interact. If a future change
    (e.g. a bigger exhibit-floor graph) ever invalidates this proof, the
    host-then-relaxed fallback is straightforward to reintroduce.
  - **(b) In-gallery verifier — always host, unconditional (2026-08-31).**
    Uses the exact same zero-capacity virtual-bit mechanism as (a), just
    applied unconditionally to bin 0 (host) whenever `needsShutters` —
    entirely independent of (a)'s search, which is untouched:
    ```js
    const CRISP_GALLERY_BIT = 1 << EXHIBIT_FLOOR_INDEX.get('Crisp Gallery');
    function initialMasks(forcedBin) {
      const m = zeros.slice();
      if (needsShutters) m[0] = CRISP_GALLERY_BIT;        // (b) host, always
      if (forcedBin !== null) m[forcedBin] = FIRST_FLOOR_BIT; // (a) searched, non-host
      return m;
    }
    ```
    Applies even in the `solveFor(null)` fallback (used when no console-
    operator candidate is found, or `bins < 2`) and even in a solo run
    (trivially satisfied there, since host has every item anyway) — the
    seed is gated only on `needsShutters`, not on `forcedBin`. Host's own
    route/bottleneck may get worse as a direct result (e.g. a real
    2F→1F→Alarm Floor walk) — explicitly accepted by the user: the
    requirement is that host is *guaranteed* Crisp Gallery presence, not
    that the crew-wide bottleneck stays minimal. The default
    (non-experimental) value model already gets this right via
    `packBins()`'s `HOST_PRIORITY_FLOORS` tier — this was a gap specific
    to the time-optimized model, which doesn't reuse that tier (see the
    reconstruction-tiers comment in `kch-model.js` for why).
  - **Return shape**: `packBinsForTime()` still returns
    `{ bags, shutterOperatorIndex }` — unchanged, since role (a)'s
    semantics didn't change. `runOptimizer()` additionally computes and
    returns a `neededGalleryPresence` boolean (whether role (b)'s
    guarantee applied this run at all — i.e. whether any packed item is
    on Crisp Gallery), independent of whether `packBinsForTime()` found a
    feasible split.
  - **No `guide.html` UI for either role (2026-08-31, user decision,
    reversing the original 2026-08-24 UI for role (a)).** See that page's
    entry under "Pages" above — the experimental view shouldn't
    accumulate UI the normal model lacks, which would nudge users toward
    an unfinished model ahead of real job/role modeling (backlog item 6)
    existing to back it up. Both constraints are still fully enforced;
    only the display is gone. `shutterOperatorIndex`/
    `neededGalleryPresence` remain on `runOptimizer()`'s result for tests
    and `test/compare-packing.mjs` (dev-only, unaffected by this UI
    principle).
  - **Explicitly out of scope for this pass**: a third "role" for the
    remaining non-host, non-shutter player(s) — pre-clearing Alarm
    Floor/First before moving on to Second/Crisp Gallery, raised in
    design discussion but deliberately deferred. Expected to emerge
    naturally from the existing floor-clustering reconstruction tiers
    (2-4, reused unchanged here) without a second explicit constraint.
    Not designed or built now.
  - **Future extensibility (not built now)**: the core algorithms here
    (memoized per-bin search, MST-based travel cost, minimax threshold
    scan) are unit-agnostic — they only ever sum and compare numbers.
    Real per-action timing data would slot in as: `timeWeightFor()`
    already reads whatever's in `catItem.lootTimeWeight`, so swapping
    that field's values from the current hand-tuned 1-5 scale to real
    seconds needs zero code changes; `FLOOR_TRANSITION_COST`'s flat
    per-hop cost would need `FLOOR_ADJACENCY` to become a weighted graph
    and `shortestFloorDistance()`'s BFS to become a real weighted-
    shortest-path calc (trivial at 6 floors); and the virtual First-Floor
    visit's implicit-zero cost would need its own explicit constant (e.g.
    `SHUTTER_ACTION_COST`) instead of `0`. User-confirmed calibration
    constraint for that future work: no individual action (one item's
    loot time, one floor transition, or the console operation itself)
    should exceed 30 real seconds.
  - **Verification**: `test/pack-bins-for-time.test.js` covers the gate
    (no Crisp Gallery packed → `shutterOperatorIndex: null`), a direct
    designation test (confirms the chosen bin's floor set genuinely
    includes First at zero marginal `exhibitTravelCost`), and the
    extended 300-trial fuzz test above (whenever Crisp Gallery is packed
    and `players >= 2`, `shutterOperatorIndex` must be `null` or a valid
    non-host index — never host, never out of range; `null` remains
    legitimate when `packBinsForTime()` fails entirely for the unrelated,
    pre-existing capacity-starvation reason above). `test/compare-
    packing.mjs` also prints the recommendation for manual spot-checks
    against real scope-outs.
    **2026-08-31 additions for role (b)**: a targeted fixture
    ("host in-gallery verifier...") built so the two roles are forced to
    genuinely conflict — an Alarm Floor item and a Crisp Gallery item
    each sized to fill one whole bag, where pairing Alarm Floor with
    host's mandatory (even if only virtual) Crisp Gallery visit costs a
    real 2-hop MST detour (10) vs. 0 for Crisp Gallery alone, so an exact
    bottleneck-minimizing search is provably forced to give host the real
    Crisp Gallery item, not Alarm Floor — proves the guarantee actually
    changes the outcome rather than being satisfied by the pre-existing
    capacity tie-break coincidentally; a companion gate test
    (`neededGalleryPresence: false` and host unaffected when no Crisp
    Gallery item is packed); and the fuzz test above extended to assert
    `neededGalleryPresence` exactly tracks whether any packed item is on
    Crisp Gallery, for every trial regardless of crew size.
- **Suggested floor-visit order (2026-08-24), display-only, experimental
  packing only.** Spot-checking shutter-duty against real scope-outs
  surfaced a follow-up gap: knowing *which* floors a bag touches isn't
  the same as knowing *what order* to visit them in, and order matters
  for real coordination — the shutter operator and the host both have
  concrete reasons to hit their key floor first, not whenever it happens
  to fall in an unordered set. The user also clarified the real
  movement pattern: crews loot Vault/Loading Bay first, then take the
  elevator up, and the elevator can drop a player at whichever exhibit
  floor they want — so **the first exhibit floor a player visits is
  free to reach; only transitions after that cost anything.** (**Corrected
  same day** — the elevator only actually serves First and Second, not
  Alarm Floor or Crisp Gallery; see the "Elevator correction" bullet
  below. The MST-encodes-it-for-free reasoning immediately below stayed
  right for the two served floors, just not for all four as originally
  written here.) That "first floor free" property turns out to already
  be exactly what `exhibitTravelCost()`'s MST computation encodes (a
  tree over N floors has N-1 paid edges) — the existing bottleneck-cost
  numbers needed no
  changes. What was missing was a literal visit order derived from that
  same MST.
  - **Display-only, same boundary as shutter-duty itself.**
    `packBinsForTime()`'s search and every existing return field are
    untouched — this is a new, purely-derived read on top of bags the
    packer already decided. Valid specifically because total travel
    cost is mathematically invariant to which floor is picked as the
    route's root (a real MST's total weight doesn't depend on its start
    node), so forcing a specific root for display can never contradict
    a cost number already computed. Scoped to exhibit floors only
    (Vault/Loading Bay stay outside this and the whole time-cost
    model's scope), and computed/rendered only when
    `state.experimentalPacking` is on.
  - **`deriveFloorRoute(floorSet, preferredRoot)`** (new export, next to
    `exhibitTravelCost()` in `kch-model.js`) resolves a root — the
    given `preferredRoot` if it's actually in `floorSet`, else the
    first `EXHIBIT_FLOOR_LIST` entry present — then walks the same
    greedy-nearest MST growth `exhibitTravelCost()` uses, but tracking
    real parent pointers instead of just a running total, and returns a
    DFS walk of that tree as an ordered floor array. Deliberately a
    separate function rather than a shared refactor of
    `exhibitTravelCost()` — that one sits in `packBinsForTime()`'s hot
    search path (backed by the precomputed `TRAVEL_COST_BY_MASK`) and
    already has passing test coverage, so it's left completely
    untouched; this one is only called a handful of times per optimizer
    run (once per bin), so duplicating its small loop is deliberate.
  - **Root-per-role**, computed in `runOptimizer()` right after
    `shutterOperatorIndex` is finalized: the shutter operator always
    roots at `'First'` (guaranteed reachable via the shutter-duty
    virtual bit — see the elevator-correction bullet below for why their
    `floorSet` also needs `'First'` added explicitly); the host roots at
    `'Second'` if present in their floor set, else `'Crisp Gallery'`
    (flipped same day — see the "Elevator correction" bullet below;
    `'Crisp Gallery'`-over-`'Second'` is still `packBins()`'s own
    sub-rank for *bin selection*, an unrelated value-model rationale —
    only the *route-rooting* priority flipped here); everyone else gets
    no preference and falls back to `deriveFloorRoute()`'s deterministic
    default. The operator is never the host by construction, so the two
    rules can
    never conflict. Attached to `runOptimizer()`'s result as
    `floorRoutes` (an array parallel to `bags`), `null` when
    `experimentalPacking` is off or `packBinsForTime()` returned no
    feasible split — same default pattern as `shutterOperatorIndex`.
  - **A real correctness bug found and fixed during implementation, not
    a naive port of insertion order:** the MST can branch, and a branch
    can sit more than one level deep. With all 4 exhibit floors in one
    bin, First is exactly 1 hop from each of the other three, so the
    true MST is often star-shaped — not a single path. A first-draft
    "push the immediate branch floor and move on" backtrack broke for a
    two-level branch (e.g. root `Second`, with `First -> Alarm Floor`
    two levels down): it jumped straight from `Alarm Floor` back to
    `Second`, silently implying they're directly adjacent when they're
    really 2 hops apart via First. Fixed by walking back up the REAL
    parent chain one floor at a time on every backtrack, never
    shortcutting — verified by an exhaustive test across every non-empty
    exhibit-floor subset and every root choice, asserting every
    consecutive route pair is a genuine 1-hop adjacency.
  - **Known, deliberately out-of-scope-for-this-pass simplification:**
    because `exhibitTravelCost()` charges each MST edge once (N-1 paid
    edges for N floors), a genuinely branching route's DISPLAYED
    bottleneck cost is a one-way spanning total, not the real
    round-trip distance a player walks once they have to backtrack to
    a second branch — the star-case route above, fully retraced, is 5
    real hops (25), while its floor set's `exhibitTravelCost()` total
    is only 3 edges (15). This gap already existed before this feature;
    making the route honest about backtracks just makes it visible for
    the first time. Not fixed here — `exhibitTravelCost()` stays
    untouched per the approved design — flagged as a real, quantifiable
    follow-up if branching routes turn out to be common enough in
    practice to matter.
  - **`guide.html` display removed entirely (2026-08-31) — see the
    dated correction at the end of this section.** This bullet describes
    the display as it originally shipped 2026-08-24, for history only:
    it rendered one small `.hint`-style line per player card, right
    after the player's name and before their item list, whenever
    `state.experimentalPacking` was on and that player's route had 2+
    floors: `Suggested order: Alarm Floor → First → Crisp Gallery`. A
    repeated floor name from a backtrack rendered exactly as the array
    gave it, deliberately not hidden, so the host wasn't misled into
    thinking it was one uninterrupted lap. It was never ported to
    `map-view.html`.
  - **Verification**: `test/floor-route.test.js` (new file) covers
    trivial empty/single-floor cases, unambiguous 2-3 floor orders, the
    star and two-level-branch cases above, preferred-root honoring and
    fallback, an exhaustive "route visits exactly the input floors"
    check across every non-empty subset and root choice, and a
    cross-check asserting the route's distinct-edge total always equals
    `exhibitTravelCost()`'s own number for the same floor set (ties the
    new function back to the already-validated cost model). Verified
    against both of this session's real scope-outs via
    `test/compare-packing.mjs` (extended to print each player's
    suggested order) — the host's route came back `Crisp Gallery →
    First → Alarm Floor` in both, matching the user's own description
    of the real movement pattern exactly; neither scope-out happened to
    hit the branching case.
  - **Elevator correction (2026-08-24, same day): the elevator only
    serves First and Second, not Alarm Floor or Crisp Gallery.** The
    design above originally assumed "the elevator can drop a player at
    whichever exhibit floor they want," which the user corrected after
    seeing the feature in action. This wasn't just wrong for this
    feature — it was a real, pre-existing bug in `exhibitTravelCost()`
    itself (shipped 2026-08-23, a day before this fix), whose
    `floors.length <= 1 -> return 0` special case had been silently
    treating a lone Alarm-Floor-only or Crisp-Gallery-only bag as free to
    reach, when it should cost one real hop from whichever elevator
    floor is nearest.
    - **Fix scope, proven exhaustively rather than assumed to be
      isolated:** with only 4 exhibit floors and only 2 of them unserved
      (Alarm Floor, Crisp Gallery), the *only* multi-floor subset that
      could possibly lack a served floor at all is
      `{Alarm Floor, Crisp Gallery}` itself — and its MST total is
      provably identical whether computed the old way (an arbitrary real
      floor as the free MST root — MST total is root-invariant) or
      routed through a free virtual elevator anchor first, since the
      shortest real path between them already goes through First either
      way. Every other 2+-floor subset already contains First and/or
      Second, so root-invariance alone already made the bug irrelevant
      there. The fix is therefore isolated to exactly two cases: the
      singleton `{Alarm Floor}` and singleton `{Crisp Gallery}` sets. New
      `ELEVATOR_FLOORS` constant (`{'First', 'Second'}`) in
      `kch-model.js`; `exhibitTravelCost()`'s `floors.length >= 2` MST
      loop needed **no changes at all**.
    - **A second, related bug found by the same investigation:** the
      shutter operator's `floorRoutes` root (`'First'`) was silently
      never honored whenever their real bag had no actual First-Floor
      item — exactly what both of this session's real scope-outs
      produced (a Crisp-Gallery-only operator bag).
      `deriveFloorRoute`'s `preferredRoot && floors.includes(preferredRoot)`
      check failed silently since `'First'` wasn't a *real* item floor
      for them, so it fell back to the generic default and the operator
      got **no route guidance at all** — defeating a real chunk of the
      feature's purpose for the one player who most needs "go to First"
      guidance. Fixed by seeding the operator's `floorSet` with
      `'First'` before calling `deriveFloorRoute()`, mirroring the same
      virtual-bit concept `packBinsForTime()`'s own search already uses
      to decouple "visited" from "looted" for this exact player.
    - **The host's root preference flipped to `'Second'` before
      `'Crisp Gallery'`** — Second is the real free elevator floor,
      Crisp Gallery isn't. This doesn't lose the "get to the critical
      room fast" intent: Crisp Gallery is directly adjacent to Second (1
      hop), so it still shows up as the route's very next stop in the
      common case — just now honestly, instead of implying zero-cost
      arrival there.
    - **`deriveFloorRoute()` itself** now prepends an implicit `'First'`
      entry whenever `floorSet` is drawn entirely from the two unserved
      floors, overriding any requested `preferredRoot` (a root that
      isn't reachable for free was never a valid "free first stop" to
      begin with) — `'First'` is hardcoded rather than computed
      generically, since for this specific 4-floor graph it's always at
      least as close as `'Second'` for both possible unserved floors
      (Alarm Floor: 1 hop vs 2; Crisp Gallery: 1 hop vs 1, a tie). A lone
      Alarm-Floor-only or Crisp-Gallery-only bag's route grows from a
      1-element ("nothing to show") route to a real 2-element one, e.g.
      `['First', 'Crisp Gallery']` — `guide.html`'s existing
      `route.length >= 2` display gate needed **no change**, since this
      is exactly the "something worth telling the player" case that gate
      already exists for.
    - **Re-verified against both of this session's real scope-outs**:
      Player 2 (shutter operator) and Player 3 (a Crisp-Gallery-only
      bag with no role), previously silent, now both show `First →
      Crisp Gallery`; their reported bottleneck/time-cost numbers rose
      by exactly 5 (the one real hop), e.g. 14 → 19 and 8 → 13 in the
      3-player scope-out. Total secondary value and item selection are
      unaffected in both, as expected.
    - **Verification**: `test/pack-bins-for-time.test.js` gained direct
      `exhibitTravelCost()` tests for the two previously-untested
      singleton cases (`{'Alarm Floor'}` and `{'Crisp Gallery'}`, both
      now 5, not 0) alongside the still-correct `{'First'}`/`{'Second'}`
      = 0 cases; the pre-existing "real regression fixture" and `tMax`
      regression tests were rerun (not just re-read) and confirmed
      unaffected, matching the exhaustive-proof reasoning above.
      `test/floor-route.test.js`'s exhaustive cross-check test (every
      non-empty subset × every root choice) needed no logic changes and
      passed immediately once both fixes landed together — confirming
      they're mutually consistent by construction, not just by
      inspection — plus two new explicit tests for the lone-Alarm-Floor
      and lone-Crisp-Gallery implicit-entry cases. Full suite: 141/141
      passing.
  - **Crisp Gallery co-location correction (2026-08-30), narrowing the
    fix above.** Surfaced comparing a real 2-player run (screenshotted,
    the tool's suggestion vs. what was actually played) against the
    tool's experimental output: **Crisp Gallery is physically the same
    floor as Second, not a separate level** — `floorMaps` in
    `data/secondary-loot.json` already documents this (they share one
    map image) — so reaching it after riding the elevator to Second is
    genuinely free, unlike Alarm Floor, which really is a separate
    level. The 2026-08-24 fix above was right that "any lone floor is
    free" was wrong, but had lumped Crisp Gallery in with Alarm Floor as
    if both were real separate levels, undercounting how cheap Crisp
    Gallery actually is (charging it a real hop it doesn't cost).
    - **Fix**: `ELEVATOR_FLOORS` widened to `{'First', 'Second', 'Crisp
      Gallery'}`. Only `Alarm Floor` remains unserved. This also
      simplifies the exhaustive proof from the 2026-08-24 fix: with just
      1 unserved floor instead of 2, no 2+-floor subset can ever lack a
      served floor at all (a subset of size 2+ either is all-served, or
      pairs Alarm Floor with at least one served floor) — the only
      floor set that can still lack a served floor is the singleton
      `{Alarm Floor}` itself. The `floors.length >= 2` MST loop still
      needed **no changes**, same as before.
    - **`deriveFloorRoute()`'s implicit-elevator-entry prepend** (see
      above) now only ever fires for the singleton `{Alarm Floor}` case
      — a lone Crisp Gallery route stands on its own (`['Crisp
      Gallery']`) same as First/Second, no more phantom `'First'` stop.
    - **The host's root-preference flip from the 2026-08-24 fix
      (`'Second'` before `'Crisp Gallery'`) is no longer a real cost
      difference** — both are equally free now — just a stable
      tie-break between two valid roots. Left as-is (Second-first)
      rather than reverted, since there's no reason to churn it.
    - **This also resolves an apparent inconsistency flagged mid-session
      before the real cause was known**: a host route rooted at Crisp
      Gallery (e.g. `Crisp Gallery → First → Alarm Floor`) looked
      "physically backwards" under the old model (implying free arrival
      somewhere unreachable for free) — it isn't backwards at all once
      Crisp Gallery is correctly known to be co-located with Second.
      No separate fix was needed for that once this one landed.
    - **Verification**: `test/pack-bins-for-time.test.js`'s lone-Crisp-
      Gallery test flipped from asserting `5` to asserting `0`, with a
      new comment explaining why (co-located with Second, unlike Alarm
      Floor); `test/floor-route.test.js`'s lone-Crisp-Gallery implicit-
      entry test was removed (folded into the lone-elevator-served-floor
      test instead, since Crisp Gallery no longer needs special
      treatment there) and its local `ELEVATOR_FLOORS` copy updated to
      match. Re-ran (not just re-read) the pre-existing "real regression
      fixture" and `tMax` regression tests — both fixture bags happen to
      span multiple exhibit floors already, so neither hits the changed
      singleton case, and both passed unaffected. Full suite: 141/141
      passing. Spot-checked against two real scope-outs via
      `test/compare-packing.mjs`: a Crisp-Gallery-only bag's time-cost
      dropped back down by exactly 5 (the phantom hop), and the shutter
      operator's suggested order and designation were both unaffected.
  - **Display wiring pulled back out (2026-08-31) — the whole feature
    described in this section was removed from `runOptimizer()` and
    `guide.html`, though `deriveFloorRoute()` itself and
    `test/floor-route.test.js` stay in the codebase untouched.** Same
    session as the "host in-gallery verifier" shutter-duty addition (see
    that section above) — reviewing a real 4-player scope-out surfaced
    that the per-player walking-itinerary display is genuinely
    job/role-sequencing territory, the exact thing backlog item 6 (no
    job/role assignment in the time model) is meant to own properly. The
    user's stated principle: the experimental view shouldn't accumulate
    UI features the normal model lacks, since that nudges people toward
    an unfinished/unvalidated model ahead of real job/role modeling
    existing to back it up — and the user's longer-term intent is a
    routing/role suggestor built for **both** the normal and
    time-optimized models together, once item 6 is actually designed, not
    an experimental-only extra shipped piecemeal in the meantime.
    - **What was removed**: the `floorRoutes` computation inside
      `runOptimizer()` (the `.map()` over `packedBags` calling
      `deriveFloorRoute()`) and the `floorRoutes` field on its returned
      object; the per-player "Suggested order: ..." `<p class="hint">`
      block in `guide.html`'s `renderItemsList()`; the `🧭` print block in
      `test/compare-packing.mjs`.
    - **What stayed**: `deriveFloorRoute()` itself in `kch-model.js` —
      correct, exhaustively tested, kept as a dormant utility for when
      item 6 picks this back up, the same precedent this file already
      sets for `knapsack()`/`assignItemsToBags()` (tested primitives kept
      even when unused in production). `test/floor-route.test.js` is
      untouched, since it tests `deriveFloorRoute()` directly, not
      through `runOptimizer()`.

## Known open questions (confirm before shipping)
- The source payout table also included values for runs where witnesses/CCTV
  were left behind (0.75x). That's an execution outcome, not a planning
  input, so it's been cut from primary-targets.json entirely — no field for
  it, nothing to wire up.
- Consumato's first-time-this-week value: confirmed in this data pull, unlike
  the earlier estimate — use the table value, not the old 4x-guess.

## Backlog (not yet started)
The Advanced Settings accordion and experimental time-optimized packing
model, both raised 2026-08-22, shipped 2026-08-23 — see `index.html`'s
Advanced Settings entry under Pages and "Core logic"'s experimental
time-optimized packing section below. A future "no EMP" toggle alongside
"Skip Glass Cutter prep" was floated but not designed or built — no slot
reserved for it in the accordion's markup, just a plausible next entry if
it's ever picked up. A shutter-duty hard constraint (later extended with
a second, host-specific in-gallery-verifier role — see "Core logic"
below), a suggested floor-visit-order display (built 2026-08-24, then
removed 2026-08-31 — see below), and a same-day elevator-access
correction to `exhibitTravelCost()` (First/Second only, later widened to
include Crisp Gallery since it's physically the same floor as Second)
were designed and built on the `feature/time-model-shutter-and-routing`
branch across 2026-08-24/2026-08-31 and merged to `main` 2026-08-31 —
see "Core logic" below for the full shutter/EMP-role design. Two other
plausible next entries surfaced 2026-08-24, neither designed or built:
hardening the shutter-duty recommendation into an actual scheduling
constraint if a route ever looks genuinely bad in practice, and
reconciling `exhibitTravelCost()`'s one-way MST total with the real
round-trip distance a branching route implies (this remains relevant
even with the floor-visit-order *display* gone, since `deriveFloorRoute()`
itself is still in the codebase as a dormant utility for item 6 below).

**Five items raised 2026-08-30, ranked by effort (also tracked in local
Claude Code memory — see `project_backlog_priority_ranking` and the
items it links to for full design detail):**

1. **Add the existing "Copy as CSV" scope-export button to `guide.html`
   too** (currently `index.html`-only) — trivial, zero `kch-model.js`
   changes, pure UI duplication of an existing button. **Shipped
   2026-09-11**: `guide.html` imports `buildScopeCsv` and gained its own
   `initCopyCsvControls()`, a straight duplicate of `index.html`'s
   (button markup, click handler, "Copied!"/`.copied` revert state) —
   consistent with this app's established "duplicate, don't share render
   code" convention (`map-view.html`/`map-scope.html` already do this for
   their own render helpers). Verified in-browser: clicking produces the
   same 34-line, catalog-ordered CSV as `index.html`.
2. **A separate "Copy as CSV" for the Crew Size Comparison table** —
   very small, one new pure function mirroring `buildScopeCsv()` plus a
   new button; not merged into the existing scope export (that's part of
   why a similar-looking change in PR #4 was rejected — see that PR's
   review comments). **Deliberately skipped 2026-09-11** (user call, right
   after item 1 shipped): doesn't seem useful enough on its own merit —
   parked rather than built, revisit only if it's independently requested
   by more than one other user. Not the same as "not designed" (item 3's
   original bar) — this one's fully spec'd and ready to pick up the moment
   real demand shows up.
3. **A shareable read-only link to a scope-out**, for handing teammates
   the shopping list/maps without screenshotting — fully designed
   (plaintext delimited URL encoding, no JSON/base64/dependencies, no
   player names, read-only render on open, buttons on both `guide.html`
   and `map-view.html`), zero open questions, ready to build.
4. **A clickable "best value" figure on the Crew Size Comparison panel**
   to switch the run to that player count — 4 open design questions
   still need a discussion pass first (persist vs. preview `state.players`,
   whether a With-Elite click also flips `state.elite`, confirm dialog or
   not, which cells are clickable).
5. **An Advanced Settings "Clear 1F and Alarm before vault?" toggle** —
   floated with real rationale but no mechanism designed yet for how it
   changes `packBinsForTime()`'s cost model. The two orderings have a
   real skill/risk tradeoff, not just a time difference: clearing Alarm
   Floor/First *before* the vault is faster (no detour after) but
   harder, since cameras aren't disabled yet and a downed guard's body
   being spotted trips the alarm, requiring a seasoned player to avoid
   it; clearing them *after* the vault is easier/safer, since the same
   EMP/camera-disable that opens Crisp Gallery access covers guard-body
   visibility by then.
6. **No job/role assignment in the time model** — the time-optimized
   packing conflates "which bag an item's value is attributed to" (a
   pure payout-split abstraction, correctly irrelevant to payout
   elsewhere in this tool) with "which player travels to grab it" — real
   crews don't follow that; whoever is routing through a room grabs
   what's there regardless of nominal bag ownership — and has no concept
   of task sequencing/sync points (the Vault as a convergence point, EMP
   timing, before/after-vault staging). A referenced independent
   calculator ("Maze") reportedly does model explicit per-player jobs.
   The real fix for item 5 above, but a substantially bigger redesign —
   recommended to design 5 and 6 together rather than separately, since 5
   is really a scoped-down piece of 6's larger problem. The user's stated
   longer-term intent (2026-08-31): once this is designed, a
   routing/role suggestor should be built for **both** the normal and
   time-optimized models together — see the "Display wiring pulled back
   out" note under "Core logic" for why nothing route-shaped ships
   experimental-only in the meantime.

Recommended build order: 1 → 2 → 3, then a design pass for 4, then 5 and
6 together.
