import type { SupabaseClient } from "@supabase/supabase-js";
import { createHomeownerSupabaseAdminClient } from "../paint-guide-homeowner/supabase-admin.js";
import { loadHomeownerServerEnvironment, loadPaintGuideServerEnvironment } from "../paint-guide-homeowner/env.js";
import { hasAllowedHomeownerOrigin } from "../paint-guide-homeowner/origin.js";
import { readHomeownerSessionCookie } from "../paint-guide-homeowner/cookies.js";
import { deriveSessionHmac, parseHomeownerSessionBearer } from "../paint-guide-homeowner/sessions.js";
import { homeownerJsonResponse, homeownerNoContentResponse } from "../paint-guide-homeowner/responses.js";
import type { HomeownerServerEnvironment, PaintGuideServerEnvironment } from "../paint-guide-homeowner/types.js";
import { syntheticReleaseAllowsGuide } from "../paint-guide-homeowner/synthetic-release.js";
import { validateHomeownerGuideDocument } from "../paint-guide-homeowner/document.js";
import { requirePaintGuideStaff, paintGuideStaffFailureResponse, type PaintGuideStaffRole } from "../paint-guide-staff/auth.js";
import { normalizeFormulaLabel, normalizePhoto, FORMULA_LABEL_LIMITS, PHOTO_LIMITS, PhotoInputError, verifyNormalizedWebp } from "./images.js";

const QUARANTINE_BUCKET = "paint-guide-quarantine";
const PHOTO_BUCKET = "paint-guide-private";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PHOTO_CLEANUP_BATCH_SIZE = 10;
const PHOTO_CLEANUP_CONCURRENCY = 5;
const PHOTO_UPLOAD_BODY_TIMEOUT_MS = 20_000;
const homeownerPhotoSessionChecks = new Map<string, Promise<{ data: unknown; error: unknown }>>();

type PhotoEnv = PaintGuideServerEnvironment | HomeownerServerEnvironment;
type HandlerDeps = {
  loadStaffEnvironment?: () => PaintGuideServerEnvironment;
  loadHomeownerEnvironment?: () => HomeownerServerEnvironment;
  authorize?: typeof requirePaintGuideStaff;
  createClient?: (environment: PhotoEnv) => SupabaseClient;
  enabled?: () => boolean;
};

const enabledByDefault = () => process.env.TAURO_PG_PHOTOS_ENABLED === "true";
const unavailable = (status = 404) => homeownerJsonResponse({ available: false }, { status });
const staffRoles = (method: string): readonly PaintGuideStaffRole[] => method === "GET" || method === "HEAD" ? ["owner", "supervisor"] : ["owner"];
const PHOTO_REQUEST_BUDGET_MS = 80_000;
const formulaLabelOversizeResponse = () => homeownerJsonResponse({
  code: "formula_label_too_large",
  message: "This formula-label photo exceeds the safe full-resolution limit. Crop or recapture closer; the image will not be reduced automatically.",
}, { status: 413 });

function syntheticStaffAllowed(environment: PhotoEnv, staff: { userId: string; role: PaintGuideStaffRole }, guideId?: string) {
  if (environment.environment === "preview" && !environment.syntheticRelease) return false;
  const release = environment.syntheticRelease;
  return !release || (staff.role === "owner" && staff.userId === release.actorId
    && (guideId === undefined || syntheticReleaseAllowsGuide(environment, guideId)));
}

function syntheticGuideAllowed(environment: PhotoEnv, guideId: string) {
  if (environment.environment === "preview" && !environment.syntheticRelease) return false;
  return syntheticReleaseAllowsGuide(environment, guideId);
}

function createPhotoAdminClient(environment: PhotoEnv) {
  return createHomeownerSupabaseAdminClient(environment, async (input, init) => {
    try { return await fetch(input, { ...init, redirect: "error", signal: AbortSignal.timeout(10_000) }); }
    catch { return new Response(null, { status: 503 }); }
  });
}

function requireRequestBudget(startedAt: number) {
  if (Date.now() - startedAt > PHOTO_REQUEST_BUDGET_MS) throw new Error("photo_request_budget_exceeded");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}

