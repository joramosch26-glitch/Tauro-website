import type { StaffPhotoPlacement } from "./photo-client.js";

export type StaffPreviewPhotoSources = {
  heroImageUrl: string | null;
  roomPhotoUrls: Readonly<Record<string, string>>;
  recordPhotoUrls: Readonly<Record<string, Readonly<Record<string, string>>>>;
  formulaLabelPhotoUrls: Readonly<Record<string, readonly string[]>>;
};

const PHOTO_PRIORITY: Record<StaffPhotoPlacement["placement"], number> = {
  residence_cover: 0,
  location: 1,
  record_context: 2,
  record_formula_label: 3,
};

/**
 * Fetch current staff-preview photos in visual priority order and publish each
 * successful image as soon as it is ready. A bounded worker pool avoids
 * launching dozens of private-storage requests at once; an individual failure
 * does not hide images that loaded successfully.
 */
export async function loadStaffPreviewPhotosProgressively(
  placements: readonly StaffPhotoPlacement[],
  loadImage: (placement: StaffPhotoPlacement, signal: AbortSignal) => Promise<string>,
  onImage: (versionId: string, objectUrl: string) => void,
  signal: AbortSignal,
  concurrency = 4,
): Promise<number> {
  const byVersion = new Map<string, StaffPhotoPlacement>();
  for (const placement of placements) {
    if (!placement.photo) continue;
    const versionId = placement.photo.versionId;
    const previous = byVersion.get(versionId);
    if (!previous || PHOTO_PRIORITY[placement.placement] < PHOTO_PRIORITY[previous.placement]) {
      byVersion.set(versionId, placement);
    }
  }

  const ordered = [...byVersion.values()].sort((left, right) =>
    PHOTO_PRIORITY[left.placement] - PHOTO_PRIORITY[right.placement]);
  const concurrencyLimit = Math.max(1, Math.floor(concurrency) || 1);
  let failures = 0;

  // Keep detail/label downloads from competing with the first-screen cover
  // and room overview images. Each completed photo is still published at once.
  for (const priority of [0, 1, 2, 3]) {
    const group = ordered.filter((placement) => PHOTO_PRIORITY[placement.placement] === priority);
    let nextIndex = 0;
    const workerCount = Math.min(group.length, concurrencyLimit);
    await Promise.all(Array.from({ length: workerCount }, async () => {
      while (!signal.aborted) {
        const placement = group[nextIndex++];
        if (!placement) return;
        try {
          const objectUrl = await loadImage(placement, signal);
          if (!signal.aborted) onImage(placement.photo!.versionId, objectUrl);
        } catch {
          if (!signal.aborted) failures += 1;
        }
      }
    }));
    if (signal.aborted) break;
  }

  return failures;
}

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
