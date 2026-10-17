import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer } from 'vite';

// Load the actual browser data modules with an in-process SDK replacement.
// No Auth identity, network call, live database or customer fixture is used.
let server, guides, locations, records, assignments, presentation, locationOrdering;
let planned = [], calls = [];
const slot = '__tauroPilotFunctionalClient';
function setup(responses) {
  planned = [...responses]; calls = [];
  globalThis[slot] = { from(table) {
    const response = planned.shift();
    assert.ok(response, 'Unexpected database operation');
    assert.equal(table, response.table);
    const trace = { table, steps: [] }; calls.push(trace);
    const query = {};
    for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'order', 'single', 'maybeSingle']) {
      query[method] = (...args) => { trace.steps.push([method, ...args]); return query; };
    }
    query.then = (resolve, reject) => Promise.resolve(response.result).then(resolve, reject);
    return query;
  } };
}
const result = (table, data, error = null) => ({ table, result: { data, error } });
const steps = (method) => calls.flatMap(c => c.steps.filter(s => s[0] === method));
const guideId = 'synthetic-guide', recordId = 'synthetic-record';
const recordInput = { section: 'exception', surface: ' Walls ', colorName: ' White ', brand: ' ', product: ' Primer ', colorCode: '', sheen: ' Satin ', notes: ' ', sortOrder: 10 };
before(async () => {
  server = await createServer({ configFile: false, envFile: false, optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, watch: null }, plugins: [{ name: 'synthetic-pilot-client', enforce: 'pre',
      resolveId(id, importer) {
        if (id === '../lib/supabase' && importer?.includes('/src/paint-guide/data/')) return '\0pilot-client';
      },
      load(id) { if (id === '\0pilot-client') return `export const supabase = { from(table) { const client = globalThis.${slot}; if (!client) throw new Error('Paint Guide is not configured.'); return client.from(table); } };`; },
    }] });
  [guides, locations, records, assignments, presentation, locationOrdering] = await Promise.all([
    'data/guides', 'data/locations', 'data/paint-records', 'data/paint-record-locations', 'presentation/homeowner-guide', 'data/location-order',
  ].map(path => server.ssrLoadModule(`/src/paint-guide/${path}.ts`)));
});
after(async () => { delete globalThis[slot]; await server?.close(); });

test('guide create/edit persist draft, status, optional note and exact guide identity', async () => {
  const created = { id: guideId, residence_name: 'Synthetic home', status: 'draft', primary_scope_note: null };
  const edited = { ...created, status: 'published', primary_scope_note: 'Walls only' };
  setup([result('paint_guides', created), result('paint_guides', edited), result('paint_guides', edited)]);
  assert.deepEqual(await guides.createPaintGuide({ residenceName: created.residence_name, primaryScopeNote: '' }), created);
  assert.deepEqual(await guides.updatePaintGuide(guideId, { residenceName: created.residence_name, primaryScopeNote: 'Walls only', status: 'published' }), edited);
  assert.deepEqual(await guides.getPaintGuide(guideId), edited);
  assert.deepEqual(steps('insert'), [['insert', { residence_name: 'Synthetic home', primary_scope_note: null, status: 'draft' }]]);
  assert.deepEqual(steps('update'), [['update', { residence_name: 'Synthetic home', primary_scope_note: 'Walls only', status: 'published' }]]);
  assert.deepEqual(steps('eq'), [['eq', 'id', guideId], ['eq', 'id', guideId]]);
  assert.equal(planned.length, 0);
});

test('guide absent/empty results and denied writes do not become successful saves', async () => {
  const denied = new Error('Synthetic permission denied');
  setup([result('paint_guides', null), result('paint_guides', null), result('paint_guides', null, denied), result('paint_guides', null)]);
  assert.equal(await guides.getPaintGuide(guideId), null);
  assert.deepEqual(await guides.listPaintGuides(), []);
  await assert.rejects(guides.createPaintGuide({ residenceName: 'Synthetic', primaryScopeNote: '' }), e => e === denied);
  await assert.rejects(guides.updatePaintGuide(guideId, { residenceName: 'Synthetic', primaryScopeNote: '', status: 'draft' }), /Could not save/);
});