async function readBoundedBody(request: Request, limit: number, timeoutMs: number): Promise<Buffer | null> {
  const advertised = request.headers.get("content-length");
  if (advertised !== null && (!/^\d+$/.test(advertised) || Number(advertised) > limit)) return null;
  if (!request.body) return null;
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  const deadline = Date.now() + timeoutMs;
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    while (true) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) return null;
      const item = await Promise.race([
        reader.read(),
        new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), remaining); }),
      ]);
      if (timer) clearTimeout(timer);
      timer = null;
      if (item === null) return null;
      if (item.done) break;
      length += item.value.byteLength;
      if (length > limit) return null;
      chunks.push(item.value);
    }
  } finally {
    if (timer) clearTimeout(timer);
    void reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  return Buffer.concat(chunks.map(chunk => Buffer.from(chunk)), length);
}

async function parseUpload(request: Request, startedAt: number) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!/^multipart\/form-data;\s*boundary=/.test(contentType)) return null;
  const remainingBudget = PHOTO_REQUEST_BUDGET_MS - (Date.now() - startedAt);
  // The bounded request ceiling covers formula-label uploads; per-role byte limits are enforced after multipart parsing.
  const bytes = await readBoundedBody(request, FORMULA_LABEL_LIMITS.requestBytes, Math.min(PHOTO_UPLOAD_BODY_TIMEOUT_MS, remainingBudget));
  if (!bytes) return null;
  try {
    const form = await new Request(request.url, { method: "POST", headers: { "content-type": contentType }, body: new Uint8Array(bytes) }).formData();
    const keys = [...form.keys()];
    if (keys.some(key => !["guideId", "placement", "locationId", "recordId", "attemptId", "image"].includes(key))) return null;
    for (const key of ["guideId", "placement", "attemptId", "image"]) if (form.getAll(key).length !== 1) return null;
    for (const key of ["locationId", "recordId"]) if (form.getAll(key).length > 1) return null;
    const guideId = form.get("guideId");
    const placement = form.get("placement");
    const attemptId = form.get("attemptId");
    const image = form.get("image");
    const locationId = form.get("locationId");
    const recordId = form.get("recordId");
    if (typeof guideId !== "string" || !UUID.test(guideId)
      || typeof placement !== "string" || !["residence_cover", "location", "record_context", "record_formula_label"].includes(placement)
      || typeof attemptId !== "string" || !UUID.test(attemptId)
      || !(image instanceof File) || image.size < 1
      || image.size > (placement === "record_formula_label" ? FORMULA_LABEL_LIMITS.uploadBytes : PHOTO_LIMITS.uploadBytes)
      || (typeof locationId === "string" && !UUID.test(locationId))
      || (typeof recordId === "string" && !UUID.test(recordId))
      || (placement === "record_formula_label" && (locationId !== null || typeof recordId !== "string"))
      || (placement === "record_context" && (typeof locationId !== "string" || typeof recordId !== "string"))
      || (placement === "residence_cover" && (locationId !== null || recordId !== null))
      || (placement === "location" && (typeof locationId !== "string" || recordId !== null))) return null;
    return {
      guideId, placement,
      locationId: typeof locationId === "string" ? locationId : null,
      recordId: typeof recordId === "string" ? recordId : null,
      attemptId,
      image: Buffer.from(await image.arrayBuffer()),
    };
  } catch { return null; }
}

type Reserved = { attempt_id: string; version_id: string; slot_id: string; generation: number; state: string; quarantine_key: string | null; full_key: string | null; thumbnail_key: string | null; newly_reserved: boolean; is_current?: boolean };
function isReserved(value: unknown): value is Reserved {
  return isPlainObject(value) && typeof value.attempt_id === "string" && typeof value.version_id === "string"
    && typeof value.slot_id === "string" && Number.isSafeInteger(value.generation) && typeof value.state === "string"
    && typeof value.newly_reserved === "boolean";
}

async function failCandidate(client: SupabaseClient, staffId: string, reservation: Reserved, code: string) {
  await client.rpc("paint_guide_photo_fail", {
    p_actor: staffId, p_attempt: reservation.attempt_id, p_generation: reservation.generation, p_failure_code: code,
  });
}

async function storePhoto(client: SupabaseClient, buffer: Buffer, bucket: string, key: string, contentType: string) {
  return client.storage.from(bucket).upload(key, buffer, { contentType, upsert: false, cacheControl: "0" });
}

