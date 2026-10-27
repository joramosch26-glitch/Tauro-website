import assert from "node:assert/strict";
import test from "node:test";
import { buildPhotoPlacementViews, createStaffPhotoClient, currentStaffPhotoPreview, parseStaffPhotoListResponse, photoMutationSuccessMessage, staffPhotoPreviewIdentity, type StaffPhotoPlacement } from "./photo-client.js";
import type { GuideLocation, PaintRecord, PaintRecordLocation } from "../data/types.js";

const guideId = "10000000-0000-4000-8000-000000000001";
const slotId = "20000000-0000-4000-8000-000000000002";
const versionId = "30000000-0000-4000-8000-000000000003";
const attemptId = "40000000-0000-4000-8000-000000000004";
const sample: StaffPhotoPlacement = { id: "residence_cover::", placement: "residence_cover", locationId: null, recordId: null, photo: { slotId, versionId } };

test("synthetic mocked list response uses the injected parser and bearer token", async () => {
  let requested = "";
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: parseStaffPhotoListResponse, fetcher: async (input, init) => {
    requested = String(input);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic-token");
    assert.equal(init?.credentials, "same-origin");
    return Response.json({ photos: [{ slotId, versionId, placement: "residence_cover", locationId: null, recordId: null }] });
  } });
  assert.deepEqual(await client.list(guideId), [sample]);
  assert.equal(requested, `/api/paint-guide/staff/photos?guideId=${guideId}`);
});

test("photo list allowlist rejects unexpected metadata and invalid placement ids", () => {
  assert.deepEqual(parseStaffPhotoListResponse({ photos: [{ slotId, versionId, placement: "residence_cover", locationId: null, recordId: null }] }), [sample]);
  assert.equal(parseStaffPhotoListResponse({ photos: [{ slotId, versionId, placement: "residence_cover", locationId: null, recordId: null, fileName: "unexpected" }] }), null);
  assert.equal(parseStaffPhotoListResponse({ photos: [{ slotId, versionId, placement: "location", locationId: null, recordId: null }] }), null);
  assert.equal(parseStaffPhotoListResponse({ photos: [{ slotId, versionId, placement: "record_context", locationId: null, recordId: versionId }] }), null);
});

test("synthetic guide hierarchy creates distinct exact record-context placements per assigned location", () => {
  const floorId = "50000000-0000-4000-8000-000000000005";
  const firstRoomId = "60000000-0000-4000-8000-000000000006";
  const secondRoomId = "61000000-0000-4000-8000-000000000016";
  const recordId = "70000000-0000-4000-8000-000000000007";
  const firstRecordSlotId = "80000000-0000-4000-8000-000000000008";
  const firstRecordVersionId = "90000000-0000-4000-8000-000000000009";
  const secondRecordSlotId = "81000000-0000-4000-8000-000000000018";
  const secondRecordVersionId = "91000000-0000-4000-8000-000000000019";
  const locations: GuideLocation[] = [
    { id: floorId, guide_id: guideId, parent_id: null, location_type: "floor", name: "Main Floor", sort_order: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    { id: firstRoomId, guide_id: guideId, parent_id: floorId, location_type: "room", name: "Kitchen", sort_order: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" },
    { id: secondRoomId, guide_id: guideId, parent_id: floorId, location_type: "room", name: "Laundry", sort_order: 1, created_at: "2026-01-01T00:00:01Z", updated_at: "2026-01-01T00:00:01Z" },
  ];
  const records: PaintRecord[] = [{ id: recordId, guide_id: guideId, section: "primary", surface: "Walls", brand: null, product: null, color_name: "Synthetic Ivory", color_code: null, sheen: null, notes: null, sort_order: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" }];
  const assignments: PaintRecordLocation[] = [
    { guide_id: guideId, paint_record_id: recordId, location_id: firstRoomId },
    { guide_id: guideId, paint_record_id: recordId, location_id: secondRoomId },
  ];
  const photos = parseStaffPhotoListResponse({ photos: [
    { slotId, versionId, placement: "location", locationId: firstRoomId, recordId: null },
    { slotId: firstRecordSlotId, versionId: firstRecordVersionId, placement: "record_context", locationId: firstRoomId, recordId },
    { slotId: secondRecordSlotId, versionId: secondRecordVersionId, placement: "record_context", locationId: secondRoomId, recordId },
  ] });
  assert.ok(photos);
  const views = buildPhotoPlacementViews(locations, records, assignments, photos);
  const firstContext = views.find((item) => item.id === `record:${recordId}:${firstRoomId}`);
  const secondContext = views.find((item) => item.id === `record:${recordId}:${secondRoomId}`);
  assert.equal(firstContext?.photo?.versionId, firstRecordVersionId);
  assert.equal(secondContext?.photo?.versionId, secondRecordVersionId);
  assert.notEqual(firstContext?.photo?.versionId, secondContext?.photo?.versionId);
  assert.equal(views.some((item) => item.id === `record:${recordId}:guide`), false);
});

test("formula-label placement stays disabled by default and is enabled only for the candidate build", () => {
  const record: PaintRecord = { id: versionId, guide_id: guideId, section: "primary", surface: "Walls", brand: null, product: null, color_name: "Synthetic Ivory", color_code: null, sheen: null, notes: null, sort_order: 0, created_at: "2026-01-01T00:00:00Z", updated_at: "2026-01-01T00:00:00Z" };
  const disabled = buildPhotoPlacementViews([], [record], [], []);
  const enabled = buildPhotoPlacementViews([], [record], [], [], true);
  assert.equal(disabled.find((item) => item.kind === "record_formula_label")?.uploadSupported, false);
  assert.equal(enabled.find((item) => item.kind === "record_formula_label")?.uploadSupported, true);
});

test("candidate formula-label client sends original bytes above legacy cap without client-side image rewrite", async () => {
  const bytes = new Uint8Array(4 * 1024 * 1024 + 1).fill(7);
  const original = new File([bytes], "synthetic-chart.png", { type: "image/png" });
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: () => [], fetcher: async (_input, init) => {
    const body = init?.body as FormData;
    assert.equal(body.get("placement"), "record_formula_label");
    assert.equal(body.get("locationId"), null);
    assert.equal(body.get("recordId"), versionId);
    const image = body.get("image");
    assert.ok(image instanceof File);
    assert.equal(image.name, "synthetic-chart.png");
    assert.equal(image.size, original.size);
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), bytes);
    return Response.json({ versionId, state: "ready" }, { status: 201 });
  } });
  assert.deepEqual(await client.upload({ guideId, placement: "record_formula_label", recordId: versionId, attemptId, image: original }), { versionId, state: "ready" });
});

