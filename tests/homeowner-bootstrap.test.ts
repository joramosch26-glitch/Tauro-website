import assert from "node:assert/strict";
import test from "node:test";
import {
  createHomeownerNavigationController,
  installHomeownerHashNavigation,
  runHomeownerBootstrap,
} from "../src/paint-guide/homeowner/bootstrap.js";
import { exchangeHomeownerToken, fetchHomeownerDocument } from "../src/paint-guide/homeowner/client.js";
import { parseHomeownerGuideDocument } from "../src/paint-guide/homeowner/document.js";
import { buildHomeownerPhotoSources } from "../src/paint-guide/homeowner/photo-sources.js";
import { buildStaffPreviewPhotoSources, loadStaffPreviewPhotosProgressively } from "../src/paint-guide/staff/preview-photo-sources.js";
import { loadGuidePreviewData } from "../src/paint-guide/staff/guide-preview-loader.js";
import { captureHomeownerFragment } from "../src/paint-guide/homeowner/fragment.js";
import type { HomeownerGuideDocumentData } from "../src/paint-guide/presentation/types.js";
import type { PaintGuide } from "../src/paint-guide/data/types.js";

const fixture = (residenceName: string): HomeownerGuideDocumentData => ({
  guide: { residence_name: residenceName, primary_scope_note: null },
  locations: [], records: [], assignments: [],
});
const transportFixture = fixture("Test Residence");

test("staff preview starts photo hydration before deferred display metadata finishes", async () => {
  let releaseRecords!: (value: never[]) => void;
  let photoStarted!: () => void;
  const recordsGate = new Promise<never[]>((resolve) => { releaseRecords = resolve; });
  const photoStart = new Promise<void>((resolve) => { photoStarted = resolve; });
  const controller = new AbortController();
  const confirmedGuide: PaintGuide = {
    id: "guide-a", residence_name: "Guide A", status: "published", primary_scope_note: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  };
  let metadataPublished = false;

  const loading = loadGuidePreviewData({
    guideId: "guide-a",
    signal: controller.signal,
    getGuide: async () => confirmedGuide,
    listRecords: async () => recordsGate,
    listLocations: async () => [],
    listAssignments: async () => [],
    onGuideConfirmed: () => photoStarted(),
    onMetadataLoaded: () => { metadataPublished = true; },
    onNotFound: () => assert.fail("confirmed guide must not be reported missing"),
    onError: () => assert.fail("metadata request should remain pending"),
  });

  await photoStart;
  assert.equal(metadataPublished, false, "photo loading begins before metadata completion");
  releaseRecords([]);
  await loading;
  assert.equal(metadataPublished, true);
});

test("guide change aborts in-flight preview work and suppresses stale metadata updates", async () => {
  let releaseRecords!: (value: never[]) => void;
  let photosAborted!: () => void;
  const recordsGate = new Promise<never[]>((resolve) => { releaseRecords = resolve; });
  const controller = new AbortController();
  const photoController = new AbortController();
  const photoAborted = new Promise<void>((resolve) => { photosAborted = resolve; });
  const confirmedGuide: PaintGuide = {
    id: "guide-a", residence_name: "Guide A", status: "published", primary_scope_note: null,
    created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z",
  };
  let metadataPublished = false;
  let photoRequestStarted = false;
  let guideConfirmed!: () => void;
  const confirmed = new Promise<void>((resolve) => { guideConfirmed = resolve; });
  const versionId = "73000000-0000-4000-8000-000000000301";
  const placements = [{
    id: "cover",
    placement: "residence_cover" as const,
    locationId: null,
    recordId: null,
    photo: { slotId: "73000000-0000-4000-8000-000000000302", versionId },
  }];
  const published: string[] = [];
  let photoWork!: Promise<number>;

  const loading = loadGuidePreviewData({
    guideId: "guide-a",
    signal: controller.signal,
    getGuide: async () => confirmedGuide,
    listRecords: async () => recordsGate,
    listLocations: async () => [],
    listAssignments: async () => [],
    onGuideConfirmed: () => {
      photoRequestStarted = true;
      guideConfirmed();
      photoWork = loadStaffPreviewPhotosProgressively(placements, (_placement, signal) => new Promise<string>((_resolve, reject) => {
        signal.addEventListener("abort", () => {
          photosAborted();
          reject(new Error("aborted"));
        }, { once: true });
      }), (loadedVersion) => published.push(loadedVersion), photoController.signal);
    },
    onMetadataLoaded: () => { metadataPublished = true; },
    onNotFound: () => assert.fail("confirmed guide must not be reported missing"),
    onError: () => assert.fail("aborted work must not report an error"),
  });

  await confirmed;
  assert.equal(photoRequestStarted, true);
  controller.abort();
  photoController.abort();
  await photoAborted;
  assert.equal(await photoWork, 0, "aborted photo work settles without counting a failed image");
  releaseRecords([]);
  await loading;
  assert.equal(metadataPublished, false, "old guide metadata must not update a new route");
  assert.deepEqual(published, [], "the old guide must not publish a late image");
});