export function createPaintGuidePhotoUploadHandler(dependencies: HandlerDeps = {}) {
  const loadEnvironment = dependencies.loadStaffEnvironment ?? loadPaintGuideServerEnvironment;
  const authorize = dependencies.authorize ?? requirePaintGuideStaff;
  const createClient = dependencies.createClient ?? createPhotoAdminClient;
  const isEnabled = dependencies.enabled ?? enabledByDefault;
  return async function handle(request: Request) {
    if (request.method !== "POST") return unavailable(405);
    if (!isEnabled()) return unavailable();
    let environment: PaintGuideServerEnvironment;
    try { environment = loadEnvironment(); } catch { return unavailable(); }
    if (!hasAllowedHomeownerOrigin(request, environment)) return unavailable(403);
    const authorized = await authorize(request, ["owner"]);
    if (authorized.kind !== "authorized") return paintGuideStaffFailureResponse(authorized.reason);
    if (!syntheticStaffAllowed(environment, authorized.staff)) return unavailable(403);
    const startedAt = Date.now();
    const input = await parseUpload(request, startedAt);
    if (!input) return unavailable(400);
    if (!syntheticStaffAllowed(environment, authorized.staff, input.guideId)) return unavailable(403);
    const client = createClient(environment);
    let reservation: Reserved | null = null;
    try {
      requireRequestBudget(startedAt);
      const { data: reserved, error: reserveError } = await client.rpc("paint_guide_photo_reserve", {
        p_actor: authorized.staff.userId, p_guide: input.guideId, p_placement: input.placement,
        p_location: input.locationId, p_record: input.recordId, p_attempt: input.attemptId,
      });
      if (reserveError || !isReserved(reserved)) return unavailable(reserveError?.code === "42501" ? 403 : 409);
      if (!reserved.newly_reserved) {
        if (reserved.state === "ready") {
          return homeownerJsonResponse({ versionId: reserved.version_id, state: "ready" }, { status: 200 });
        }
        return unavailable(409);
      }
      reservation = reserved;
      if (reservation.state === "ready") {
        return homeownerJsonResponse({ versionId: reservation.version_id, state: "ready" }, { status: 200 });
      }
      if (reservation.state !== "uploading" || !reservation.quarantine_key || !reservation.full_key || !reservation.thumbnail_key) return unavailable(409);
      let normalized;
      try { normalized = input.placement === "record_formula_label"
        ? await normalizeFormulaLabel(input.image)
        : await normalizePhoto(input.image); }
      catch (error) {
        const code = error instanceof PhotoInputError ? error.code : "invalid_image";
        await failCandidate(client, authorized.staff.userId, reservation, code);
        if (input.placement === "record_formula_label" && code === "formula_label_too_large") return formulaLabelOversizeResponse();
        return unavailable(code === "too_large" ? 413 : code === "unsupported" ? 415 : 400);
      }
      requireRequestBudget(startedAt);
      const originalUpload = await storePhoto(client, input.image, QUARANTINE_BUCKET, reservation.quarantine_key, normalized.originalMimeType);
      if (originalUpload.error) throw new Error("quarantine_upload");
      requireRequestBudget(startedAt);
      const fullUpload = await storePhoto(client, normalized.full, PHOTO_BUCKET, reservation.full_key, "image/webp");
      if (fullUpload.error) throw new Error("full_upload");
      requireRequestBudget(startedAt);
      const thumbUpload = await storePhoto(client, normalized.thumbnail, PHOTO_BUCKET, reservation.thumbnail_key, "image/webp");
      if (thumbUpload.error) throw new Error("thumbnail_upload");
      requireRequestBudget(startedAt);
      const normalizedFullBytes = input.placement === "record_formula_label" ? FORMULA_LABEL_LIMITS.fullBytes : PHOTO_LIMITS.fullBytes;
      const [fullRead, thumbRead] = await Promise.all([
        client.storage.from(PHOTO_BUCKET).download(reservation.full_key),
        client.storage.from(PHOTO_BUCKET).download(reservation.thumbnail_key),
      ]);
      if (fullRead.error || thumbRead.error || !fullRead.data || !thumbRead.data) throw new Error("output_verify");
      const fullBuffer = Buffer.from(await fullRead.data.arrayBuffer());
      const thumbBuffer = Buffer.from(await thumbRead.data.arrayBuffer());
      await Promise.all([
        verifyNormalizedWebp(fullBuffer, normalizedFullBytes),
        verifyNormalizedWebp(thumbBuffer, PHOTO_LIMITS.thumbBytes),
      ]);
      requireRequestBudget(startedAt);
      const originalDelete = await client.storage.from(QUARANTINE_BUCKET).remove([reservation.quarantine_key]);
      if (originalDelete.error || !originalDelete.data?.length) throw new Error("quarantine_delete");
      requireRequestBudget(startedAt);
      const { data: promoted, error: promoteError } = await client.rpc("paint_guide_photo_promote", {
        p_actor: authorized.staff.userId, p_attempt: reservation.attempt_id, p_generation: reservation.generation,
        p_width: normalized.width, p_height: normalized.height, p_full_bytes: normalized.full.length,
        p_thumb_bytes: normalized.thumbnail.length, p_outputs_verified: true, p_original_deleted: true,
      });
      if (promoteError || promoted !== reservation.version_id) throw new Error("promotion");
      return homeownerJsonResponse({ versionId: reservation.version_id, state: "ready" }, { status: 201 });
    } catch {
      if (reservation) await failCandidate(client, authorized.staff.userId, reservation, "processing_failed").catch(() => undefined);
      return unavailable(503);
    }
  };
}