test('locations preserve hierarchy on create; update/delete remain scoped to guide and location', async () => {
  const row = { id: 'room', guide_id: guideId, parent_id: 'floor', location_type: 'room', name: 'Room', sort_order: 20 };
  setup([result('guide_locations', row), result('guide_locations', { ...row, name: 'Edited' }), result('guide_locations', [{ id: 'room' }])]);
  assert.deepEqual(await locations.createGuideLocation({ guideId, parentId: 'floor', locationType: 'room', name: 'Room', sortOrder: 20 }), row);
  await locations.updateGuideLocation(guideId, 'room', { name: 'Edited', locationType: 'area' });
  await locations.deleteGuideLocation(guideId, 'room');
  assert.deepEqual(steps('insert'), [['insert', { guide_id: guideId, parent_id: 'floor', location_type: 'room', name: 'Room', sort_order: 20 }]]);
  assert.deepEqual(steps('update'), [['update', { name: 'Edited', location_type: 'area' }]]);
  for (const call of calls.slice(1)) assert.deepEqual(call.steps.filter(s => s[0] === 'eq'), [['eq', 'id', 'room'], ['eq', 'guide_id', guideId]]);
});

test('paint record writes normalize text and null optionals while preserving sections and order', async () => {
  const row = { id: recordId, guide_id: guideId };
  setup([result('paint_records', row), result('paint_records', row), result('paint_records', [{ id: recordId }])]);
  await records.createPaintRecord(guideId, recordInput);
  await records.updatePaintRecord(guideId, recordId, { ...recordInput, section: 'additional' });
  await records.deletePaintRecord(guideId, recordId);
  const expected = { section: 'exception', surface: 'Walls', color_name: 'White', brand: null, product: 'Primer', color_code: null, sheen: 'Satin', notes: null, sort_order: 10 };
  assert.deepEqual(steps('insert'), [['insert', { guide_id: guideId, ...expected }]]);
  assert.deepEqual(steps('update'), [['update', { ...expected, section: 'additional' }]]);
  for (const call of calls.slice(1)) assert.deepEqual(call.steps.filter(s => s[0] === 'eq'), [['eq', 'id', recordId], ['eq', 'guide_id', guideId]]);
});

test('location/paint record denied, validation-failed or zero-row mutations reject', async () => {
  for (const module of [locations, records]) {
    const table = module === locations ? 'guide_locations' : 'paint_records';
    const update = () => module === locations ? module.updateGuideLocation(guideId, 'missing', { name: 'Room', locationType: 'room' }) : module.updatePaintRecord(guideId, 'missing', recordInput);
    const remove = () => module === locations ? module.deleteGuideLocation(guideId, 'missing') : module.deletePaintRecord(guideId, 'missing');
    for (const error of [null, new Error('Synthetic constraint violation'), new Error('Synthetic permission denied')]) {
      setup([result(table, null, error), result(table, [], error)]);
      await assert.rejects(update()); await assert.rejects(remove());
    }
  }
});

test('list queries retain guide scoping and persisted ordering contracts', async () => {
  setup([result('guide_locations', []), result('paint_records', []), result('paint_record_locations', [])]);
  await locations.listGuideLocations(guideId); await records.listPaintRecords(guideId); await assignments.listPaintRecordLocations(guideId);
  for (const call of calls) assert.deepEqual(call.steps.filter(s => s[0] === 'eq'), [['eq', 'guide_id', guideId]]);
  for (const call of calls.slice(0, 2)) assert.deepEqual(call.steps.filter(s => s[0] === 'order'), [['order', 'sort_order', { ascending: true }], ['order', 'created_at', { ascending: true }], ['order', 'id', { ascending: true }]]);
  assert.deepEqual(calls[2].steps.filter(s => s[0] === 'order'), [['order', 'paint_record_id', { ascending: true }], ['order', 'location_id', { ascending: true }]]);
});

test('multi-selection deduplicates, preserves unchanged assignments and scopes removals', async () => {
  setup([result('paint_record_locations', [{ location_id: 'C' }]), result('paint_record_locations', [{ location_id: 'A' }])]);
  await assignments.savePaintRecordLocations(guideId, recordId, ['A', 'A', 'B'], ['B', 'C', 'C']);
  assert.deepEqual(steps('insert'), [['insert', [{ guide_id: guideId, paint_record_id: recordId, location_id: 'C' }]]]);
  assert.deepEqual(steps('eq'), [['eq', 'guide_id', guideId], ['eq', 'paint_record_id', recordId]]);
  assert.deepEqual(steps('in'), [['in', 'location_id', ['A']]]);
  setup([]);
  await assignments.savePaintRecordLocations(guideId, recordId, ['A', 'B'], ['B', 'A', 'A']);
  assert.equal(calls.length, 0);
});

test('clear selection removes only current assignments; failed additions never trigger removals', async () => {
  setup([result('paint_record_locations', [{ location_id: 'A' }, { location_id: 'B' }])]);
  await assignments.savePaintRecordLocations(guideId, recordId, ['A', 'B', 'A'], []);
  assert.deepEqual(steps('in'), [['in', 'location_id', ['A', 'B']]]);
  for (const response of [result('paint_record_locations', []), result('paint_record_locations', null, new Error('Synthetic denial'))]) {
    setup([response]);
    await assert.rejects(assignments.savePaintRecordLocations(guideId, recordId, ['A'], ['B']));
    assert.equal(calls.length, 1); assert.equal(steps('delete').length, 0);
  }
});