test("homeowner formula-label descriptors map to the protected full-size photo route", () => {
  const slotId = "73000000-0000-4000-8000-000000000101";
  const versionId = "73000000-0000-4000-8000-000000000102";
  const recordId = "73000000-0000-4000-8000-000000000103";
  const parsed = parseHomeownerGuideDocument({
    guide: { residence_name: "Synthetic QA", primary_scope_note: null },
    locations: [], records: [], assignments: [],
    photos: [{ slot_id: slotId, version_id: versionId, placement_kind: "record_formula_label", location_id: null, paint_record_id: recordId }],
  });
  assert.ok(parsed);
  assert.deepEqual(buildHomeownerPhotoSources(parsed.photos).formulaLabelPhotoUrls[recordId],
    [`/api/paint-guide/homeowner/photos/${versionId}`]);
});

test("staff preview maps current authorized photo versions to their exact presentation roles", () => {
  const cover = "73000000-0000-4000-8000-000000000111";
  const room = "73000000-0000-4000-8000-000000000112";
  const record = "73000000-0000-4000-8000-000000000113";
  const versionIds = [
    "73000000-0000-4000-8000-000000000121",
    "73000000-0000-4000-8000-000000000122",
    "73000000-0000-4000-8000-000000000123",
    "73000000-0000-4000-8000-000000000124",
  ];
  const placements = [
    { id: "cover", placement: "residence_cover" as const, locationId: null, recordId: null, photo: { slotId: cover, versionId: versionIds[0] } },
    { id: "room", placement: "location" as const, locationId: room, recordId: null, photo: { slotId: room, versionId: versionIds[1] } },
    { id: "context", placement: "record_context" as const, locationId: room, recordId: record, photo: { slotId: record, versionId: versionIds[2] } },
    { id: "label", placement: "record_formula_label" as const, locationId: null, recordId: record, photo: { slotId: cover, versionId: versionIds[3] } },
  ];
  const urls = new Map(versionIds.map((versionId, index) => [versionId, `blob:staff-preview-${index}`]));
  assert.deepEqual(buildStaffPreviewPhotoSources(placements, urls), {
    heroImageUrl: "blob:staff-preview-0",
    roomPhotoUrls: { [room]: "blob:staff-preview-1" },
    recordPhotoUrls: { [room]: { [record]: "blob:staff-preview-2" } },
    formulaLabelPhotoUrls: { [record]: ["blob:staff-preview-3"] },
  });
});