type CurrentPhotoSlot = {
  id: string;
  guide_id: string;
  placement_kind: "residence_cover" | "location" | "record_context" | "record_formula_label";
  location_id: string | null;
  paint_record_id: string | null;
  current_version_id: string;
};

function currentPhotoSlots(value: unknown, guideId: string): CurrentPhotoSlot[] | null {
  if (!Array.isArray(value)) return null;
  const slots: CurrentPhotoSlot[] = [];
  for (const item of value) {
    if (!isPlainObject(item) || typeof item.id !== "string" || !UUID.test(item.id)
      || item.guide_id !== guideId
      || (item.placement_kind !== "residence_cover" && item.placement_kind !== "location" && item.placement_kind !== "record_context" && item.placement_kind !== "record_formula_label")
      || !(item.location_id === null || (typeof item.location_id === "string" && UUID.test(item.location_id)))
      || !(item.paint_record_id === null || (typeof item.paint_record_id === "string" && UUID.test(item.paint_record_id)))
      || (item.placement_kind === "residence_cover" && (item.location_id !== null || item.paint_record_id !== null))
      || (item.placement_kind === "location" && (item.location_id === null || item.paint_record_id !== null))
      || (item.placement_kind === "record_context" && (item.location_id === null || item.paint_record_id === null))
      || typeof item.current_version_id !== "string" || !UUID.test(item.current_version_id)
      || (item.placement_kind === "record_formula_label" && (item.location_id !== null || item.paint_record_id === null))) return null;
    slots.push({
      id: item.id as string,
      guide_id: item.guide_id as string,
      placement_kind: item.placement_kind as CurrentPhotoSlot["placement_kind"],
      location_id: item.location_id as string | null,
      paint_record_id: item.paint_record_id as string | null,
      current_version_id: item.current_version_id as string,
    });
  }
  return slots;
}

function readyCurrentVersions(value: unknown): Set<string> | null {
  if (!Array.isArray(value)) return null;
  const versions = new Set<string>();
  for (const item of value) {
    if (!isPlainObject(item) || typeof item.id !== "string" || !UUID.test(item.id)
      || typeof item.slot_id !== "string" || !UUID.test(item.slot_id) || item.state !== "ready") return null;
    versions.add(`${item.slot_id}:${item.id}`);
  }
  return versions;
}

