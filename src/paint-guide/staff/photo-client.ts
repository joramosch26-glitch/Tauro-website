import type { GuideLocation, PaintRecord, PaintRecordLocation } from "../data/types.js";

export type PhotoPlacementKind = "residence_cover" | "location" | "record_context" | "record_formula_label";

export type StaffPhoto = {
  slotId: string;
  versionId: string;
};

export type StaffPhotoPlacement = {
  id: string;
  placement: PhotoPlacementKind;
  locationId: string | null;
  recordId: string | null;
  photo: StaffPhoto | null;
};

export type PhotoUploadResult = { versionId: string; state: "ready" };
export type PhotoRequestErrorCode = "auth" | "not_found" | "forbidden" | "conflict" | "network" | "invalid_response";

export class StaffPhotoRequestError extends Error {
  constructor(readonly code: PhotoRequestErrorCode, readonly status?: number) {
    super(`Photo request failed (${code}).`);
    this.name = "StaffPhotoRequestError";
  }
}
export type PhotoListParser = (value: unknown) => StaffPhotoPlacement[] | null;
type Fetcher = typeof fetch;
type PhotoClientOptions = {
  getAccessToken: () => Promise<string>;
  parseList: PhotoListParser;
  fetcher?: Fetcher;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const API = "/api/paint-guide/staff/photos";
const PHOTO_PLACEMENTS = new Set<PhotoPlacementKind>(["residence_cover", "location", "record_context", "record_formula_label"]);

export type PhotoPlacementView = { id: string; kind: PhotoPlacementKind; group: string; title: string; context: string; locationId: string | null; recordId: string | null; photo: StaffPhoto | null; uploadSupported: boolean };
export type StaffPhotoPreview = { identity: string; url: string; mimeType: string; byteSize: number };

export function staffPhotoPreviewIdentity(guideId: string, userId: string | null, placementId: string | null, versionId: string | null) {
  return JSON.stringify([guideId, userId, placementId, versionId]);
}

export function currentStaffPhotoPreview<T extends { identity: string }>(preview: T | null, identity: string): T | null {
  return preview?.identity === identity ? preview : null;
}

export function photoMutationSuccessMessage(title: string, action: "saved" | "removed", refreshSucceeded: boolean) {
  return refreshSucceeded ? `${title} photo ${action}.` : null;
}

export function buildPhotoPlacementViews(locations: GuideLocation[], records: PaintRecord[], assignments: PaintRecordLocation[], photos: StaffPhotoPlacement[], formulaLabelUploadEnabled = false): PhotoPlacementView[] {
  const byKey = new Map(photos.map((photo) => [`${photo.placement}:${photo.locationId ?? ""}:${photo.recordId ?? ""}`, photo]));
  const rows: PhotoPlacementView[] = [];
  const add = (id: string, kind: PhotoPlacementKind, group: string, title: string, context: string, locationId: string | null, recordId: string | null) => {
    const photo = byKey.get(`${kind}:${locationId ?? ""}:${recordId ?? ""}`)?.photo ?? null;
    rows.push({ id, kind, group, title, context, locationId, recordId, photo, uploadSupported: kind !== "record_formula_label" || formulaLabelUploadEnabled });
  };
  add("residence-cover", "residence_cover", "Residence", "Residence cover", "Guide home · cover image", null, null);
  const byParent = new Map<string | null, GuideLocation[]>();
  for (const item of locations) byParent.set(item.parent_id, [...(byParent.get(item.parent_id) ?? []), item]);
  const visit = (parentId: string | null) => {
    for (const location of byParent.get(parentId) ?? []) {
      const parent = locations.find((item) => item.id === location.parent_id);
      add(`location:${location.id}`, "location", parent?.name ?? "Residence", location.name, `${location.location_type} · ${parent ? `${parent.name} › ` : ""}${location.name}`, location.id, null);
      visit(location.id);
    }
  };
  visit(null);
  for (const record of records) {
    add(`formula-label:${record.id}`, "record_formula_label", "Paint formula labels", `Formula label — ${record.color_name}`, "Real paint-can sticker photo · kept separate from room photos", null, record.id);
    const assigned = assignments.filter((item) => item.paint_record_id === record.id);
    for (const { location_id: locationId } of assigned) {
      const location = locations.find((item) => item.id === locationId);
      if (!location) continue;
      add(`record:${record.id}:${locationId}`, "record_context", location.name, `${record.surface} · ${record.color_name}`, `Paint context · ${location.name}`, locationId, record.id);
    }
  }
  return rows;
}

export function parseStaffPhotoListResponse(value: unknown): StaffPhotoPlacement[] | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const root = value as Record<string, unknown>;
  if (Object.keys(root).length !== 1 || !Array.isArray(root.photos)) return null;
  const rows: StaffPhotoPlacement[] = [];
  const seen = new Set<string>();
  for (const entry of root.photos) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const photo = entry as Record<string, unknown>;
    const expectedKeys = ["slotId", "versionId", "placement", "locationId", "recordId"];
    if (Object.keys(photo).length !== expectedKeys.length || !expectedKeys.every((key) => Object.prototype.hasOwnProperty.call(photo, key))) return null;
    if (typeof photo.slotId !== "string" || !UUID.test(photo.slotId) || typeof photo.versionId !== "string" || !UUID.test(photo.versionId)) return null;
    if (typeof photo.placement !== "string" || !PHOTO_PLACEMENTS.has(photo.placement as PhotoPlacementKind)) return null;
    if (photo.locationId !== null && (typeof photo.locationId !== "string" || !UUID.test(photo.locationId))) return null;
    if (photo.recordId !== null && (typeof photo.recordId !== "string" || !UUID.test(photo.recordId))) return null;
    if (photo.placement === "residence_cover" && (photo.locationId !== null || photo.recordId !== null)) return null;
    if (photo.placement === "location" && (photo.locationId === null || photo.recordId !== null)) return null;
    if (photo.placement === "record_context" && (photo.locationId === null || photo.recordId === null)) return null;
    if (photo.placement === "record_formula_label" && (photo.locationId !== null || photo.recordId === null)) return null;
    const key = `${photo.placement}:${photo.locationId ?? ""}:${photo.recordId ?? ""}`;
    if (seen.has(key)) return null;
    seen.add(key);
    rows.push({ id: key, placement: photo.placement as PhotoPlacementKind, locationId: photo.locationId as string | null, recordId: photo.recordId as string | null, photo: { slotId: photo.slotId, versionId: photo.versionId } });
  }
  return rows;
}

