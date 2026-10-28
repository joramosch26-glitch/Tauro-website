import type { GuideLocation, PaintGuide, PaintRecord, PaintRecordLocation } from "../data/types.js";

export type GuidePreviewData = {
  records: PaintRecord[];
  locations: GuideLocation[];
  assignments: PaintRecordLocation[];
};

/** Confirm guide access, then start photo work before display metadata resolves. */
export async function loadGuidePreviewData(options: {
  guideId: string;
  signal: AbortSignal;
  getGuide: (guideId: string) => Promise<PaintGuide | null>;
  listRecords: (guideId: string) => Promise<PaintRecord[]>;
  listLocations: (guideId: string) => Promise<GuideLocation[]>;
  listAssignments: (guideId: string) => Promise<PaintRecordLocation[]>;
  onGuideConfirmed: (guide: PaintGuide) => void;
  onMetadataLoaded: (data: GuidePreviewData) => void;
  onNotFound: () => void;
  onError: () => void;
}): Promise<void> {
  const { guideId, signal } = options;
  try {
    const guide = await options.getGuide(guideId);
    if (signal.aborted) return;
    if (!guide) {
      options.onNotFound();
      return;
    }

    options.onGuideConfirmed(guide);
    const [records, locations, assignments] = await Promise.all([
      options.listRecords(guideId),
      options.listLocations(guideId),
      options.listAssignments(guideId),
    ]);
    if (signal.aborted) return;
    options.onMetadataLoaded({ records, locations, assignments });
  } catch {
    if (!signal.aborted) options.onError();
  }
}