export function createStaffPhotoListHandler(dependencies: HandlerDeps = {}) {
  const loadEnvironment = dependencies.loadStaffEnvironment ?? loadPaintGuideServerEnvironment;
  const authorize = dependencies.authorize ?? requirePaintGuideStaff;
  const createClient = dependencies.createClient ?? createPhotoAdminClient;
  const isEnabled = dependencies.enabled ?? enabledByDefault;
  return async function handle(request: Request) {
    if (request.method !== "GET") return unavailable(405);
    if (!isEnabled()) return unavailable();
    let environment: PaintGuideServerEnvironment;
    try { environment = loadEnvironment(); } catch { return unavailable(); }
    const authorized = await authorize(request, ["owner", "supervisor"]);
    if (authorized.kind !== "authorized") return paintGuideStaffFailureResponse(authorized.reason);
    const params = new URL(request.url).searchParams;
    const guideIds = params.getAll("guideId");
    if (guideIds.length !== 1 || !UUID.test(guideIds[0])) return unavailable(400);
    if (!syntheticStaffAllowed(environment, authorized.staff, guideIds[0])) return unavailable(403);

    try {
      const client = createClient(environment);
      const { data: slotData, error: slotError } = await client.from("paint_guide_photo_slots")
        .select("id,guide_id,placement_kind,location_id,paint_record_id,current_version_id")
        .eq("guide_id", guideIds[0]).not("current_version_id", "is", null);
      if (slotError) return unavailable(503);
      const slots = currentPhotoSlots(slotData, guideIds[0]);
      if (!slots) return unavailable(503);
      if (slots.length === 0) return homeownerJsonResponse({ photos: [] });

      const versionIds = [...new Set(slots.map(slot => slot.current_version_id))];
      const { data: versionData, error: versionError } = await client.from("paint_guide_photo_versions")
        .select("id,slot_id,state").in("id", versionIds).eq("state", "ready");
      if (versionError) return unavailable(503);
      const readyVersions = readyCurrentVersions(versionData);
      if (!readyVersions) return unavailable(503);

      return homeownerJsonResponse({
        photos: slots.filter(slot => readyVersions.has(`${slot.id}:${slot.current_version_id}`)).map(slot => ({
          slotId: slot.id,
          versionId: slot.current_version_id,
          placement: slot.placement_kind,
          locationId: slot.location_id,
          recordId: slot.paint_record_id,
        })),
      });
    } catch { return unavailable(503); }
  };
}

export function createStaffPhotosHandler(dependencies: HandlerDeps = {}) {
  const list = createStaffPhotoListHandler(dependencies);
  const upload = createPaintGuidePhotoUploadHandler(dependencies);
  return (request: Request) => request.method === "GET" ? list(request) : upload(request);
}

type PhotoMetadata = { guide_id: string; object_key: string; content_length: number; width: number; height: number };
function metadataRow(value: unknown): PhotoMetadata | null {
  const row = Array.isArray(value) ? value[0] : value;
  if (!isPlainObject(row) || typeof row.guide_id !== "string" || typeof row.object_key !== "string"
    || !Number.isSafeInteger(row.content_length) || !Number.isSafeInteger(row.width) || !Number.isSafeInteger(row.height)) return null;
  return row as PhotoMetadata;
}

function parseRange(value: string | null, size: number): [number, number] | null | "invalid" {
  if (value === null) return null;
  if (!Number.isSafeInteger(size) || size < 1 || !/^bytes=\d*-\d*$/.test(value)) return "invalid";
  const [startRaw, endRaw] = value.slice(6).split("-");
  if (!startRaw && !endRaw) return "invalid";
  let start: number; let end: number;
  if (!startRaw) {
    const suffix = Number(endRaw);
    if (!Number.isSafeInteger(suffix) || suffix < 1) return "invalid";
    start = Math.max(0, size - suffix); end = size - 1;
  } else {
    start = Number(startRaw); end = endRaw ? Number(endRaw) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || start >= size) return "invalid";
  return [start, Math.min(end, size - 1)];
}

function imageResponse(request: Request, metadata: PhotoMetadata, bytes?: Buffer) {
  const range = parseRange(request.headers.get("range"), metadata.content_length);
  const headers = new Headers({
    "Content-Type": "image/webp", "X-Content-Type-Options": "nosniff", "Cache-Control": "no-store, private",
    "CDN-Cache-Control": "no-store", "Vercel-CDN-Cache-Control": "no-store", "Referrer-Policy": "no-referrer",
    "Accept-Ranges": "bytes", "Vary": "Cookie",
  });
  if (range === "invalid") {
    headers.set("Content-Range", `bytes */${metadata.content_length}`);
    return new Response(null, { status: 416, headers });
  }
  let status = 200;
  let body = bytes ?? null;
  if (range) {
    const [start, end] = range;
    if (bytes) body = bytes.subarray(start, end + 1);
    headers.set("Content-Range", `bytes ${start}-${end}/${metadata.content_length}`);
    status = 206;
  }
  const length = range ? range[1] - range[0] + 1 : metadata.content_length;
  headers.set("Content-Length", String(length));
  if (request.method === "HEAD") body = null;
  return new Response(body ? new Uint8Array(body) : null, { status, headers });
}

