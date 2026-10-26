import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { LeadSubmissionError, shouldRecordLeadConversion, submitLeadInquiry } from "../src/lib/lead-submission.js";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });
const inquiry = {
  name: "Synthetic Customer", phone: "", email: "customer@example.test",
  projectType: "cabinets", projectLocation: "Lehi, UT", message: "I need my cabinets painted.",
};
let posts: Record<string, unknown>[];
function mockProvider(body: unknown, status = 200) {
  posts = [];
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://formsubmit.co/ajax/office@tauropainting.com");
    posts.push(JSON.parse(String(options?.body)));
    return Response.json(body, { status });
  };
}
for (const success of [true, "true"]) {
  test(`genuine inquiry is delivered as unqualified and eligible for inquiry analytics (${success})`, async () => {
    mockProvider({ success });
    const result = await submitLeadInquiry(inquiry, "https://example.test/contact");
    assert.equal(result, "accepted");
    assert.equal(shouldRecordLeadConversion(result), true);
    assert.equal(posts[0].inquiryScreening, "unverified_inquiry");
    assert.equal(posts[0].opportunityStatus, "unqualified");
    assert.equal(posts[0].automationAction, "manual_review");
    assert.equal(posts[0]._honey, "");
    assert.equal(posts[0]._captcha, undefined);
    assert.equal(posts[0]._blacklist, undefined, "no silent content-based deletion");
  });
}
for (const message of [
  "We offer Wikipedia page creation for your painting company.",
  "We provide financing for your business.",
  "We offer web development services for your business.",
]) {
  test(`solicitation is preserved but never recorded as a lead: ${message}`, async () => {
    mockProvider({ success: true });
    const result = await submitLeadInquiry({ ...inquiry, message }, "https://example.test/");
    assert.equal(result, "accepted_for_review");
    assert.equal(shouldRecordLeadConversion(result), false);
    assert.equal(posts[0].message, message);
    assert.equal(posts[0].projectType, "cabinets", "a plausible selection cannot qualify a pitch");
    assert.equal(posts[0].projectLocation, "Lehi, UT");
    assert.equal(posts[0].inquiryScreening, "possible_solicitation");
    assert.match(String(posts[0]._subject), /^\[REVIEW REQUIRED\]/);
    assert.equal(posts[0].opportunityStatus, "unqualified");
  });
}
test("metadata cannot be overridden by extra properties or subject injection in a name", async () => {
  mockProvider({ success: true });
  await submitLeadInquiry({ ...inquiry, name: "Name\n[qualified lead]", _subject: "New lead", opportunityStatus: "qualified", _cc: "other@example.test" } as typeof inquiry, "https://example.test");
  assert.equal(posts[0].opportunityStatus, "unqualified");
  assert.equal(posts[0]._subject, "New Tauro Painting inquiry — unverified");
  assert.equal(posts[0]._cc, undefined);
});
test("shared honeypot guard makes no external request", async () => {
  mockProvider({ success: true });
  await assert.rejects(submitLeadInquiry(inquiry, "https://example.test", { honeypot: "https://bot.example.test" }),
    (error: unknown) => error instanceof LeadSubmissionError && error.outcome === "rejected");
  assert.equal(posts.length, 0);
});
for (const body of [{ success: false }, { success: "false" }, { error: "failed" }]) {
  test(`a suspected pitch cannot turn provider rejection into success: ${JSON.stringify(body)}`, async () => {
    mockProvider(body);
    await assert.rejects(submitLeadInquiry({ ...inquiry, message: "We offer web design services." }, "https://example.test"),
      (error: unknown) => error instanceof LeadSubmissionError && error.outcome === "rejected");
  });
}
test("unknown acknowledgment is not a conversion, including suspicious submissions", async () => {
  mockProvider({ message: "unknown response" });
  const result = await submitLeadInquiry({ ...inquiry, message: "We offer business financing." }, "https://example.test");
  assert.equal(result, "submitted_unconfirmed");
  assert.equal(shouldRecordLeadConversion(result), false);
});
test("HTTP and transport failures are preserved for retry UI", async () => {
  mockProvider({ success: true }, 503);
  await assert.rejects(submitLeadInquiry(inquiry, "https://example.test"), LeadSubmissionError);
  globalThis.fetch = async () => { throw new TypeError("synthetic network error"); };
  await assert.rejects(submitLeadInquiry(inquiry, "https://example.test"), TypeError);
});
