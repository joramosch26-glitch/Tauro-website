import type { HomeownerGuidePhoto } from "../presentation/types.js";

export type HomeownerPhotoSources = {
  heroImageUrl: string | null;
  roomPhotoUrls: Readonly<Record<string, string>>;
  recordPhotoUrls: Readonly<Record<string, Readonly<Record<string, string>>>>;
  formulaLabelPhotoUrls: Readonly<Record<string, readonly string[]>>;
};

function protectedPhotoUrl(versionId: string, variant: "full" | "thumb") {
  const query = variant === "thumb" ? "?variant=thumb" : "";
  return `/api/paint-guide/homeowner/photos/${encodeURIComponent(versionId)}${query}`;
}

export function buildHomeownerPhotoSources(photos: readonly HomeownerGuidePhoto[] | undefined): HomeownerPhotoSources {
  let heroImageUrl: string | null = null;
  const roomPhotoUrls: Record<string, string> = {};
  const recordPhotoUrls: Record<string, Record<string, string>> = {};
  const formulaLabelPhotoUrls: Record<string, string[]> = {};
  for (const photo of photos ?? []) {
    if (photo.placement_kind === "residence_cover") {
      heroImageUrl = protectedPhotoUrl(photo.version_id, "full");
    } else if (photo.placement_kind === "location" && photo.location_id) {
      roomPhotoUrls[photo.location_id] = protectedPhotoUrl(photo.version_id, "thumb");
    } else if (photo.placement_kind === "record_context" && photo.location_id && photo.paint_record_id) {
      const recordPhotosForLocation = recordPhotoUrls[photo.location_id] ?? {};
      recordPhotosForLocation[photo.paint_record_id] = protectedPhotoUrl(photo.version_id, "thumb");
      recordPhotoUrls[photo.location_id] = recordPhotosForLocation;
    } else if (photo.placement_kind === "record_formula_label" && photo.paint_record_id) {
      (formulaLabelPhotoUrls[photo.paint_record_id] ??= []).push(protectedPhotoUrl(photo.version_id, "full"));
    }
  }
  return { heroImageUrl, roomPhotoUrls, recordPhotoUrls, formulaLabelPhotoUrls };
}