test("staff preview publishes priority photos progressively with bounded concurrency", async () => {
  const ids = {
    cover: "73000000-0000-4000-8000-000000000201",
    room: "73000000-0000-4000-8000-000000000202",
    context: "73000000-0000-4000-8000-000000000203",
    label: "73000000-0000-4000-8000-000000000204",
    room2: "73000000-0000-4000-8000-000000000205",
  };
  const placements = [
    { id: "label", placement: "record_formula_label" as const, locationId: null, recordId: ids.label, photo: { slotId: ids.label, versionId: ids.label } },
    { id: "context", placement: "record_context" as const, locationId: ids.room, recordId: ids.context, photo: { slotId: ids.context, versionId: ids.context } },
    { id: "room", placement: "location" as const, locationId: ids.room, recordId: null, photo: { slotId: ids.room, versionId: ids.room } },
    { id: "room2", placement: "location" as const, locationId: ids.room2, recordId: null, photo: { slotId: ids.room2, versionId: ids.room2 } },
    { id: "cover", placement: "residence_cover" as const, locationId: null, recordId: null, photo: { slotId: ids.cover, versionId: ids.cover } },
    { id: "duplicate-cover", placement: "residence_cover" as const, locationId: null, recordId: null, photo: { slotId: ids.cover, versionId: ids.cover } },
  ];
  const controller = new AbortController();
  const started: string[] = [];
  const published: string[] = [];
  let active = 0;
  let maximumActive = 0;
  let releaseRoom!: () => void;
  let roomStarted!: () => void;
  let releaseLabel!: () => void;
  let labelStarted!: () => void;
  let contextStarted!: () => void;
  const roomGate = new Promise<void>((resolve) => { releaseRoom = resolve; });
  const roomStart = new Promise<void>((resolve) => { roomStarted = resolve; });
  const labelGate = new Promise<void>((resolve) => { releaseLabel = resolve; });
  const labelStart = new Promise<void>((resolve) => { labelStarted = resolve; });
  const contextStart = new Promise<void>((resolve) => { contextStarted = resolve; });
  let complete = false;

  const result = loadStaffPreviewPhotosProgressively(placements, async (placement) => {
    const versionId = placement.photo!.versionId;
    started.push(versionId);
    active += 1;
    maximumActive = Math.max(maximumActive, active);
    if (versionId === ids.room) roomStarted();
    if (versionId === ids.context) contextStarted();
    if (versionId === ids.label) labelStarted();
    try {
      if (versionId === ids.room) await roomGate;
      if (versionId === ids.label) await labelGate;
      else await Promise.resolve();
      if (versionId === ids.context) throw new Error("synthetic image failure");
      return `blob:${versionId}`;
    } finally {
      active -= 1;
    }
  }, (versionId) => published.push(versionId), controller.signal, 2).then((failures) => {
    complete = true;
    return failures;
  });

  await roomStart;
  assert.equal(started[0], ids.cover, "hero should have first request priority");
  assert.equal(started[1], ids.room, "room overviews should precede details and labels");
  assert.ok(published.includes(ids.cover), "the hero should publish before the slow label finishes");
  assert.equal(complete, false, "the test holds a lower-priority request open");
  assert.equal(started.includes(ids.context), false, "details should wait until first-screen photos finish");
  releaseRoom();
  await contextStart;
  await labelStart;
  releaseLabel();
  assert.equal(await result, 1, "one failed image should be reported without discarding successes");
  assert.equal(maximumActive, 2, "the loader should respect its concurrency limit");
  assert.equal(started.filter((id) => id === ids.cover).length, 1, "a repeated version should be downloaded once");
  assert.deepEqual(published.sort(), [ids.cover, ids.label, ids.room, ids.room2].sort());
});

test("staff preview omits photos whose version was not returned by authorized image fetch", () => {
  const roomId = "73000000-0000-4000-8000-000000000132";
  const photo = { id: "room", placement: "location" as const, locationId: roomId, recordId: null, photo: { slotId: roomId, versionId: "73000000-0000-4000-8000-000000000133" } };
  assert.deepEqual(buildStaffPreviewPhotoSources([photo], new Map()), {
    heroImageUrl: null,
    roomPhotoUrls: {},
    recordPhotoUrls: {},
    formulaLabelPhotoUrls: {},
  });
});

type FakeLocation = { pathname: string; search: string; hash: string };

function createFakeBrowser(location: FakeLocation) {
  const replaceCalls: string[] = [];
  const listeners = new Set<() => void>();
  const history = {
    state: { preserved: true },
    replaceState(_state: unknown, _title: string, url?: string | URL | null) {
      replaceCalls.push(String(url));
      location.hash = "";
    },
  };
  const events = {
    addEventListener(_type: "hashchange", listener: () => void) { listeners.add(listener); },
    removeEventListener(_type: "hashchange", listener: () => void) { listeners.delete(listener); },
    emitHashChange() { listeners.forEach((listener) => listener()); },
  };
  return { location, history, events, replaceCalls };
}

