import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const file = (relative) => fileURLToPath(new URL(relative, root));
const config = JSON.parse(readFileSync(file("vercel.json"), "utf8"));

const routes = [
  ["api/paint-guide/staff/photos.ts", "createStaffPhotosHandler"],
  ["api/paint-guide/staff/photos/[versionId].ts", "createStaffPhotoReadHandler"],
  ["api/paint-guide/staff/photo-slots/[slotId].ts", "createPhotoSlotDeleteHandler"],
  ["api/paint-guide/homeowner/photos/[versionId].ts", "createHomeownerPhotoReadHandler"],
];

test("Vercel build output remains dist and API paths are not captured by PaintGuide page rewrites", () => {
  assert.equal(config.outputDirectory, "dist");
  for (const rule of [...(config.rewrites ?? []), ...(config.redirects ?? [])]) {
    assert.equal(rule.source.startsWith("/api"), false, `API route shadowed by ${rule.source}`);
  }
  assert.deepEqual(config.rewrites.map((rule) => rule.source), ["/paint-guide", "/paint-guide/:path*"]);
});

test("all four photo URL shapes map to Vercel API function files and expected factories", () => {
  for (const [relative, factory] of routes) {
    assert.equal(existsSync(file(relative)), true, `missing function file ${relative}`);
    const source = readFileSync(file(relative), "utf8");
    assert.match(source, new RegExp(`import \\{ ${factory} \\}`));
    assert.match(source, new RegExp(`fetch: ${factory}\\(\\)`));
  }
  assert.equal(routes.some(([relative]) => relative.includes("/photos.ts")), true);
  assert.equal(routes.some(([relative]) => relative.includes("/[versionId].ts")), true);
  assert.equal(routes.some(([relative]) => relative.includes("/[slotId].ts")), true);
});
