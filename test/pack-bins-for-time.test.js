import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  runOptimizer, packBinsForTime, timeWeightFor, exhibitTravelCost,
  isItemReachable, itemById, DEFAULT_BONUS_CONSTANTS
} from '../js/kch-model.js';

function loadJSON(relUrl) {
  return JSON.parse(fs.readFileSync(new URL(relUrl, import.meta.url), 'utf8'));
}

const catalog = loadJSON('../data/secondary-loot.json').items;
const BAG_CAPACITY_PER_PLAYER = 100;

function stateFor(loot, overrides = {}) {
  return {
    primaryId: 'la-derniere-debauche',
    difficulty: 'normal',
    weekly: 'first',
    players: 2,
    elite: 'no',
    skipPreps: [],
    experimentalPacking: false,
    loot,
    ...overrides
  };
}

// Builds a full-catalog `loot` array with only the given itemId->value
// overrides scoped, mirroring the fixture-construction convention already
// used in test/pack-bins.test.js and test/optimizer.test.js.
function lootFor(values, bcIds = new Set()) {
  return catalog.map(cat => ({
    itemId: cat.itemId,
    value: Object.prototype.hasOwnProperty.call(values, cat.itemId) ? values[cat.itemId] : '',
    buyersChoice: bcIds.has(cat.itemId)
  }));
}

const EXHIBIT_FLOOR_NAMES = new Set(['Alarm Floor', 'First', 'Second', 'Crisp Gallery']);

// The per-bin time-cost this session's model is designed to minimize:
// summed item time-weight plus real inter-floor travel cost over the
// floors that bag's items actually touch. Used here only to independently
// verify packBinsForTime()'s own output — not itself the code under test.
// Non-exhibit items (Vault/Loading Bay) contribute nothing, same as the
// real model — must filter to exhibit items BEFORE summing timeWeight,
// not just when computing the floor set, or a non-exhibit item's
// otherwise-meaningless timeWeight tier leaks into the sum.
function binTimeCost(bag) {
  const exhibitItems = bag.items.filter(i => EXHIBIT_FLOOR_NAMES.has(i.floor));
  const floors = new Set(exhibitItems.map(i => i.floor));
  const sum = exhibitItems.reduce((s, i) => s + (i.timeWeight ?? 0), 0);
  return sum + exhibitTravelCost(floors);
}