async function fetchImage(client: SupabaseClient, metadata: PhotoMetadata, variant: string) {
  const bucket = variant === "full" || variant === "thumb" ? PHOTO_BUCKET : null;
  const maximumBytes = variant === "full" ? FORMULA_LABEL_LIMITS.fullBytes : PHOTO_LIMITS.thumbBytes;
  if (!bucket || metadata.content_length > maximumBytes) return null;
  const response = await client.storage.from(bucket).download(metadata.object_key);
  if (response.error || !response.data) return null;
  const bytes = Buffer.from(await response.data.arrayBuffer());
  if (bytes.length !== metadata.content_length || bytes.length > maximumBytes) return null;
  return bytes;
}

type HomeownerImageRead = { kind: "ready"; bytes: Buffer } | { kind: "missing" } | { kind: "temporary" };
async function fetchHomeownerImage(client: SupabaseClient, metadata: PhotoMetadata, variant: string): Promise<HomeownerImageRead> {
  const bucket = variant === "full" || variant === "thumb" ? PHOTO_BUCKET : null;
  const maximumBytes = variant === "full" ? FORMULA_LABEL_LIMITS.fullBytes : PHOTO_LIMITS.thumbBytes;
  if (!bucket || metadata.content_length > maximumBytes) return { kind: "missing" };
  try {
    const result = await client.storage.from(bucket).download(metadata.object_key);
    if (result.error) {
      const status = "statusCode" in result.error ? String(result.error.statusCode) : "";
      return status === "404" ? { kind: "missing" } : { kind: "temporary" };
    }
    if (!result.data) return { kind: "missing" };
    const bytes = Buffer.from(await result.data.arrayBuffer());
    if (bytes.length !== metadata.content_length || bytes.length > maximumBytes) return { kind: "missing" };
    return { kind: "ready", bytes };
  } catch { return { kind: "temporary" }; }
}

function homeownerPhotoUnavailableSession() {
  // Do not clear the shared session cookie from an image response. A late 401
  // for an old request could otherwise erase a newer session cookie set by an
  // exchange that completed while this photo request was in flight.
  return homeownerJsonResponse({ available: false }, { status: 401 });
}

async function checkHomeownerPhotoSession(
  environment: HomeownerServerEnvironment,
  client: SupabaseClient,
  sessionKeyVersion: number,
  sessionHmac: Buffer,
) {
  const checkKey = `${environment.environment}:${environment.expectedProjectRef}:${sessionKeyVersion}:${sessionHmac.toString("hex")}`;
  let check = homeownerPhotoSessionChecks.get(checkKey);
  if (!check) {
    check = Promise.resolve(client.rpc("paint_guide_homeowner_document_read", {
      p_session_key_version: sessionKeyVersion,
      p_session_hmac: `\\x${sessionHmac.toString("hex")}`,
    })).then(({ data, error }) => ({ data, error }));
    homeownerPhotoSessionChecks.set(checkKey, check);
  }
  try { return await check; }
  finally { if (homeownerPhotoSessionChecks.get(checkKey) === check) homeownerPhotoSessionChecks.delete(checkKey); }
}

function versionIdFromRequest(request: Request) {
  const match = /\/photos\/([0-9a-f-]{36})\/?$/i.exec(new URL(request.url).pathname);
  return match && UUID.test(match[1]) ? match[1] : null;
}

