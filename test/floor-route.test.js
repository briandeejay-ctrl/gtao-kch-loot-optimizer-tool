import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveFloorRoute, exhibitTravelCost } from '../js/kch-model.js';

// Local, independent copy of the real floor-adjacency graph (matches
// FLOOR_ADJACENCY in kch-model.js, which isn't exported) — same
// "duplicate, don't share" convention test/pack-bins-for-time.test.js's
// own bagTimeCost() helper already follows, so this test doesn't
// silently trust the implementation's internal constants.
const EXHIBIT_FLOORS = ['Alarm Floor', 'First', 'Second', 'Crisp Gallery'];
// Keys are pre-sorted to match hops()'s [a, b].sort().join('|') exactly
// ('Crisp Gallery' sorts before 'First'/'Second' alphabetically) — got
// this wrong on the first pass (two keys built in "natural" reading
// order instead of sorted order), which silently produced `undefined`
// lookups. Caught by the tests below failing, not eyeballing.
const HOPS = {
  'Alarm Floor|First': 1,
  'First|Second': 1,
  'Crisp Gallery|First': 1,
  'Crisp Gallery|Second': 1,
  'Alarm Floor|Second': 2, // via First
  'Alarm Floor|Crisp Gallery': 2 // via First
};
function hops(a, b) {
  if (a === b) return 0;
  const key = [a, b].sort().join('|');
  return HOPS[key];
}
const FLOOR_TRANSITION_COST = 5;
// Local, independent copy of ELEVATOR_FLOORS (2026-08-24, Crisp Gallery
// added 2026-08-30) — the elevator only serves First and Second from the
// basement; Crisp Gallery is physically the same floor as Second (a
// different room, not a different level), so it's free too. Alarm Floor
// is a real separate level and is never a free entry point. Mirrors
// kch-model.js's own unexported constant.
const ELEVATOR_FLOORS = new Set(['First', 'Second', 'Crisp Gallery']);
// The floors a route must actually visit for a given input subset: the
// subset itself, plus an implicit 'First' whenever the subset contains
// no elevator-served floor at all — matches deriveFloorRoute()'s own
// virtual-entry logic, used below to compute expected sets/edge counts
// without hardcoding them per subset.
function effectiveFloors(floors) {
  return floors.some(f => ELEVATOR_FLOORS.has(f)) ? floors : ['First', ...floors];
}

test('empty floor set returns an empty route', () => {
  assert.deepEqual(deriveFloorRoute(new Set(), null), []);
});

test('a lone elevator-served floor returns a one-element route, no backtrack, no implicit entry', () => {
  assert.deepEqual(deriveFloorRoute(new Set(['First']), null), ['First']);
  assert.deepEqual(deriveFloorRoute(new Set(['Second']), null), ['Second']);
  // Crisp Gallery joined ELEVATOR_FLOORS 2026-08-30 -- physically the
  // same floor as Second, so it's free too, same as First/Second.
  assert.deepEqual(deriveFloorRoute(new Set(['Crisp Gallery']), null), ['Crisp Gallery']);
});

test('a lone Alarm Floor gets an implicit First Floor entry stop, since the elevator doesn\'t serve Alarm Floor directly', () => {
  assert.deepEqual(deriveFloorRoute(new Set(['Alarm Floor']), null), ['First', 'Alarm Floor']);
  // Any requested preferredRoot is overridden -- 'Alarm Floor' was never
  // a valid free first stop to begin with.
  assert.deepEqual(deriveFloorRoute(new Set(['Alarm Floor']), 'Alarm Floor'), ['First', 'Alarm Floor']);
});

test('two adjacent floors: unambiguous order, root first', () => {
  assert.deepEqual(deriveFloorRoute(new Set(['Alarm Floor', 'First']), 'First'), ['First', 'Alarm Floor']);
  assert.deepEqual(deriveFloorRoute(new Set(['Alarm Floor', 'First']), 'Alarm Floor'), ['Alarm Floor', 'First']);
});

test('three floors on a straight line (no branch): a clean, no-backtrack walk', () => {
  // Alarm Floor - First - Crisp Gallery: First is the only connector, but
  // with root Alarm Floor the tree is a straight line (Alarm->First->
  // Crisp Gallery, since Crisp Gallery's nearest in-tree floor once First
  // joins is First itself, not Alarm Floor) - no branch, no repeat.
  const route = deriveFloorRoute(new Set(['Alarm Floor', 'First', 'Crisp Gallery']), 'Alarm Floor');
  assert.deepEqual(route, ['Alarm Floor', 'First', 'Crisp Gallery']);
});

test('preferred root is honored when present in the floor set', () => {
  const route = deriveFloorRoute(new Set(['Second', 'Crisp Gallery', 'First']), 'Crisp Gallery');
  assert.equal(route[0], 'Crisp Gallery');
});