function requestError(status: number): StaffPhotoRequestError {
  if (status === 401) return new StaffPhotoRequestError("auth", status);
  if (status === 403) return new StaffPhotoRequestError("forbidden", status);
  if (status === 404) return new StaffPhotoRequestError("not_found", status);
  if (status === 409) return new StaffPhotoRequestError("conflict", status);
  return new StaffPhotoRequestError("network", status);
}

async function token(options: PhotoClientOptions) {
  try {
    const value = await options.getAccessToken();
    if (typeof value !== "string" || !value) throw new Error("No session token.");
    return value;
  } catch {
    throw new StaffPhotoRequestError("auth", 401);
  }
}

async function fetchResponse(fetcher: Fetcher, url: string, init: RequestInit) {
  try {
    const response = await fetcher(url, { ...init, credentials: "same-origin" });
    if (!response.ok) throw requestError(response.status);
    return response;
  } catch (error) {
    if (error instanceof StaffPhotoRequestError) throw error;
    throw new StaffPhotoRequestError("network");
  }
}

export function createStaffPhotoClient(options: PhotoClientOptions) {
  const fetcher = options.fetcher ?? fetch;
  return {
    async list(guideId: string, signal?: AbortSignal): Promise<StaffPhotoPlacement[]> {
      if (!UUID.test(guideId)) throw new StaffPhotoRequestError("invalid_response");
      const accessToken = await token(options);
      const response = await fetchResponse(fetcher, `${API}?guideId=${encodeURIComponent(guideId)}`, {
        method: "GET", headers: { Authorization: `Bearer ${accessToken}` }, signal,
      });
      let value: unknown;
      try { value = await response.json(); } catch { throw new StaffPhotoRequestError("invalid_response"); }
      const result = options.parseList(value);
      if (!result) throw new StaffPhotoRequestError("invalid_response");
      return result;
    },

    async upload(input: { guideId: string; placement: PhotoPlacementKind; locationId?: string | null; recordId?: string | null; attemptId: string; image: File; signal?: AbortSignal }): Promise<PhotoUploadResult> {
      const hasLocation = Boolean(input.locationId);
      const hasRecord = Boolean(input.recordId);
      const badPlacement = !PHOTO_PLACEMENTS.has(input.placement)
        || (input.placement === "residence_cover" && (hasLocation || hasRecord))
        || (input.placement === "location" && (!hasLocation || hasRecord))
        || (input.placement === "record_context" && (!hasLocation || !hasRecord))
        || (input.placement === "record_formula_label" && (hasLocation || !hasRecord));
      const maxBytes = input.placement === "record_formula_label" ? 16 * 1024 * 1024 : 3 * 1024 * 1024;
      if (!UUID.test(input.guideId) || (input.locationId && !UUID.test(input.locationId)) || (input.recordId && !UUID.test(input.recordId)) || !UUID.test(input.attemptId) || !input.image.size || input.image.size > maxBytes || badPlacement) {
        throw new StaffPhotoRequestError("invalid_response");
      }
      const body = new FormData();
      body.set("guideId", input.guideId);
      body.set("placement", input.placement);
      body.set("attemptId", input.attemptId);
      if (input.locationId) body.set("locationId", input.locationId);
      if (input.recordId) body.set("recordId", input.recordId);
      body.set("image", input.image, input.image.name);
      const accessToken = await token(options);
      const response = await fetchResponse(fetcher, API, {
        method: "POST", headers: { Authorization: `Bearer ${accessToken}` }, body, signal: input.signal,
      });
      let value: unknown;
      try { value = await response.json(); } catch { throw new StaffPhotoRequestError("invalid_response"); }
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new StaffPhotoRequestError("invalid_response");
      const result = value as Record<string, unknown>;
      if (Object.keys(result).length !== 2 || typeof result.versionId !== "string" || !UUID.test(result.versionId) || result.state !== "ready") {
        throw new StaffPhotoRequestError("invalid_response");
      }
      return { versionId: result.versionId, state: "ready" };
    },

    async remove(slotId: string, signal?: AbortSignal): Promise<void> {
      if (!UUID.test(slotId)) throw new StaffPhotoRequestError("invalid_response");
      const accessToken = await token(options);
      await fetchResponse(fetcher, `/api/paint-guide/staff/photo-slots/${encodeURIComponent(slotId)}`, {
        method: "DELETE", headers: { Authorization: `Bearer ${accessToken}` }, signal,
      });
    },

    async image(versionId: string, variant: "full" | "thumb", signal?: AbortSignal): Promise<Blob> {
      if (!UUID.test(versionId)) throw new StaffPhotoRequestError("invalid_response");
      const accessToken = await token(options);
      const response = await fetchResponse(fetcher, `${API}/${encodeURIComponent(versionId)}?variant=${variant}`, {
        method: "GET", headers: { Authorization: `Bearer ${accessToken}` }, signal,
      });
      return response.blob();
    },
  };
}
