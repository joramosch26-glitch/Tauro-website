import assert from "node:assert/strict";
import test from "node:test";
import { Readable } from "node:stream";
import {
  localRuntimeApiModules,
  requestFromNode,
  resolveLocalRuntimeApiModule,
} from "../scripts/local-homeowner-http-runtime.mjs";

const staffRoutes = [
  ["status", "status.js"],
  ["issue", "issue.js"],
  ["recover", "recover.js"],
  ["rotate", "rotate.js"],
  ["revoke", "revoke.js"],
];

test("the local runtime maps every real staff access wrapper and leaves unknown routes unmapped", () => {
  for (const [operation, filename] of staffRoutes) {
    const pathname = `/api/paint-guide/staff/access/${operation}`;
    assert.equal(resolveLocalRuntimeApiModule(pathname), `api/paint-guide/staff/access/${filename}`);
  }
  assert.equal(resolveLocalRuntimeApiModule("/api/paint-guide/staff/access/unknown"), null);
  assert.equal(localRuntimeApiModules["/api/paint-guide/homeowner/exchange"], "api/paint-guide/homeowner/exchange.js");
});

test("the dispatcher forwards request method, authorization, origin, content type, and body unchanged", async () => {
  const nodeRequest = Object.assign(Readable.from([Buffer.from('{"guideId":"guide-id"}')]), {
    method: "POST",
    url: "/api/paint-guide/staff/access/status",
    headers: {
      authorization: "Bearer test-access-token",
      origin: "http://127.0.0.1:55400",
      "content-type": "application/json",
    },
  });

  const request = requestFromNode(nodeRequest);
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("authorization"), "Bearer test-access-token");
  assert.equal(request.headers.get("origin"), "http://127.0.0.1:55400");
  assert.equal(request.headers.get("content-type"), "application/json");
  assert.equal(await request.text(), '{"guideId":"guide-id"}');
});
