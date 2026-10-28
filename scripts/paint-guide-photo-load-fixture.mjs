import assert from "node:assert/strict";

// Sanitized workload only. No user identifiers, image bytes, credentials, or network calls.
const fixture = {
  totalPhotos: 36,
  coverBytes: 300_000,
  totalContextThumbnailBytes: 515_000,
  formulaLabelPhotos: 9,
  contextsIntersectingInitialViewport: 3,
};
const contextCount = fixture.totalPhotos - fixture.formulaLabelPhotos - 1;
assert.ok(contextCount > fixture.contextsIntersectingInitialViewport);

// Model the former eager <img> policy against the current high-priority cover
// plus IntersectionObserver-gated context photos. This counts scheduled bytes;
// it does not model server time, bandwidth, or device decode performance.
const averageContextThumbnailBytes = fixture.totalContextThumbnailBytes / contextCount;
const before = {
  initialRequests: contextCount + 1,
  initialBytes: fixture.coverBytes + fixture.totalContextThumbnailBytes,
};
const after = {
  initialRequests: fixture.contextsIntersectingInitialViewport + 1,
  initialBytes: fixture.coverBytes + Math.round(averageContextThumbnailBytes * fixture.contextsIntersectingInitialViewport),
};
const result = {
  classification: "synthetic scheduling estimate; not a network benchmark",
  fixture,
  before,
  after,
  avoidedInitialRequests: before.initialRequests - after.initialRequests,
  avoidedInitialBytes: before.initialBytes - after.initialBytes,
  avoidedInitialBytesPercent: Number(((before.initialBytes - after.initialBytes) / before.initialBytes * 100).toFixed(1)),
  elapsedTimeComparisonMs: null,
};
console.log(JSON.stringify(result, null, 2));