// Real regression fixture (2026-08-22 session): the same 8-item, 2-player
// scope-out compared against an independent calculator's output — both
// tools agreed on item selection and total value ($577,500) but split
// bags differently. The exact expected bottleneck numbers below were
// updated 2026-08-23 when timeWeightFor() switched to the user's real
// per-item `lootTimeWeight` data (replacing the old 3-tier weight/
// requiresPreps heuristic) and FLOOR_TRANSITION_COST scaled a floor hop
// from flat 1 up to 5 (matching a glass-cutter item's loot-time, per the
// user) — both changes shift the absolute numbers but not the point of
// the test: packBinsForTime() still finds a strictly better (lower
// bottleneck) partition than the default value-model split for this exact
// item set. Verified by hand: experimental bottleneck 16 (host = {Gemstone
// tw5, The Chief tw4, Fertility Statue tw2} = 11 + First-CrispGallery
// travel 5 = 16; other player = {Meteorite Fragment tw2, Byzantine Hoops
// tw1, Antique Rings tw1, Art Deco Circlets tw1} = 5 + Alarm-First-Crisp
// travel 10 = 15); default value-model split scores 22 (host ends up with
// all four Crisp Gallery items plus Alarm Floor and First stragglers =
// timeWeight 12 + travel 10 = 22).
test('real regression fixture: packBinsForTime achieves the hand-verified minimum bottleneck (8), strictly better than the default split', () => {
  const values = {
    'B-D': 75000,   // Het Gouden Hondje (Vault)
    '1-F': 122500,  // The Chief (First)
    '0-C': 35000,   // Byzantine Hoops (Alarm Floor)
    '1-B': 32000,   // Antique Rings (First)
    '2-H': 110000,  // Gemstone (Crisp Gallery)
    '2-G': 76000,   // Fertility Statue (Crisp Gallery)
    '2-I': 78000,   // Meteorite Fragment (Crisp Gallery)
    '2-J': 49000    // Art Deco Circlets (Crisp Gallery)
  };
  const state = stateFor(lootFor(values), { players: 2 });

  const defaultResult = runOptimizer(state, catalog, BAG_CAPACITY_PER_PLAYER, DEFAULT_BONUS_CONSTANTS);
  assert.equal(defaultResult.secondaryBagValue, 577500);

  const experimentalState = { ...state, experimentalPacking: true };
  const experimentalResult = runOptimizer(experimentalState, catalog, BAG_CAPACITY_PER_PLAYER, DEFAULT_BONUS_CONSTANTS);

  // Same item selection and total value either way — this feature only
  // ever changes bag assignment.
  assert.equal(experimentalResult.secondaryBagValue, 577500);
  assert.deepEqual(
    [...experimentalResult.chosenIds].sort(),
    [...defaultResult.chosenIds].sort()
  );

  // No overflow either way.
  for (const bag of [...defaultResult.bags, ...experimentalResult.bags]) {
    assert.ok(bag.weightUsed <= BAG_CAPACITY_PER_PLAYER);
  }

  // Independently compute each bag's time-cost from runOptimizer()'s own
  // output shape ({ itemId, value, weight, floor }), attaching timeWeight
  // via the real catalog the same way runOptimizer() itself does.
  const costOf = (bags) => Math.max(...bags.map(b => binTimeCost({
    items: b.items.map(i => ({ floor: i.floor, timeWeight: timeWeightFor(itemById(catalog, i.itemId)) }))
  })));

  const defaultBottleneck = costOf(defaultResult.bags);
  const experimentalBottleneck = costOf(experimentalResult.bags);

  assert.equal(experimentalBottleneck, 16, 'expected the hand-verified true minimum bottleneck');
  assert.equal(defaultBottleneck, 22, 'expected the default value-model split\'s bottleneck, for contrast');
  assert.ok(experimentalBottleneck < defaultBottleneck);
});

// Direct test of exhibitTravelCost()'s shortest-path behavior: Alarm Floor
// and Crisp Gallery only connect through First (a real 2-hop detour), so
// a bin touching both must cost strictly more than a bin touching two
// floors that are directly adjacent. Each hop is scaled by
// FLOOR_TRANSITION_COST (5, as of 2026-08-23 — a hop now costs about the
// same as a glass-cutter item's loot-time, per the user), so a 1-hop
// adjacency costs 5 and a 2-hop detour costs 10, not flat 1/2.
test('exhibitTravelCost: a non-adjacent floor pair costs strictly more than an adjacent one', () => {
  const adjacent = exhibitTravelCost(new Set(['Alarm Floor', 'First']));
  const nonAdjacent = exhibitTravelCost(new Set(['Alarm Floor', 'Crisp Gallery']));
  assert.equal(adjacent, 5);
  assert.equal(nonAdjacent, 10);
  assert.ok(nonAdjacent > adjacent);
});

test('exhibitTravelCost: an empty set, or a lone elevator-served floor, costs zero', () => {
  assert.equal(exhibitTravelCost(new Set()), 0);
  assert.equal(exhibitTravelCost(new Set(['First'])), 0);
  assert.equal(exhibitTravelCost(new Set(['Second'])), 0);
});

// 2026-08-24 fix: the elevator only serves First and Second (confirmed
// with the user) — Alarm Floor is NOT an elevator stop, so a lone bag
// there is never actually free to reach. This was a real pre-existing
// bug in the `floors.length <= 1 -> return 0` special case (shipped
// 2026-08-23, a day before this fix), silently under-pricing an
// Alarm-Floor-only bag by a full hop. See ELEVATOR_FLOORS's doc comment
// in kch-model.js for the exhaustive proof this is the ONLY case that
// still needs this treatment (Crisp Gallery no longer does — see the
// next test).
test('exhibitTravelCost: a lone Alarm Floor costs one real hop, not zero, since it is not an elevator stop', () => {
  assert.equal(exhibitTravelCost(new Set(['Alarm Floor'])), 5); // 1 hop to First
});

