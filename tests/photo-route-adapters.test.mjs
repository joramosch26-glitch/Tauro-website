import test from "node:test";
import assert from "node:assert/strict";

const root = new URL("../api/paint-guide/", import.meta.url);

async function route(relativePath) {
  const loaded = await import(new URL(relativePath, root));
  assert.equal(typeof loaded.default?.fetch, "function");
  return loaded.default.fetch;
}

async function body(response) {
  return response.json();
}

test("staff photos route forwards GET query and authorization", async () => {
  const handler = await route("staff/photos.ts");
  const response = await handler(new Request("https://preview.invalid/api/paint-guide/staff/photos?guideId=abc", {
    headers: { authorization: "Bearer test-token" },
  }));
  assert.equal(response.status, 207);
  assert.equal(response.headers.get("x-route-fixture"), "preserved");
  assert.deepEqual(await body(response), {
    factory: "createStaffPhotosHandler", method: "GET",
    url: "https://preview.invalid/api/paint-guide/staff/photos?guideId=abc",
    authorization: "Bearer test-token", cookie: null, contentType: null, body: "",
  });
});

test("staff upload route forwards multipart stream, method and headers unchanged", async () => {
  const handler = await route("staff/photos.ts");
  const payload = "--fixture\r\nContent-Disposition: form-data; name=\"guideId\"\r\n\r\nabc\r\n--fixture--\r\n";
  const response = await handler(new Request("https://preview.invalid/api/paint-guide/staff/photos", {
    method: "POST", headers: {
      authorization: "Bearer upload-token", cookie: "staff-session=secret-test-value",
      "content-type": "multipart/form-data; boundary=fixture",
    }, body: payload,
  }));
  assert.equal(response.status, 207);
  assert.deepEqual(await body(response), {
    factory: "createStaffPhotosHandler", method: "POST",
    url: "https://preview.invalid/api/paint-guide/staff/photos",
    authorization: "Bearer upload-token", cookie: "staff-session=secret-test-value",
    contentType: "multipart/form-data; boundary=fixture", body: payload,
  });
});

test("staff version route preserves dynamic path, method, query and range headers", async () => {
  const handler = await route("staff/photos/[versionId].ts");
  const response = await handler(new Request("https://preview.invalid/api/paint-guide/staff/photos/00000000-0000-4000-8000-000000000001?variant=thumb", {
    method: "HEAD", headers: { authorization: "Bearer read-token", range: "bytes=0-3" },
  }));
  assert.deepEqual(await body(response), {
    factory: "createStaffPhotoReadHandler", method: "HEAD",
    url: "https://preview.invalid/api/paint-guide/staff/photos/00000000-0000-4000-8000-000000000001?variant=thumb",
    authorization: "Bearer read-token", cookie: null, contentType: null, body: "",
  });
});

test("staff slot route forwards DELETE and authorization", async () => {
  const handler = await route("staff/photo-slots/[slotId].ts");
  const response = await handler(new Request("https://preview.invalid/api/paint-guide/staff/photo-slots/00000000-0000-4000-8000-000000000002", {
    method: "DELETE", headers: { authorization: "Bearer delete-token", cookie: "staff-session=fixture" },
  }));
  assert.deepEqual(await body(response), {
    factory: "createPhotoSlotDeleteHandler", method: "DELETE",
    url: "https://preview.invalid/api/paint-guide/staff/photo-slots/00000000-0000-4000-8000-000000000002",
    authorization: "Bearer delete-token", cookie: "staff-session=fixture", contentType: null, body: "",
  });
});

test("homeowner version route forwards session cookie and response unchanged", async () => {
  const handler = await route("homeowner/photos/[versionId].ts");
  const response = await handler(new Request("https://preview.invalid/api/paint-guide/homeowner/photos/00000000-0000-4000-8000-000000000003?variant=full", {
    headers: { cookie: "paint_guide_session=fixture" },
  }));
  assert.equal(response.headers.get("x-route-fixture"), "preserved");
  assert.deepEqual(await body(response), {
    factory: "createHomeownerPhotoReadHandler", method: "GET",
    url: "https://preview.invalid/api/paint-guide/homeowner/photos/00000000-0000-4000-8000-000000000003?variant=full",
    authorization: null, cookie: "paint_guide_session=fixture", contentType: null, body: "",
  });
});

test("route preserves handler failure status and body", async () => {
  const handler = await route("staff/photos.ts");
  const response = await handler(new Request("https://preview.invalid/api/paint-guide/staff/photos?fixture-failure=true"));
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("x-route-fixture"), "preserved");
  assert.equal((await body(response)).factory, "createStaffPhotosHandler");
});
