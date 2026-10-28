import assert from "node:assert/strict";
import test from "node:test";
import { applyCatalogReference, searchPaintColors, PaintCatalogError } from "../src/paint-guide/catalog/catalog.js";

const color = (id: string, code: string, brand = "benjamin-moore") => ({
  id,
  name: "White Dove",
  code,
  brand: { slug: brand },
  hex: "#efeee5",
  lrv: 83,
  url: `https://paintdb.com/colors/${brand}/${id}`,
});
const ok = (data: unknown[], total = data.length) => new Response(JSON.stringify({ data, meta: { total } }), { status: 200 });

test("queries one supported brand by name/code and retains duplicate choices", async () => {
  let called = "";
  const result = await searchPaintColors({
    brand: "benjamin-moore", query: " OC-17 ", page: 1, pageSize: 10,
    fetchImpl: async (input) => { called = String(input); return ok([color("a", "OC-17"), color("b", "OC-18")], 25); },
  });
  const url = new URL(called);
  assert.equal(url.searchParams.get("brand"), "benjamin-moore");
  assert.equal(url.searchParams.get("q"), "OC-17");
  assert.equal(url.searchParams.get("offset"), "10");
  assert.deepEqual(result.colors.map((item) => item.id), ["a", "b"]);
  assert.equal(result.hasMore, true);
});

test("rejects unsupported brand and ignores malformed or cross-brand results", async () => {
  await assert.rejects(searchPaintColors({ brand: "farrow-ball" as never, query: "blue" }), { code: "unsupported_brand" });
  const result = await searchPaintColors({
    brand: "farrow-and-ball", query: "Railings",
    fetchImpl: async () => ok([
      color("wrong-brand", "01", "sherwin-williams"),
      { ...color("bad-hex", "02", "farrow-and-ball"), hex: "not-hex" },
      color("valid", "31", "farrow-and-ball"),
    ]),
  });
  assert.deepEqual(result.colors.map((item) => item.id), ["valid"]);
  assert.equal(result.colors[0].manufacturerVerified, false);
});

test("selecting a reference changes only color identity and keeps applied product and verified swatch separate", async () => {
  const { colors } = await searchPaintColors({ brand: "benjamin-moore", query: "White Dove", fetchImpl: async () => ok([color("bm-oc17", "OC-17")]) });
  const input = {
    colorName: "Old Color", colorCode: "OLD", colorOriginBrand: "", colorReferenceHex: "", colorReferenceProvider: "", colorReferenceId: "",
    colorReferenceUrl: "", colorReferenceRetrievedAt: "",
    brand: "Sherwin-Williams", product: "SuperPaint", sheen: "Satin", swatchHex: "#123456", swatchProvenance: "Can sticker photo",
  };
  const selected = applyCatalogReference(input, colors[0]);
  assert.equal(selected.colorName, "White Dove");
  assert.equal(selected.colorCode, "OC-17");
  assert.equal(selected.colorOriginBrand, "Benjamin Moore");
  assert.equal(selected.colorReferenceHex, "#EFEEE5");
  assert.equal(selected.colorReferenceProvider, "PaintDB");
  assert.equal(selected.colorReferenceUrl, "https://paintdb.com/colors/benjamin-moore/bm-oc17");
  assert.match(selected.colorReferenceRetrievedAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(selected.brand, "Sherwin-Williams");
  assert.equal(selected.product, "SuperPaint");
  assert.equal(selected.sheen, "Satin");
  assert.equal(selected.swatchHex, "#123456");
  assert.equal(selected.swatchProvenance, "Can sticker photo");
});

test("uses safe fallback for empty, malformed, network, HTTP and rate-limit responses", async () => {
  const none = await searchPaintColors({ brand: "sherwin-williams", query: "no result", fetchImpl: async () => ok([]) });
  assert.deepEqual(none.colors, []);
  await assert.rejects(searchPaintColors({ brand: "sherwin-williams", query: " " }), { code: "invalid_query" });
  await assert.rejects(searchPaintColors({ brand: "sherwin-williams", query: "valid", fetchImpl: async () => new Response("{}", { status: 429 }) }), { code: "rate_limited" });
  await assert.rejects(searchPaintColors({ brand: "sherwin-williams", query: "valid", fetchImpl: async () => new Response("no", { status: 503 }) }), { code: "http_error" });
  await assert.rejects(searchPaintColors({ brand: "sherwin-williams", query: "valid", fetchImpl: async () => new Response("no", { status: 200 }) }), { code: "invalid_json" });
  await assert.rejects(searchPaintColors({ brand: "sherwin-williams", query: "valid", fetchImpl: async () => { throw Error("hidden internal detail"); } }), (error: unknown) => {
    assert.ok(error instanceof PaintCatalogError);
    assert.equal(error.code, "network_error");
    assert.doesNotMatch(error.message, /hidden internal detail/);
    return true;
  });
});

test("aborts timed-out or cancelled requests without surfacing request internals", async () => {
  await assert.rejects(searchPaintColors({
    brand: "sherwin-williams", query: "blue", timeoutMs: 1,
    fetchImpl: (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })),
  }), { code: "timeout" });
  const controller = new AbortController();
  const pending = searchPaintColors({
    brand: "sherwin-williams", query: "blue", signal: controller.signal,
    fetchImpl: (_input, init) => new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true })),
  });
  controller.abort();
  await assert.rejects(pending, { code: "cancelled" });
});
