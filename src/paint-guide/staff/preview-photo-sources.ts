import type { StaffPhotoPlacement } from "./photo-client.js";

export type StaffPreviewPhotoSources = {
  heroImageUrl: string | null;
  roomPhotoUrls: Readonly<Record<string, string>>;
  recordPhotoUrls: Readonly<Record<string, Readonly<Record<string, string>>>>;
  formulaLabelPhotoUrls: Readonly<Record<string, readonly string[]>>;
};

/** Maps only the current photo-list response to already-authorized staff image URLs. */
export function buildStaffPreviewPhotoSources(
  photos: readonly StaffPhotoPlacement[],
  imageUrlsByVersion: ReadonlyMap<string, string>,
): StaffPreviewPhotoSources {
  let heroImageUrl: string | null = null;
  const roomPhotoUrls: Record<string, string> = {};
  const recordPhotoUrls: Record<string, Record<string, string>> = {};
  const formulaLabelPhotoUrls: Record<string, string[]> = {};

  for (const item of photos) {
    if (!item.photo) continue;
    const url = imageUrlsByVersion.get(item.photo.versionId);
    if (!url) continue;
    if (item.placement === "residence_cover") {
      heroImageUrl = url;
    } else if (item.placement === "location" && item.locationId) {
      roomPhotoUrls[item.locationId] = url;
    } else if (item.placement === "record_context" && item.locationId && item.recordId) {
      (recordPhotoUrls[item.locationId] ??= {})[item.recordId] = url;
    } else if (item.placement === "record_formula_label" && item.recordId) {
      (formulaLabelPhotoUrls[item.recordId] ??= []).push(url);
    }
  }

  return { heroImageUrl, roomPhotoUrls, recordPhotoUrls, formulaLabelPhotoUrls };
}