export function createStaffPhotoReadHandler(dependencies: HandlerDeps = {}) {
  const loadEnvironment = dependencies.loadStaffEnvironment ?? loadPaintGuideServerEnvironment;
  const authorize = dependencies.authorize ?? requirePaintGuideStaff;
  const createClient = dependencies.createClient ?? createPhotoAdminClient;
  const isEnabled = dependencies.enabled ?? enabledByDefault;
  return async function handle(request: Request) {
    if (request.method !== "GET" && request.method !== "HEAD") return unavailable(405);
    if (!isEnabled()) return unavailable();
    let environment: PaintGuideServerEnvironment;
    try { environment = loadEnvironment(); } catch { return unavailable(); }
    const authorized = await authorize(request, staffRoles(request.method));
    if (authorized.kind !== "authorized") return paintGuideStaffFailureResponse(authorized.reason);
    if (!syntheticStaffAllowed(environment, authorized.staff)) return unavailable(403);
    const version = versionIdFromRequest(request);
    const variant = new URL(request.url).searchParams.get("variant") ?? "full";
    if (!version || !["full", "thumb"].includes(variant)) return unavailable(404);
    const client = createClient(environment);
    const { data, error } = await client.rpc("paint_guide_staff_photo_read", { p_actor: authorized.staff.userId, p_version: version, p_variant: variant });
    const metadata = error ? null : metadataRow(data);
    if (!metadata || !syntheticGuideAllowed(environment, metadata.guide_id)) return unavailable(404);
    if (request.method === "HEAD") return imageResponse(request, metadata);
    const bytes = await fetchImage(client, metadata, variant);
    if (!bytes) return unavailable(404);
    return imageResponse(request, metadata, bytes);
  };
}

export function createHomeownerPhotoReadHandler(dependencies: HandlerDeps = {}) {
  const loadEnvironment = dependencies.loadHomeownerEnvironment ?? loadHomeownerServerEnvironment;
  const createClient = dependencies.createClient ?? createPhotoAdminClient;
  const isEnabled = dependencies.enabled ?? enabledByDefault;
  return async function handle(request: Request) {
    if (request.method !== "GET" && request.method !== "HEAD") return unavailable(405);
    if (!isEnabled()) return unavailable();
    let environment: HomeownerServerEnvironment;
    try { environment = loadEnvironment(); } catch { return unavailable(); }
    let version: string | null = null;
    let variant = "full";
    try {
      const raw = readHomeownerSessionCookie(request);
      if (!raw) return homeownerPhotoUnavailableSession();
      let bearer;
      try { bearer = parseHomeownerSessionBearer(raw); }
      catch { return homeownerPhotoUnavailableSession(); }
      version = versionIdFromRequest(request);
      variant = new URL(request.url).searchParams.get("variant") ?? "full";
      if (!version || !["full", "thumb"].includes(variant)) return unavailable();
      let hmac: Buffer;
      try { hmac = deriveSessionHmac(bearer, environment.expectedProjectRef, environment.sessionHmacKeys); }
      catch { return unavailable(503); }
      const client = createClient(environment);
      const { data, error } = await client.rpc("paint_guide_homeowner_photo_read", {
        p_session_key_version: bearer.sessionKeyVersion, p_session_hmac: `\\x${hmac.toString("hex")}`,
        p_version: version, p_variant: variant,
      });
      if (error) return unavailable(503);
      const metadata = metadataRow(data);
      if (!metadata) {
        const emptyPhotoResult = data === null || (Array.isArray(data) && data.length === 0);
        if (!emptyPhotoResult) return unavailable(503);
        // The photo RPC intentionally returns no row for both an invalid private
        // session and a stale photo ID. Resolve that ambiguity only on this error
        // path; never return document contents or extend the session.
        const sessionCheck = await checkHomeownerPhotoSession(environment, client, bearer.sessionKeyVersion, hmac);
        if (sessionCheck.error) return unavailable(503);
        if (sessionCheck.data === null) return homeownerPhotoUnavailableSession();
        if (!validateHomeownerGuideDocument(sessionCheck.data)) return unavailable(503);
        return unavailable(404);
      }
      if (!syntheticGuideAllowed(environment, metadata.guide_id)) return unavailable(404);
      if (request.method === "HEAD") return imageResponse(request, metadata);
      const image = await fetchHomeownerImage(client, metadata, variant);
      if (image.kind === "temporary") return unavailable(503);
      if (image.kind === "missing") return unavailable(404);
      return imageResponse(request, metadata, image.bytes);
    } catch { return unavailable(503); }
  };
}