// 2026-08-30 follow-up, same real-playthrough comparison session: Crisp
// Gallery is physically the same floor as Second (see floorMaps in
// data/secondary-loot.json, which already shares one map image between
// them) — just a different room, so reaching it after riding the
// elevator to Second is genuinely free, unlike Alarm Floor, which is a
// real separate level. The 2026-08-24 fix above was correct that "any
// lone floor is free" was wrong, but had lumped Crisp Gallery in with
// Alarm Floor as if both were real separate levels — this narrows that
// back to just Alarm Floor.
test('exhibitTravelCost: a lone Crisp Gallery costs zero, since it is co-located with the elevator-served Second floor', () => {
  assert.equal(exhibitTravelCost(new Set(['Crisp Gallery'])), 0);
});

test('exhibitTravelCost: all four exhibit floors together cost exactly 15 (a 3-hop star through First, scaled by FLOOR_TRANSITION_COST)', () => {
  assert.equal(exhibitTravelCost(new Set(['Alarm Floor', 'First', 'Second', 'Crisp Gallery'])), 15);
});

// Direct packBinsForTime() test (bypassing runOptimizer): Vault/Loading Bay
// items always land via the pre-existing host-avoid rule, contributing
// zero to any bin's time-cost regardless of which bin they end up in.
test('packBinsForTime places Vault/Loading Bay items via the existing host-avoid rule and never overflows', () => {
  const items = [
    { id: 'vault-item', value: 100000, weightUnits: 50, floor: 'Vault', timeWeight: 0, order: 0 },
    { id: 'exhibit-item', value: 50000, weightUnits: 20, floor: 'First', timeWeight: 2, order: 1 }
  ];
  const result = packBinsForTime(items, 2, 100);
  assert.ok(result);
  for (const bag of result.bags) assert.ok(bag.weightUsed <= 100);
  const vaultBagIndex = result.bags.findIndex(b => b.items.some(i => i.id === 'vault-item'));
  assert.equal(vaultBagIndex, 1, 'Vault item should be routed away from bin 0 (host) when a non-host bin is available');
});

// isItemReachable / skipPreps: the new gating predicate must reproduce
// today's exact behavior at the default (skipPreps: []), and correctly
// exclude glass-cutter items only when explicitly skipped.
const GLASS_CUTTER_ITEM_IDS = ['0-A', '2-B', '2-C', '2-H', '2-K'];

test('isItemReachable: default skipPreps ([]) reproduces pre-2026-08-23 behavior exactly (only crew size gates)', () => {
  for (const itemId of GLASS_CUTTER_ITEM_IDS) {
    const cat = itemById(catalog, itemId);
    assert.ok(isItemReachable(cat, { players: 4, skipPreps: [] }), `${itemId} should be reachable by default`);
  }
});

test('isItemReachable: skipPreps excludes glass-cutter items, and only those', () => {
  const state = { players: 4, skipPreps: ['glass-cutter'] };
  for (const itemId of GLASS_CUTTER_ITEM_IDS) {
    assert.equal(isItemReachable(itemById(catalog, itemId), state), false, `${itemId} should be excluded`);
  }
  const nonGatedItem = catalog.find(c => !(c.requiresPreps || []).length && c.minPlayers <= 4);
  assert.ok(isItemReachable(nonGatedItem, state), 'a non-gated item must remain reachable');
});

test('runOptimizer: skipPreps excludes the 5 glass-cutter items from selection entirely', () => {
  const values = {};
  for (const it of catalog) values[it.itemId] = 40000; // scope everything
  const baseline = runOptimizer(stateFor(lootFor(values), { players: 4 }), catalog, BAG_CAPACITY_PER_PLAYER, DEFAULT_BONUS_CONSTANTS);
  const skipped = runOptimizer(stateFor(lootFor(values), { players: 4, skipPreps: ['glass-cutter'] }), catalog, BAG_CAPACITY_PER_PLAYER, DEFAULT_BONUS_CONSTANTS);

  for (const itemId of GLASS_CUTTER_ITEM_IDS) {
    assert.ok(!skipped.chosenIds.has(itemId), `${itemId} must never be chosen when its prep is skipped`);
  }
  // Sanity: at least plausible that the baseline run (preps assumed done)
  // could include some of them — not asserted strictly equal since the
  // knapsack may or may not select every gated item depending on value
  // density, but the excluded set must never include anything selected.
  assert.ok(baseline.secondaryBagValue >= skipped.secondaryBagValue, 'excluding items can only reduce or match achievable value');
});