test('partial assignment writes surface a failure rather than reporting successful persistence', async () => {
  setup([result('paint_record_locations', [{ location_id: 'B' }]), result('paint_record_locations', [])]);
  await assert.rejects(assignments.savePaintRecordLocations(guideId, recordId, ['A'], ['B']), /Could not save/);
  assert.equal(calls.length, 2); // Existing two-request save is not atomic; caller must refresh.
});

const location = (id, parent_id = null, sort_order = 0) => ({ id, parent_id, name: id, sort_order, created_at: '2026-01-01T00:00:00Z' });
const paint = (id, section = 'exception', sort_order = 0) => ({ id, section, sort_order, created_at: '2026-01-01T00:00:00Z' });
test('homeowner presentation has stable ID tie-breaks, exact multi-location assignment and no input mutation', () => {
  const data = { guide: { residence_name: 'Synthetic' }, locations: [location('B'), location('A2', 'A'), location('A1', 'A'), location('A')], records: [paint('E2'), paint('P', 'primary'), paint('E1'), paint('Z', 'additional')], assignments: [{ paint_record_id: 'E1', location_id: 'A1' }, { paint_record_id: 'E1', location_id: 'A1' }, { paint_record_id: 'E1', location_id: 'B' }] };
  const snapshot = structuredClone(data);
  const a = presentation.buildHomeownerGuidePresentation(data);
  const b = presentation.buildHomeownerGuidePresentation({ ...data, locations: [...data.locations].reverse(), records: [...data.records].reverse() });
  assert.deepEqual(a.orderedLocations.map(x => x.id), ['A', 'A1', 'A2', 'B']);
  assert.deepEqual(b.orderedLocations, a.orderedLocations);
  assert.deepEqual(a.exceptionRecords.map(x => x.id), ['E1', 'E2']);
  assert.deepEqual(b.exceptionRecords, a.exceptionRecords);
  assert.deepEqual(a.recordsForLocation('A'), []); // No assignment inheritance to parents/siblings.
  assert.deepEqual(a.recordsForLocation('A1').map(x => x.id), ['E1']);
  assert.deepEqual(a.assignedLocationsForRecord('E1').map(x => x.id), ['A1', 'B']);
  assert.deepEqual(a.unassignedExceptionRecords.map(x => x.id), ['E2']);
  assert.deepEqual(data, snapshot);
});

test('orphan/unknown assignments do not silently hide exception records', () => {
  const data = { guide: {}, locations: [location('orphan', 'missing')], records: [paint('E1'), paint('E2')], assignments: [{ paint_record_id: 'E1', location_id: 'orphan' }, { paint_record_id: 'E2', location_id: 'unknown' }] };
  const p = presentation.buildHomeownerGuidePresentation(data);
  assert.deepEqual(p.orphanLocations.map(x => x.id), ['orphan']);
  assert.deepEqual(p.exceptionLocationGroups.map(x => x.location.id), ['orphan']);
  assert.deepEqual(p.unassignedExceptionRecords.map(x => x.id), ['E2']);
});

test('failed list queries propagate transport/authorization failures rather than showing empty data', async () => {
  const reads = [ ['paint_guides', () => guides.listPaintGuides()], ['guide_locations', () => locations.listGuideLocations(guideId)], ['paint_records', () => records.listPaintRecords(guideId)], ['paint_record_locations', () => assignments.listPaintRecordLocations(guideId)] ];
  for (const [table, read] of reads) {
    const error = new Error('Synthetic read denial'); setup([result(table, null, error)]);
    await assert.rejects(read(), e => e === error);
  }
});

test('staff location order stays deterministic across tied fetches, edits and new rows', () => {
  const a = location('A'); const b = location('B'); const c = location('C');
  const earlier = { ...location('Z'), created_at: '2025-12-31T23:59:59Z' };
  const laterOrder = location('D', null, 10);
  const compare = locationOrdering.compareGuideLocations;
  assert.deepEqual([b, laterOrder, a, earlier].sort(compare).map(x => x.id), ['Z', 'A', 'B', 'D']);
  const edited = { ...b, name: 'Updated synthetic room' };
  assert.deepEqual([edited, a].sort(compare).map(x => x.id), ['A', 'B']);
  assert.deepEqual([c, edited, a].sort(compare).map(x => x.id), ['A', 'B', 'C']);
});