export function createPhotoSlotDeleteHandler(dependencies: HandlerDeps = {}) {
  const loadEnvironment = dependencies.loadStaffEnvironment ?? loadPaintGuideServerEnvironment;
  const authorize = dependencies.authorize ?? requirePaintGuideStaff;
  const createClient = dependencies.createClient ?? createPhotoAdminClient;
  const isEnabled = dependencies.enabled ?? enabledByDefault;
  return async function handle(request: Request) {
    if (request.method !== "DELETE") return unavailable(405);
    if (!isEnabled()) return unavailable();
    let environment: PaintGuideServerEnvironment;
    try { environment = loadEnvironment(); } catch { return unavailable(); }
    if (!hasAllowedHomeownerOrigin(request, environment)) return unavailable(403);
    const authorized = await authorize(request, ["owner"]);
    if (authorized.kind !== "authorized") return paintGuideStaffFailureResponse(authorized.reason);
    if (!syntheticStaffAllowed(environment, authorized.staff)) return unavailable(403);
    const slot = /\/photo-slots\/([0-9a-f-]{36})\/?$/i.exec(new URL(request.url).pathname)?.[1];
    if (!slot || !UUID.test(slot)) return unavailable(404);
    const client = createClient(environment);
    if (environment.syntheticRelease) {
      const { data: row, error: lookupError } = await client.from("paint_guide_photo_slots")
        .select("guide_id").eq("id", slot).maybeSingle();
      if (lookupError || !isPlainObject(row) || !syntheticGuideAllowed(environment, String(row.guide_id))) return unavailable(404);
    }
    const { error } = await client.rpc("paint_guide_photo_delete", { p_actor: authorized.staff.userId, p_slot: slot });
    return error ? unavailable(503) : homeownerNoContentResponse();
  };
}

export function createPhotoCleanupHandler(dependencies: HandlerDeps = {}) {
  return async function handle(request: Request) {
    if (request.method !== "POST") return unavailable(405);
    const secret = process.env.TAURO_PG_PHOTO_CLEANUP_SECRET;
    if (!secret) return unavailable();
    if (request.headers.get("authorization") !== `Bearer ${secret}`) return unavailable(401);
    let environment: PaintGuideServerEnvironment;
    try { environment = (dependencies.loadStaffEnvironment ?? loadPaintGuideServerEnvironment)(); } catch { return unavailable(); }
    // The cleanup worker sweeps a project-wide outbox. Never run it from a
    // synthetic Preview, where it could claim or remove another guide's data.
    if (environment.environment === "preview") return unavailable();
    const client = (dependencies.createClient ?? createPhotoAdminClient)(environment);
    const { data: count, error } = await client.rpc("paint_guide_photo_cleanup_sweep");
    if (error || !Number.isSafeInteger(count)) return unavailable(503);
    // Drain at most ten objects per invocation. At most five cleanup jobs run
    // concurrently; subsequent invocations continue the outbox. This bounds
    // request work without promising a fixed time-to-purge.
    const { data: jobs, error: claimError } = await client.rpc("paint_guide_photo_cleanup_claim", { p_batch: PHOTO_CLEANUP_BATCH_SIZE });
    if (claimError || !Array.isArray(jobs)) return unavailable(503);
    for (let i = 0; i < jobs.length; i += PHOTO_CLEANUP_CONCURRENCY) {
      await Promise.all(jobs.slice(i, i + PHOTO_CLEANUP_CONCURRENCY).map(async (job) => {
        if (!isPlainObject(job) || typeof job.id !== "number" || typeof job.bucket_id !== "string" || typeof job.object_key !== "string" || typeof job.claim_generation !== "number") return;
        const deletion = await client.storage.from(job.bucket_id).remove([job.object_key]);
        if (deletion.error) {
          await client.rpc("paint_guide_photo_cleanup_fail", { p_id: job.id, p_claim_generation: job.claim_generation, p_error_code: "storage_delete_failed" });
        } else {
          await client.rpc("paint_guide_photo_cleanup_complete", { p_id: job.id, p_claim_generation: job.claim_generation, p_delete_succeeded: true });
        }
      }));
    }
    return homeownerJsonResponse({ swept: count, claimed: jobs.length });
  };
}