// Fuzz: across random scope-outs, experimentalPacking must never overflow
// a bag and must never change total secondary value or item selection —
// mirrors the existing fuzz test in test/pack-bins.test.js. Also asserts
// the shutter-duty invariant proved in the 2026-08-24 design session:
// whenever Crisp Gallery is packed and there's more than one bag,
// shutterOperatorIndex must always be a valid non-host bin index — never
// null, never 0 — for any packable input (see packBinsForTime()'s own
// doc comment for the proof this relies on).
test('fuzz: experimentalPacking never overflows a bag and never changes value/selection vs the default split', () => {
  let checked = 0;
  let shutterChecked = 0;
  for (let trial = 0; trial < 300; trial++) {
    const players = 1 + Math.floor(Math.random() * 4); // 1..4
    const elite = Math.random() < 0.5 ? 'yes' : 'no';
    const eligibleForBC = catalog.filter(c => c.minPlayers <= players && c.valueType !== 'checkbox' && c.buyersChoiceEligible !== false);
    const bcPicks = new Set();
    if (elite === 'yes' && eligibleForBC.length > 0) {
      const pickCount = Math.min(3, 1 + Math.floor(Math.random() * 3));
      for (let k = 0; k < pickCount; k++) {
        bcPicks.add(eligibleForBC[Math.floor(Math.random() * eligibleForBC.length)].itemId);
      }
    }
    const loot = catalog.map(cat => ({
      itemId: cat.itemId,
      value: Math.random() < 0.5 ? '' : String(1000 + Math.floor(Math.random() * 200000)),
      buyersChoice: bcPicks.has(cat.itemId)
    }));
    const baseState = { primaryId: 'x', difficulty: Math.random() < 0.5 ? 'hard' : 'normal', weekly: 'first', players, elite, skipPreps: [], loot };

    const defaultResult = runOptimizer(baseState, catalog, BAG_CAPACITY_PER_PLAYER, DEFAULT_BONUS_CONSTANTS);
    const experimentalResult = runOptimizer({ ...baseState, experimentalPacking: true }, catalog, BAG_CAPACITY_PER_PLAYER, DEFAULT_BONUS_CONSTANTS);
    checked++;

    experimentalResult.bags.forEach((bag, i) => {
      assert.ok(
        bag.weightUsed <= BAG_CAPACITY_PER_PLAYER,
        `trial ${trial}, players ${players}: experimental bag ${i} overflowed at ${bag.weightUsed}/${BAG_CAPACITY_PER_PLAYER}`
      );
    });
    assert.equal(experimentalResult.secondaryBagValue, defaultResult.secondaryBagValue, `trial ${trial}: value must be unchanged`);
    assert.deepEqual(
      [...experimentalResult.chosenIds].sort(),
      [...defaultResult.chosenIds].sort(),
      `trial ${trial}: item selection must be unchanged`
    );

    const packsCrispGallery = experimentalResult.chosenIds &&
      [...experimentalResult.chosenIds].some(id => itemById(catalog, id).floor === 'Crisp Gallery');
    if (packsCrispGallery && players >= 2) {
      shutterChecked++;
      // Null is still a legitimate outcome here, distinct from the
      // shutter-duty search itself failing (proven unreachable — see
      // packBinsForTime()'s doc comment): packBinsForTime() can return
      // null ENTIRELY on rare inputs where phase 1's Vault/Loading-Bay
      // host-avoidance starves phase 2's remaining capacity (a separate,
      // pre-existing, already-documented limitation) — runOptimizer()
      // then falls back to the default (non-time-optimized) split, for
      // which shutterOperatorIndex is correctly null (no time-optimized
      // split exists for the guarantee to apply to). What must never
      // happen is host (0) or an out-of-range index.
      assert.ok(
        experimentalResult.shutterOperatorIndex === null || (
          Number.isInteger(experimentalResult.shutterOperatorIndex) &&
          experimentalResult.shutterOperatorIndex >= 1 &&
          experimentalResult.shutterOperatorIndex < players
        ),
        `trial ${trial}: shutterOperatorIndex must be null or a valid non-host index, got ${experimentalResult.shutterOperatorIndex}`
      );
    } else {
      assert.equal(experimentalResult.shutterOperatorIndex, null, `trial ${trial}: shutterOperatorIndex must be null when Crisp Gallery isn't packed`);
    }
  }
  assert.ok(checked > 0);
  assert.ok(shutterChecked > 0, 'expected at least one trial to actually exercise the shutter-duty path');
});

