import assert from "node:assert/strict";
import test from "node:test";
import {
  accessAvailabilityMessage, accessControls, copyStaffPrivateUrl, parseStaffAccessResponse, requestStaffAccess,
  StaffAccessClientError, type StaffAccessStatus,
} from "../src/paint-guide/staff/access-client.js";

const GUIDE = "73000000-0000-4000-8000-000000000101";
const TOKEN = "tpgh1.1.abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
const URL = `http://127.0.0.1:55400/paint-guide/p#${TOKEN}`;
function status(accessState: StaffAccessStatus["accessState"] = "active", guideStatus: StaffAccessStatus["guideStatus"] = "published"): StaffAccessStatus {
  return { guideId: GUIDE, guideStatus, accessState, tokenGeneration: accessState === "absent" ? null : 2,
    sessionEpoch: accessState === "absent" ? null : 3, homeownerExchangeAvailable: guideStatus === "published" && accessState === "active" };
}

test("staff access responses are strict and status alone cannot reveal a private URL", () => {
  assert.deepEqual(parseStaffAccessResponse(status(), false), status());
  assert.equal(parseStaffAccessResponse({ ...status(), privateUrl: URL }, false), null);
  assert.equal(parseStaffAccessResponse(status(), true), null);
  assert.deepEqual(parseStaffAccessResponse({ ...status(), privateUrl: URL }, true), { ...status(), privateUrl: URL });
  assert.equal(parseStaffAccessResponse({ ...status(), privateUrl: "https://example.test/paint-guide/p#bad" }, true), null);
  assert.equal(parseStaffAccessResponse({ ...status("revoked"), privateUrl: URL }, true), null);
});

test("availability copy and owner/supervisor controls distinguish lifecycle from access", () => {
  assert.equal(accessAvailabilityMessage(status("absent")), "No homeowner access has been issued.");
  assert.equal(accessAvailabilityMessage(status("active", "draft")), "Not available until this guide is published.");
  assert.equal(accessAvailabilityMessage(status("active", "archived")), "Unavailable while this guide is archived.");
  assert.equal(accessAvailabilityMessage(status("revoked")), "Unavailable. Access has been revoked.");
  assert.deepEqual(accessControls("owner", status(), true), { issue: false, recover: true, copy: true, rotate: true, revoke: true });
  assert.deepEqual(accessControls("supervisor", status(), false), { issue: false, recover: true, copy: false, rotate: false, revoke: false });
  assert.deepEqual(accessControls("owner", status("revoked"), false), { issue: false, recover: false, copy: false, rotate: true, revoke: false });
});

test("browser client sends only the staff bearer and exact endpoint bodies without persistence or retries", async () => {
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  const fetcher: typeof fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json({ ...status(), privateUrl: URL });
  };
  const response = await requestStaffAccess("rotate", "staff-access-token", { guideId: GUIDE, expectedTokenGeneration: 2, expectedSessionEpoch: 3 }, fetcher);
  assert.equal(response.privateUrl, URL);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].input, "/api/paint-guide/staff/access/rotate");
  assert.equal((calls[0].init?.headers as Record<string, string>).Authorization, "Bearer staff-access-token");
  assert.deepEqual(JSON.parse(String(calls[0].init?.body)), { guideId: GUIDE, expectedTokenGeneration: 2, expectedSessionEpoch: 3 });
  assert.equal(calls[0].init?.credentials, "same-origin");
});

test("copy uses the complete in-memory canonical URL only on an explicit action and fails safely", async () => {
  const copied: string[] = [];
  assert.equal(await copyStaffPrivateUrl(URL, { writeText: async (value) => { copied.push(value); } }), true);
  assert.deepEqual(copied, [URL]);
  assert.equal(await copyStaffPrivateUrl("https://example.test/paint-guide/p#bad", { writeText: async () => { throw Error("must not run"); } }), false);
  assert.equal(await copyStaffPrivateUrl(URL, undefined), false);
  assert.equal(await copyStaffPrivateUrl(URL, { writeText: async () => { throw Error("clipboard denied"); } }), false);
});

test("client maps HTTP, malformed response, and network failures without exposing server details", async () => {
  for (const response of [new Response(null, { status: 401 }), new Response(null, { status: 403 }), new Response(null, { status: 404 }), new Response(null, { status: 409 }), new Response(null, { status: 503 })]) {
    await assert.rejects(() => requestStaffAccess("status", "token", { guideId: GUIDE }, async () => response), (error: unknown) => error instanceof StaffAccessClientError && error.status === response.status);
  }
  await assert.rejects(() => requestStaffAccess("issue", "token", { guideId: GUIDE }, async () => Response.json(status())), (error: unknown) => error instanceof StaffAccessClientError && error.status === 503);
  await assert.rejects(() => requestStaffAccess("status", "token", { guideId: GUIDE }, async () => { throw new Error("private network detail"); }), (error: unknown) => error instanceof StaffAccessClientError && error.status === "network");
  await assert.rejects(() => requestStaffAccess("status", null, { guideId: GUIDE }), (error: unknown) => error instanceof StaffAccessClientError && error.status === 401);
});
