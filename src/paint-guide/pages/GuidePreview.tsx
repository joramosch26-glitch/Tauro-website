import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { HomeownerGuideDocument } from "../components/HomeownerGuideDocument";
import type { HomeownerGuideDocumentData } from "../presentation/types";
import { getPaintGuide } from "../data/guides";
import { listGuideLocations } from "../data/locations";
import { listPaintRecordLocations } from "../data/paint-record-locations";
import { listPaintRecords } from "../data/paint-records";
import { useAuth } from "../auth/useAuth";
import { supabase } from "../lib/supabase";
import { createStaffPhotoClient, parseStaffPhotoListResponse } from "../staff/photo-client";
import { buildStaffPreviewPhotoSources, loadStaffPreviewPhotosProgressively, type StaffPreviewPhotoSources } from "../staff/preview-photo-sources";
import type {
  GuideLocation,
  PaintGuide,
  PaintGuideStatus,
  PaintRecord,
  PaintRecordLocation,
} from "../data/types";

type LoadState = "loading" | "ready" | "not_found" | "error";
type PhotoLoadState = "idle" | "loading" | "ready" | "error";
const EMPTY_PHOTO_SOURCES: StaffPreviewPhotoSources = {
  heroImageUrl: null,
  roomPhotoUrls: {},
  recordPhotoUrls: {},
  formulaLabelPhotoUrls: {},
};

function statusLabel(status: PaintGuideStatus) {
  return `${status.charAt(0).toUpperCase()}${status.slice(1)} · Staff Preview`;
}