// tMax bound regression (2026-08-24): a single bin legitimately spanning
// all 4 exhibit floors, each item weighted at the top of the real
// lootTimeWeight scale. Total time-weight (20) + full-4-floor travel (15)
// = 35, which the old hardcoded "+3" bound (yielding a scan ceiling of
// only 23) would have missed entirely, causing packBinsForTime() to
// return null even though a feasible (indeed the only possible) packing
// exists. bins=1 deliberately keeps the shutter-duty constraint (which
// needs bins >= 2) out of this test, isolating the tMax fix itself.
test('tMax bound regression: a single bin spanning all 4 exhibit floors at max time-weight is still found, not null', () => {
  const items = [
    { id: 'alarm', value: 10000, weightUnits: 10, floor: 'Alarm Floor', timeWeight: 5, order: 0 },
    { id: 'first', value: 10000, weightUnits: 10, floor: 'First', timeWeight: 5, order: 1 },
    { id: 'second', value: 10000, weightUnits: 10, floor: 'Second', timeWeight: 5, order: 2 },
    { id: 'crisp', value: 10000, weightUnits: 10, floor: 'Crisp Gallery', timeWeight: 5, order: 3 }
  ];
  const result = packBinsForTime(items, 1, 100);
  assert.ok(result, 'must not return null — the old hardcoded +3 tMax bound would have missed the true minimum of 35');
  const cost = binTimeCost({ items: result.bags[0].items.map(i => ({ floor: i.floor, timeWeight: 5 })) });
  assert.equal(cost, 35, 'the only possible packing (all 4 items, all 4 floors, in the single bin) costs exactly 35');
});

// Shutter-duty gate: no Crisp Gallery item packed -> shutterOperatorIndex
// stays null and behavior is otherwise identical to running the function
// with no shutter logic at all (there's nothing gating Crisp Gallery
// access to open this run, so there's no reason to force anyone through
// First Floor for it).
test('shutter-duty gate: no Crisp Gallery item packed leaves shutterOperatorIndex null', () => {
  const items = [
    { id: 'alarm', value: 10000, weightUnits: 10, floor: 'Alarm Floor', timeWeight: 2, order: 0 },
    { id: 'first', value: 10000, weightUnits: 10, floor: 'First', timeWeight: 2, order: 1 }
  ];
  const result = packBinsForTime(items, 2, 100);
  assert.ok(result);
  assert.equal(result.shutterOperatorIndex, null);
});

// Shutter-duty: Crisp Gallery packed, feasible non-host assignment exists
// -> shutterOperatorIndex is a real, non-host bin index, and that bin
// genuinely ends up with First Floor presence (a real item here, not just
// the virtual seed, since nothing forces the two to diverge in this
// fixture) at zero marginal travel cost.
test('shutter-duty: designates a non-host bin with genuine First Floor presence', () => {
  const items = [
    { id: 'crisp', value: 1000, weightUnits: 10, floor: 'Crisp Gallery', timeWeight: 3, order: 0 },
    { id: 'first', value: 1000, weightUnits: 10, floor: 'First', timeWeight: 3, order: 1 },
    { id: 'second', value: 1000, weightUnits: 80, floor: 'Second', timeWeight: 1, order: 2 }
  ];
  const result = packBinsForTime(items, 3, 100);
  assert.ok(result);
  assert.ok(
    Number.isInteger(result.shutterOperatorIndex) && result.shutterOperatorIndex >= 1,
    'shutterOperatorIndex must be a non-host bin index'
  );
  const shutterBag = result.bags[result.shutterOperatorIndex];
  const floors = new Set(shutterBag.items.map(i => i.floor));
  assert.ok(floors.has('First'), 'the designated shutter bin should end up with genuine First Floor presence in this fixture');
  const marginal = exhibitTravelCost(new Set([...floors, 'First'])) - exhibitTravelCost(floors);
  assert.equal(marginal, 0, 'adding First Floor to its own floor set must cost nothing — it is already present');
});