test("initial homeowner token is scrubbed, exchanged once, and loaded once", async () => {
  const browser = createFakeBrowser({ pathname: "/paint-guide/p", search: "?view=current", hash: "#tpgh1.1.initial" });
  const capture = captureHomeownerFragment(browser.location as Location, browser.history as History);
  assert.deepEqual(browser.replaceCalls, ["/paint-guide/p?view=current"]);
  assert.equal(capture.token, "tpgh1.1.initial");
  let exchanges = 0;
  let documents = 0;
  const controller = createHomeownerNavigationController({
    exchangeToken: async () => { exchanges += 1; return true; },
    fetchDocument: async () => { documents += 1; return fixture("Initial"); },
  });
  await controller.start(capture.token);
  assert.equal(exchanges, 1);
  assert.equal(documents, 1);
  assert.deepEqual(controller.getSnapshot().state, { kind: "ready", document: fixture("Initial") });
});

test("same-runtime token navigation scrubs immediately and starts a new generation", async () => {
  const browser = createFakeBrowser({ pathname: "/paint-guide/p", search: "", hash: "#tpgh1.1.first" });
  const initial = captureHomeownerFragment(browser.location as Location, browser.history as History);
  const calls: string[] = [];
  const documents = [fixture("First"), fixture("Second")];
  const controller = createHomeownerNavigationController({
    exchangeToken: async (token) => { calls.push(`exchange:${token}`); return true; },
    fetchDocument: async () => { calls.push("document"); return documents.shift() ?? null; },
  });
  installHomeownerHashNavigation(
    browser.events as unknown as Window,
    () => captureHomeownerFragment(browser.location as Location, browser.history as History),
    controller.start,
  );
  await controller.start(initial.token);
  browser.location.hash = "#tpgh1.1.second";
  browser.events.emitHashChange();
  assert.equal(browser.location.hash, "");
  assert.equal(browser.replaceCalls.at(-1), "/paint-guide/p");
  await controller.whenIdle();
  assert.deepEqual(calls, ["exchange:tpgh1.1.first", "document", "exchange:tpgh1.1.second", "document"]);
  assert.deepEqual(controller.getSnapshot().state, { kind: "ready", document: fixture("Second") });
});

test("StrictMode subscribers share one operation for one navigation", async () => {
  let exchanges = 0;
  let documents = 0;
  const controller = createHomeownerNavigationController({
    exchangeToken: async () => { exchanges += 1; return true; },
    fetchDocument: async () => { documents += 1; return fixture("One"); },
  });
  const first = controller.subscribe(() => undefined);
  const second = controller.subscribe(() => undefined);
  await controller.start("tpgh1.1.one");
  first();
  second();
  assert.equal(exchanges, 1);
  assert.equal(documents, 1);
});

test("rapid token navigation serializes exchanges and keeps the latest result", async () => {
  const browser = createFakeBrowser({ pathname: "/paint-guide/p", search: "", hash: "" });
  const calls: string[] = [];
  let releaseFirstExchange!: () => void;
  const firstExchange = new Promise<void>((resolve) => { releaseFirstExchange = resolve; });
  const controller = createHomeownerNavigationController({
    exchangeToken: async (token) => {
      calls.push(`exchange:${token}`);
      if (token === "tpgh1.1.a") await firstExchange;
      return true;
    },
    fetchDocument: async () => {
      calls.push("document");
      return calls.includes("exchange:tpgh1.1.b") ? fixture("B") : fixture("A");
    },
  });
  installHomeownerHashNavigation(
    browser.events as unknown as Window,
    () => captureHomeownerFragment(browser.location as Location, browser.history as History),
    controller.start,
  );
  void controller.start("tpgh1.1.a");
  await Promise.resolve();
  browser.location.hash = "#tpgh1.1.b";
  browser.events.emitHashChange();
  assert.equal(browser.location.hash, "");
  assert.deepEqual(calls, ["exchange:tpgh1.1.a"]);
  releaseFirstExchange();
  await controller.whenIdle();
  assert.deepEqual(calls, ["exchange:tpgh1.1.a", "document", "exchange:tpgh1.1.b", "document"]);
  assert.deepEqual(controller.getSnapshot().state, { kind: "ready", document: fixture("B") });
});