export function GuidePreview() {
  const { guideId = "" } = useParams();
  const { session } = useAuth();
  const [guide, setGuide] = useState<PaintGuide | null>(null);
  const [records, setRecords] = useState<PaintRecord[]>([]);
  const [locations, setLocations] = useState<GuideLocation[]>([]);
  const [assignments, setAssignments] = useState<PaintRecordLocation[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [loadedGuideId, setLoadedGuideId] = useState<string | null>(null);
  const [photoSources, setPhotoSources] = useState<StaffPreviewPhotoSources>(EMPTY_PHOTO_SOURCES);
  const [photoLoadState, setPhotoLoadState] = useState<PhotoLoadState>("idle");

  useEffect(() => {
    let active = true;

    setState("loading");
    setGuide(null);
    setRecords([]);
    setLocations([]);
    setAssignments([]);
    setLoadedGuideId(null);
    setPhotoSources(EMPTY_PHOTO_SOURCES);
    setPhotoLoadState("idle");

    async function load() {
      try {
        const nextGuide = await getPaintGuide(guideId);
        if (!active) return;

        if (!nextGuide) {
          setState("not_found");
          return;
        }

        const [nextRecords, nextLocations, nextAssignments] = await Promise.all([
          listPaintRecords(guideId),
          listGuideLocations(guideId),
          listPaintRecordLocations(guideId),
        ]);
        if (!active) return;

        setGuide(nextGuide);
        setRecords(nextRecords);
        setLocations(nextLocations);
        setAssignments(nextAssignments);
        setLoadedGuideId(guideId);
        setState("ready");
      } catch {
        if (active) setState("error");
      }
    }

    void load();

    return () => {
      active = false;
    };
  }, [guideId]);

  useEffect(() => {
    if (loadedGuideId !== guideId || !guide) return;
    const controller = new AbortController();
    let active = true;
    const objectUrls: string[] = [];

    async function loadPhotos() {
      setPhotoLoadState("loading");
      try {
        if (!supabase || !session?.user.id) throw new Error("Authentication unavailable");
        const { data, error } = await supabase.auth.refreshSession();
        if (error || !data.session?.access_token || data.session.user.id !== session.user.id) {
          throw new Error("Session refresh failed");
        }
        const accessToken = data.session.access_token;
        const photoClient = createStaffPhotoClient({
          getAccessToken: async () => accessToken,
          parseList: parseStaffPhotoListResponse,
        });
        const placements = await photoClient.list(guideId, controller.signal);
        const imageUrlsByVersion = new Map<string, string>();
        const failures = await loadStaffPreviewPhotosProgressively(placements, async (item, signal) => {
          const photo = item.photo;
          if (!photo) throw new Error("Photo version is unavailable");
          const variant = item.placement === "location" || item.placement === "record_context" ? "thumb" : "full";
          const blob = await photoClient.image(photo.versionId, variant, signal);
          const url = URL.createObjectURL(blob);
          objectUrls.push(url);
          return url;
        }, (versionId, url) => {
          imageUrlsByVersion.set(versionId, url);
          setPhotoSources(buildStaffPreviewPhotoSources(placements, imageUrlsByVersion));
        }, controller.signal, 4);
        if (!active) return;
        setPhotoLoadState(failures === 0 ? "ready" : "error");
      } catch {
        if (active) setPhotoLoadState("error");
      }
    }

    void loadPhotos();
    return () => {
      active = false;
      controller.abort();
      for (const url of objectUrls) URL.revokeObjectURL(url);
    };
  }, [guide, guideId, loadedGuideId, session?.user.id]);

  if (state === "loading" || (state === "ready" && loadedGuideId !== guideId)) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#20211f]" data-paint-guide-shell="true">
        <p className="text-sm font-semibold uppercase tracking-[0.16em]">
          Loading Paint Guide Preview…
        </p>
      </main>
    );
  }

  if (state === "not_found") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]" data-paint-guide-shell="true">
        <section className="w-full max-w-xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
            Staff Preview
          </p>
          <h1 className="mt-4 font-serif text-4xl">Paint Guide not found</h1>
          <Link className="mt-8 inline-flex border border-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]" to="/paint-guide">
            Back to Paint Guides
          </Link>
        </section>
      </main>
    );
  }

  if (state === "error") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]" data-paint-guide-shell="true">
        <section className="w-full max-w-xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
            Staff Preview
          </p>
          <h1 className="mt-4 font-serif text-4xl">Could not load Paint Guide.</h1>
          <p className="mt-4 leading-7 text-[#20211f]/65">Please return to the dashboard and try again.</p>
          <Link className="mt-8 inline-flex border border-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]" to="/paint-guide">
            Back to Paint Guides
          </Link>
        </section>
      </main>
    );
  }

  if (!guide) return null;

  // Explicitly project authorized rows: database/security metadata stays in this page.
  const documentData: HomeownerGuideDocumentData = {
    guide: {
      residence_name: guide.residence_name,
      primary_scope_note: guide.primary_scope_note,
    },
    locations: locations.map(({ id, parent_id, name, sort_order, created_at }) => ({
      id, parent_id, name, sort_order, created_at,
    })),
    records: records.map(({
      id, section, surface, brand, product, color_name, color_code,
      sheen, notes, sort_order, created_at,
    }) => ({
      id, section, surface, brand, product, color_name, color_code,
      sheen, notes, sort_order, created_at,
    })),
    assignments: assignments.map(({ paint_record_id, location_id }) => ({
      paint_record_id, location_id,
    })),
  };

  return (
    <main className="min-h-screen bg-[#f5f1e8] px-4 py-5 text-[#20211f] sm:px-8 sm:py-10" data-paint-guide-shell="true">
      <div className="mx-auto max-w-5xl">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border border-[#20211f]/15 bg-white px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] sm:px-5">
          <Link className="text-[#20211f] underline decoration-[#9b6b36] underline-offset-4" to={`/paint-guide/g/${guideId}`}>
            Back to Guide
          </Link>
          <span className="text-[#20211f]/65">
            {guide ? statusLabel(guide.status) : "Staff Preview"}
          </span>
        </div>

        {photoLoadState === "loading" ? <p className="mb-4 border border-[#20211f]/15 bg-white px-4 py-3 text-sm" role="status">Loading current guide photos…</p> : null}
        {photoLoadState === "error" ? <p className="mb-4 border border-[#9b6b36]/40 bg-white px-4 py-3 text-sm" role="status">Guide details loaded, but photos could not be loaded for this preview.</p> : null}
        <HomeownerGuideDocument
          data={documentData}
          heroImageUrl={photoSources.heroImageUrl}
          roomPhotoUrls={photoSources.roomPhotoUrls}
          recordPhotoUrls={photoSources.recordPhotoUrls}
          formulaLabelPhotoUrls={photoSources.formulaLabelPhotoUrls}
        />
      </div>
    </main>
  );
}