test('preferred root falls back to EXHIBIT_FLOOR_LIST order when not present in the floor set', () => {
  // 'First' isn't in this floor set at all -- falls back to the first
  // EXHIBIT_FLOOR_LIST entry that IS present (Second, before Crisp
  // Gallery in catalog/insertion order), never arbitrary Set order.
  const route = deriveFloorRoute(new Set(['Crisp Gallery', 'Second']), 'First');
  assert.equal(route[0], 'Second');
});

test('star case: all 4 exhibit floors, rooted at First (the shutter-operator scenario) — First is a 3-way hub, so the route backtracks to First twice', () => {
  const route = deriveFloorRoute(new Set(EXHIBIT_FLOORS), 'First');
  assert.deepEqual(route, ['First', 'Alarm Floor', 'First', 'Second', 'First', 'Crisp Gallery']);
  // Backtrack is real: First appears 3 times (root + 2 return trips).
  assert.equal(route.filter(f => f === 'First').length, 3);
});

test('two-level branch: root Second forces a genuine multi-hop backtrack (First -> Alarm Floor two levels down), and it must walk back through every real intermediate floor, not jump straight to the branch point', () => {
  const route = deriveFloorRoute(new Set(EXHIBIT_FLOORS), 'Second');
  assert.deepEqual(route, ['Second', 'First', 'Alarm Floor', 'First', 'Second', 'Crisp Gallery']);
  // The critical regression this guards: Alarm Floor must never sit
  // directly next to Second in the route (they're 2 hops apart) — every
  // consecutive pair must be a real 1-hop adjacency.
  for (let i = 0; i < route.length - 1; i++) {
    assert.equal(hops(route[i], route[i + 1]), 1,
      `${route[i]} -> ${route[i + 1]} must be a direct 1-hop adjacency, not a shortcut`);
  }
});

test('route visits exactly the input floors (plus an implicit First when neither elevator floor is present), no more, no fewer, for every non-empty subset and every root choice', () => {
  const subsets = [];
  for (let mask = 1; mask < 16; mask++) {
    subsets.push(EXHIBIT_FLOORS.filter((_, i) => mask & (1 << i)));
  }
  for (const floors of subsets) {
    const expected = new Set(effectiveFloors(floors));
    for (const root of [null, ...floors]) {
      const route = deriveFloorRoute(new Set(floors), root);
      assert.deepEqual(new Set(route), expected,
        `route for {${floors.join(',')}} rooted at ${root} must visit exactly {${[...expected].join(',')}}`);
      // A root is only honored when it's actually one of the real input
      // floors AND that subset already has a free elevator floor present
      // -- an unserved-only subset always forces 'First' regardless of
      // what root was requested (see deriveFloorRoute()'s own doc
      // comment on why that override is correct).
      if (root && floors.includes(root) && floors.some(f => ELEVATOR_FLOORS.has(f))) {
        assert.equal(route[0], root, 'route must start at the honored preferred root');
      }
    }
  }
});

// Cross-check: the new function must never silently disagree with the
// already-validated exhibitTravelCost() total. Since a branching route
// legitimately re-walks some edges (backtracking), sum only the DISTINCT
// (unordered) edges implied by consecutive route pairs, not every
// consecutive pair — that distinct-edge sum is the one-way MST total,
// which is what exhibitTravelCost() reports (see deriveFloorRoute()'s
// own doc comment for why the real round-trip distance is higher and
// deliberately not what's being checked here).
test('cross-check: distinct edges implied by the route sum to exactly exhibitTravelCost() for every non-empty subset and every root choice', () => {
  for (let mask = 1; mask < 16; mask++) {
    const floors = EXHIBIT_FLOORS.filter((_, i) => mask & (1 << i));
    const floorSet = new Set(floors);
    const expected = exhibitTravelCost(floorSet);
    const effectiveCount = effectiveFloors(floors).length;
    for (const root of [null, ...floors]) {
      const route = deriveFloorRoute(floorSet, root);
      const seenEdges = new Set();
      let total = 0;
      for (let i = 0; i < route.length - 1; i++) {
        const key = [route[i], route[i + 1]].sort().join('|');
        if (seenEdges.has(key)) continue;
        seenEdges.add(key);
        total += hops(route[i], route[i + 1]) * FLOOR_TRANSITION_COST;
      }
      assert.equal(total, expected,
        `{${floors.join(',')}} rooted at ${root}: distinct-edge route total must match exhibitTravelCost()`);
      assert.equal(seenEdges.size, effectiveCount - 1,
        `{${floors.join(',')}} rooted at ${root}: a valid spanning tree has exactly N-1 distinct edges (N including an implicit First, if any)`);
    }
  }
});