test("third, malformed, and non-homeowner fragment navigation behave safely", async () => {
  const browser = createFakeBrowser({ pathname: "/paint-guide/p", search: "", hash: "" });
  const calls: string[] = [];
  const controller = createHomeownerNavigationController({
    exchangeToken: async (token) => { calls.push(token); return token === "tpgh1.1.c"; },
    fetchDocument: async () => fixture("C"),
  });
  installHomeownerHashNavigation(
    browser.events as unknown as Window,
    () => captureHomeownerFragment(browser.location as Location, browser.history as History),
    controller.start,
  );
  browser.location.hash = "#not%a%token";
  browser.events.emitHashChange();
  await controller.whenIdle();
  assert.equal(browser.location.hash, "");
  assert.deepEqual(controller.getSnapshot().state, { kind: "unavailable" });
  browser.location.hash = "#tpgh1.1.c";
  browser.events.emitHashChange();
  await controller.whenIdle();
  assert.deepEqual(controller.getSnapshot().state, { kind: "ready", document: fixture("C") });
  browser.location.pathname = "/paint-guide/g/example";
  browser.location.hash = "#staff-hash";
  browser.events.emitHashChange();
  assert.equal(browser.location.hash, "#staff-hash");
  assert.deepEqual(calls, ["not%a%token", "tpgh1.1.c"]);
});

test("bootstrap and browser API client fail closed and keep the token in the exchange body", async () => {
  let documentCalls = 0;
  assert.deepEqual(await runHomeownerBootstrap("tpgh1.1.token", { exchangeToken: async () => false, fetchDocument: async () => { documentCalls += 1; return fixture("Unused"); } }), { kind: "unavailable" });
  assert.equal(documentCalls, 0);
  assert.deepEqual(await runHomeownerBootstrap(null, { exchangeToken: async () => true, fetchDocument: async () => { throw new Error("network"); } }), { kind: "unavailable" });
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return calls.length === 1 ? new Response(null, { status: 204 }) : new Response(JSON.stringify(transportFixture), { status: 200 });
  };
  try {
    assert.equal(await exchangeHomeownerToken("tpgh1.1.private-token"), true);
    assert.deepEqual(await fetchHomeownerDocument(), fixture("Test Residence"));
  } finally { globalThis.fetch = originalFetch; }
  assert.equal(calls[0].input, "/api/paint-guide/homeowner/exchange");
  assert.equal(calls[0].init?.body, '{"token":"tpgh1.1.private-token"}');
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, undefined);
  assert.equal(calls[1].input, "/api/paint-guide/homeowner/document");
  assert.equal(calls[1].init?.body, undefined);
  assert.equal(calls[1].init?.headers, undefined);
});

test("document guard accepts only the presentation-safe response shape", () => {
  assert.deepEqual(parseHomeownerGuideDocument(transportFixture), fixture("Test Residence"));
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, schema_version: 1 }), null);
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, guide: { ...transportFixture.guide, primary_scope_note: 7 } }), null);
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, records: {} }), null);
});

test("homeowner client preserves approximate catalog swatches as distinct from applied paint brand", () => {
  const record = {
    id: "73000000-0000-4000-8000-000000000401", section: "primary", surface: "Walls",
    brand: "Sherwin-Williams", product: "SuperPaint", color_name: "White Dove", color_code: "OC-17",
    color_origin_brand: "Benjamin Moore", color_reference_hex: "#EFEEE5", color_reference_provider: "PaintDB",
    color_reference_url: "https://paintdb.com/colors/benjamin-moore/bm-oc-17-white-dove", color_reference_retrieved_at: "2026-10-28T12:00:00.000Z",
    sheen: "Satin", notes: null, sort_order: 0, created_at: "2026-10-03T12:00:00.000Z",
  };
  const parsed = parseHomeownerGuideDocument({
    ...transportFixture,
    records: [record],
  });
  assert.equal(parsed?.records[0].brand, "Sherwin-Williams");
  assert.equal(parsed?.records[0].color_origin_brand, "Benjamin Moore");
  assert.equal(parsed?.records[0].color_reference_hex, "#EFEEE5");
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, records: [{ ...record, color_reference_hex: "ivory" }] }), null);
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, records: [{ ...record, color_reference_provider: "Unknown Catalog" }] }), null);
});
