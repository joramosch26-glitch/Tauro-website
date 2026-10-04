import assert from "node:assert/strict";
import test from "node:test";
import {
  createHomeownerNavigationController,
  installHomeownerHashNavigation,
  runHomeownerBootstrap,
} from "../src/paint-guide/homeowner/bootstrap.js";
import { exchangeHomeownerToken, fetchHomeownerDocument } from "../src/paint-guide/homeowner/client.js";
import { parseHomeownerGuideDocument } from "../src/paint-guide/homeowner/document.js";
import { captureHomeownerFragment } from "../src/paint-guide/homeowner/fragment.js";
import type { HomeownerGuideDocumentData } from "../src/paint-guide/presentation/types.js";

const fixture = (residenceName: string): HomeownerGuideDocumentData => ({
  guide: { residence_name: residenceName, primary_scope_note: null },
  locations: [], records: [], assignments: [],
});
const transportFixture = { schema_version: 1, ...fixture("Test Residence") };

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
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, schema_version: 2 }), null);
  assert.equal(parseHomeownerGuideDocument({ ...transportFixture, guide: { ...transportFixture.guide, primary_scope_note: 7 } }), null);
});