test("synthetic upload sends prepared File bytes and exact multipart fields", async () => {
  const bytes = new Uint8Array([1, 2, 3, 4]);
  const prepared = new File([bytes], "photo.webp", { type: "image/webp" });
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: () => [], fetcher: async (input, init) => {
    assert.equal(String(input), "/api/paint-guide/staff/photos");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic-token");
    const body = init?.body as FormData;
    assert.equal(body.get("guideId"), guideId);
    assert.equal(body.get("placement"), "location");
    assert.equal(body.get("locationId"), slotId);
    assert.equal(body.get("attemptId"), attemptId);
    const image = body.get("image");
    assert.ok(image instanceof File);
    assert.equal(image.name, "photo.webp");
    assert.deepEqual(new Uint8Array(await image.arrayBuffer()), bytes);
    return Response.json({ versionId, state: "ready" }, { status: 201 });
  } });
  assert.deepEqual(await client.upload({ guideId, placement: "location", locationId: slotId, attemptId, image: prepared }), { versionId, state: "ready" });
});

test("synthetic uploading replay conflict is reported without a body retry", async () => {
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: () => [], fetcher: async () => new Response(null, { status: 409 }) });
  await assert.rejects(client.upload({ guideId, placement: "residence_cover", attemptId, image: new File(["synthetic"], "photo.webp", { type: "image/webp" }) }), { code: "conflict", status: 409 });
});

test("record-context upload requires both the assigned location and paint record", async () => {
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: () => [], fetcher: async () => { throw new Error("must not send"); } });
  await assert.rejects(client.upload({ guideId, placement: "record_context", recordId: versionId, attemptId, image: new File(["synthetic"], "photo.webp", { type: "image/webp" }) }), { code: "invalid_response" });
});

test("synthetic delete and protected image requests authenticate without URL credentials", async () => {
  const urls: string[] = [];
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: () => [], fetcher: async (input, init) => {
    const url = String(input); urls.push(url);
    assert.equal(new URL(url, "https://example.test").searchParams.has("token"), false);
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer synthetic-token");
    return init?.method === "DELETE" ? new Response(null, { status: 204 }) : new Response(new Blob(["synthetic image"], { type: "image/webp" }), { status: 200 });
  } });
  await client.remove(slotId);
  const blob = await client.image(versionId, "thumb");
  assert.equal(await blob.text(), "synthetic image");
  assert.deepEqual(urls, [`/api/paint-guide/staff/photo-slots/${slotId}`, `/api/paint-guide/staff/photos/${versionId}?variant=thumb`]);
});

test("staff photo uploads allow generic MIME after preprocessing when bytes and signature validate", async () => {
  const prepared = new File([new Uint8Array([1, 2, 3])], "photo.webp", { type: "image/webp" });
  const client = createStaffPhotoClient({ getAccessToken: async () => "synthetic-token", parseList: () => [], fetcher: async (_input, init) => {
    const body = init?.body as FormData;
    assert.equal((body.get("image") as File).type, "image/webp");
    return Response.json({ versionId, state: "ready" }, { status: 201 });
  } });
  assert.deepEqual(await client.upload({ guideId, placement: "residence_cover", attemptId, image: prepared }), { versionId, state: "ready" });
});

test("preview state is hidden for every changed guide, client, placement, or version identity", () => {
  const priorIdentity = staffPhotoPreviewIdentity(guideId, "owner-a", "location:kitchen", versionId);
  const prior = { identity: priorIdentity, url: "blob:synthetic-old-preview" };
  assert.equal(currentStaffPhotoPreview(prior, priorIdentity), prior);
  for (const identity of [
    staffPhotoPreviewIdentity(guideId, "owner-b", "location:kitchen", versionId),
    staffPhotoPreviewIdentity(guideId, "owner-a", "location:laundry", versionId),
    staffPhotoPreviewIdentity(guideId, "owner-a", "location:kitchen", "31000000-0000-4000-8000-000000000013"),
  ]) assert.equal(currentStaffPhotoPreview(prior, identity), null);
});

test("mutation success text is withheld when the refreshed list fails", () => {
  assert.equal(photoMutationSuccessMessage("Kitchen", "saved", false), null);
  assert.equal(photoMutationSuccessMessage("Kitchen", "removed", false), null);
  assert.equal(photoMutationSuccessMessage("Kitchen", "saved", true), "Kitchen photo saved.");
  assert.equal(photoMutationSuccessMessage("Kitchen", "removed", true), "Kitchen photo removed.");
});
