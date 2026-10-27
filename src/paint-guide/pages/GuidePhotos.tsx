import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useParams } from "react-router-dom";
import { Check, ChevronRight, CircleAlert, FileImage, ImagePlus, LoaderCircle, Maximize2, Trash2, Upload, X } from "lucide-react";
import { GuideEditorNav } from "../components/GuideEditorNav";
import { StaffPageShell } from "../components/StaffPageShell";
import { useAuth } from "../auth/useAuth";
import { getPaintGuide } from "../data/guides";
import { listGuideLocations } from "../data/locations";
import { listPaintRecords } from "../data/paint-records";
import { listPaintRecordLocations } from "../data/paint-record-locations";
import type { PaintGuide } from "../data/types";
import { supabase } from "../lib/supabase";
import { buildPhotoPlacementViews, createStaffPhotoClient, currentStaffPhotoPreview, parseStaffPhotoListResponse, photoMutationSuccessMessage, staffPhotoPreviewIdentity, StaffPhotoRequestError, type PhotoPlacementView, type StaffPhotoPreview } from "../staff/photo-client";
import { PhotoPreparationError, preparePhotoUpload } from "../lib/prepare-photo-upload";
import "./guide-photos.css";

type Placement = PhotoPlacementView;
type LoadState = "loading" | "ready" | "error";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
const MAX_FORMULA_LABEL_UPLOAD_BYTES = 16 * 1024 * 1024;
const FORMULA_LABEL_UPLOAD_MODE = import.meta.env.VITE_TAURO_FORMULA_LABEL_UPLOAD_MODE === "candidate";
const ACCEPTED_FILE_HINT = "JPEG, PNG, WebP, or HEIC/HEIF";
const FORMULA_LABEL_FILE_HINT = "JPEG, PNG, or WebP · original resolution retained";
const unsupportedImageMessage = "This photo format isn’t supported by this browser. Please export or save it as JPG and try again.";
const errorText = (error: unknown) => error instanceof PhotoPreparationError && error.code === "unsupported"
  ? error.message === "unsupported" ? unsupportedImageMessage : error.message
  : error instanceof StaffPhotoRequestError && error.status === 413
  ? "This image exceeds the safe full-resolution limit. Crop or recapture closer; it will not be reduced automatically."
  : error instanceof StaffPhotoRequestError && error.code === "auth"
  ? "Your session expired. Sign in again and retry."
  : "The photo request failed. Please try again.";
const formatBytes = (value: number) => value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

export function GuidePhotos() {
  const { guideId = "" } = useParams();
  const { profile, session } = useAuth();
  const canWrite = profile?.role === "owner";
  const [guide, setGuide] = useState<PaintGuide | null>(null);
  const [placements, setPlacements] = useState<Placement[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [pending, setPending] = useState(false);
  const [progress, setProgress] = useState("");
  const [message, setMessage] = useState("");
  const [messageIsError, setMessageIsError] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [imageFailedFor, setImageFailedFor] = useState<string | null>(null);
  const [preview, setPreview] = useState<StaffPhotoPreview | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const actionController = useRef<AbortController | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const keepRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const selected = placements.find((item) => item.id === selectedId) ?? placements[0] ?? null;
  const selectedPhotoVersion = selected?.photo?.versionId ?? null;
  const previewIdentity = staffPhotoPreviewIdentity(guideId, session?.user.id ?? null, selected?.id ?? null, selectedPhotoVersion);
  const currentPreview = currentStaffPhotoPreview(preview, previewIdentity);
  const previewUrl = currentPreview?.url ?? null;
  const previewInfo = currentPreview;
  const imageFailed = imageFailedFor === previewIdentity;
  const withPhotos = placements.filter((item) => item.photo).length;
  const client = useMemo(() => createStaffPhotoClient({
    getAccessToken: async () => {
      if (!supabase) throw new Error("Authentication unavailable");
      const { data, error } = await supabase.auth.refreshSession();
      if (error || !data.session?.access_token || data.session.user.id !== session?.user.id) throw new Error("Session refresh failed");
      return data.session.access_token;
    },
    parseList: parseStaffPhotoListResponse,
  }), [session?.user.id]);

  const load = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    if (!UUID.test(guideId)) { setLoadState("error"); setMessage("Please try again."); setMessageIsError(true); return false; }
    setLoadState("loading"); setMessage(""); setMessageIsError(false);
    try {
      const [nextGuide, locations, records, assignments, photos] = await Promise.all([
        getPaintGuide(guideId), listGuideLocations(guideId), listPaintRecords(guideId), listPaintRecordLocations(guideId), client.list(guideId, signal),
      ]);
      if (signal?.aborted || !alive.current) return false;
      if (!nextGuide) { setGuide(null); setLoadState("error"); setMessage("Please try again."); setMessageIsError(true); return false; }
      setGuide(nextGuide);
      const next = buildPhotoPlacementViews(locations, records, assignments, photos, FORMULA_LABEL_UPLOAD_MODE);
      setPlacements(next);
      setSelectedId((current) => next.some((item) => item.id === current) ? current : next[0]?.id ?? "");
      setLoadState("ready");
      return true;
    } catch (error) {
      if (signal?.aborted || !alive.current) return false;
      setLoadState("error");
      setMessage(errorText(error));
      setMessageIsError(true);
      return false;
    }
  }, [client, guideId]);

  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void load(controller.signal);
    return () => { alive.current = false; controller.abort(); actionController.current?.abort(); };
  }, [load]);

  useEffect(() => {
    setConfirmDelete(false); setViewing(false); setMessage(""); setMessageIsError(false);
  }, [selectedId]);

  useEffect(() => {
    let live = true;
    let ownedPreviewUrl: string | null = null;
    const requestIdentity = previewIdentity;
    const controller = new AbortController();
    setImageFailedFor(null);
    setPreview(null);
    if (!selected?.photo) return () => { live = false; controller.abort(); };
    void client.image(selected.photo.versionId, "full", controller.signal).then((blob) => {
      if (!live || !alive.current) return;
      const nextPreview = { identity: requestIdentity, url: URL.createObjectURL(blob), mimeType: blob.type, byteSize: blob.size };
      ownedPreviewUrl = nextPreview.url;
      setPreview(nextPreview);
    }).catch(() => { if (live && !controller.signal.aborted) setImageFailedFor(requestIdentity); });
    return () => {
      live = false;
      controller.abort();
      if (ownedPreviewUrl) URL.revokeObjectURL(ownedPreviewUrl);
    };
  }, [client, previewIdentity, selected?.photo?.versionId]);

  useEffect(() => {
    if (!viewing && !confirmDelete) return;
    const focusTarget = viewing ? document.querySelector<HTMLButtonElement>(".c3-viewer-close") : keepRef.current;
    focusTarget?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setViewing(false); setConfirmDelete(false); }
      if (event.key === "Tab" && confirmDelete) {
        if (event.shiftKey && document.activeElement === keepRef.current) { event.preventDefault(); confirmRef.current?.focus(); }
        else if (!event.shiftKey && document.activeElement === confirmRef.current) { event.preventDefault(); keepRef.current?.focus(); }
      }
      if (event.key === "Tab" && viewing) { event.preventDefault(); document.querySelector<HTMLButtonElement>(".c3-viewer-close")?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); opener.current?.focus(); };
  }, [viewing, confirmDelete]);

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; event.target.value = "";
    if (!file || !selected || !canWrite || !selected.uploadSupported) return;
    const isFormulaLabel = selected.kind === "record_formula_label";
    setMessage(""); setMessageIsError(false); setProgress(isFormulaLabel ? "Checking original image." : "Preparing image…"); setPending(true);
    const controller = new AbortController(); actionController.current = controller;
    try {
      let prepared: File;
      if (isFormulaLabel) {
        if (!(new Set(["image/jpeg", "image/png", "image/webp"])).has(file.type)) throw new PhotoPreparationError("unsupported", "Formula-label photos must be JPEG, PNG, or WebP so the server can preserve original detail.");
        if (!file.size || file.size > MAX_FORMULA_LABEL_UPLOAD_BYTES) throw new PhotoPreparationError("too_large", "Formula-label photos must be 16 MiB or smaller; the image will not be reduced.");
        prepared = file;
      } else {
        prepared = await preparePhotoUpload(file, { signal: controller.signal });
        if (prepared.type !== "image/webp" || prepared.size < 1 || prepared.size > MAX_UPLOAD_BYTES) throw new PhotoPreparationError("encode_failed");
      }
      if (!alive.current || controller.signal.aborted) return;
      setProgress(isFormulaLabel ? "Uploading original for full-resolution processing." : "Uploading photo.");
      await client.upload({ guideId, placement: selected.kind, locationId: selected.locationId, recordId: selected.recordId, attemptId: crypto.randomUUID(), image: prepared, signal: controller.signal });
      if (!alive.current || controller.signal.aborted) return;
      setProgress("Refreshing photo details…");
      const refreshed = await load(controller.signal);
      const successMessage = photoMutationSuccessMessage(selected.title, "saved", refreshed);
      if (alive.current && successMessage) { setMessage(successMessage); setMessageIsError(false); }
    } catch (error) {
      if (!controller.signal.aborted && alive.current) { setMessage(errorText(error)); setMessageIsError(true); }
    } finally { if (alive.current) { setPending(false); setProgress(""); } actionController.current = null; }
  }

  async function removePhoto() {
    if (!selected?.photo || !canWrite) return;
    setPending(true); setMessage(""); setMessageIsError(false);
    const controller = new AbortController(); actionController.current = controller;
    try {
      await client.remove(selected.photo.slotId, controller.signal);
      if (!alive.current || controller.signal.aborted) return;
      setConfirmDelete(false); setViewing(false);
      const refreshed = await load(controller.signal);
      const successMessage = photoMutationSuccessMessage(selected.title, "removed", refreshed);
      if (alive.current && successMessage) { setMessage(successMessage); setMessageIsError(false); }
    } catch (error) { if (alive.current && !controller.signal.aborted) { setMessage(errorText(error)); setMessageIsError(true); } setConfirmDelete(false); }
    finally { if (alive.current) setPending(false); actionController.current = null; }
  }

  if (loadState === "loading") return <StaffPageShell title="Paint Guide"><p className="py-12 text-sm" role="status"><LoaderCircle className="mr-2 inline animate-spin" size={16} />Loading photo placements…</p></StaffPageShell>;
  if (loadState === "error") return <StaffPageShell title="Paint Guide"><section className="max-w-xl py-12" role="alert"><CircleAlert size={22}/><h2 className="mt-3 font-serif text-3xl">Photos could not be loaded</h2><p className="mt-3 text-sm text-[#20211f]/65">{message || "Please try again."}</p><button className="mt-6 border border-[#20211f] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em]" onClick={() => void load()} type="button">Try again</button></section></StaffPageShell>;

  return <StaffPageShell title={guide?.residence_name ?? "Paint Guide"}>
    <GuideEditorNav active="photos" />
    <div className="c3-photos-layout">
      <aside className="c3-photos-sidebar" aria-label="Photo placements">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">Guide editor</p><h2 className="mt-2 font-serif text-3xl">Photos</h2><p className="mt-2 text-sm text-[#20211f]/65">Room and paint context for this guide.</p></div>
        <div className="c3-placement-count" aria-live="polite">{withPhotos} of {placements.length} placements have photos</div>
        {placements.map((item) => <button className={`c3-placement-row ${selected?.id === item.id ? "is-selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button" aria-current={selected?.id === item.id ? "page" : undefined}>
          <span className={`c3-placement-dot ${item.photo ? "has-photo" : ""}`} aria-hidden="true">{item.photo ? <Check size={11}/> : null}</span><span className="c3-placement-text"><strong>{item.title}</strong><small>{item.group}{item.photo ? " · Photo added" : " · No photo"}</small></span><ChevronRight size={15}/>
        </button>)}
        <p className="c3-photos-note">Photos are optional and are linked to one residence, location, or paint selection.</p>
      </aside>
      <section className="c3-photos-workspace" aria-label="Selected photo placement">
        <div className="c3-photos-heading"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9b6b36]">{selected?.group} · Photo placement</p><h2 className="mt-2 font-serif text-3xl">{selected?.title}</h2><p className="mt-2 text-sm text-[#20211f]/65">{selected?.context}</p></div><span className="c3-photo-status">{selected?.photo ? "Photo added" : "Optional"}</span></div>
        <div className="c3-photos-content">
          <div className="c3-photo-preview" aria-label={selected?.photo ? "Photo preview" : "No photo preview"}>
            {previewUrl && !imageFailed ? <img key={previewIdentity} src={previewUrl} alt={`${selected?.title} photo preview`} onError={() => setImageFailedFor(previewIdentity)}/> : <div className="c3-photo-empty"><span><ImagePlus size={24}/></span><strong>{imageFailed ? "Preview unavailable" : "No photo added yet"}</strong><p>{imageFailed ? "The image could not be opened. You can choose another file." : "Add a clear photo to help identify this space."}</p></div>}
            {previewUrl && !imageFailed ? <button className="c3-preview-open" onClick={(event) => { opener.current = event.currentTarget; setViewing(true); }} type="button" aria-label={`View ${selected?.title} photo full size`}><Maximize2 size={16}/></button> : null}
            {pending ? <div className="c3-upload-progress" role="status"><LoaderCircle size={15} className="animate-spin"/>{progress}</div> : null}
          </div>
          <aside className="c3-photo-details"><p className="text-xs font-semibold uppercase tracking-[0.16em]">Photo details</p>
            {selected?.kind === "record_formula_label" ? <p className="my-4 border border-[#9b6b36]/30 bg-[#f0ece3] p-3 text-sm leading-6" role="status">{FORMULA_LABEL_UPLOAD_MODE ? "Add or replace the dedicated full-resolution paint-can sticker photo. Room photos are kept separate." : "Formula label photo pending. Saving remains disabled until a protected matching photo service is available. Room photos will never be used as a substitute."}</p> : null}
            {selected?.photo ? <dl><div><dt>Photo</dt><dd>Current version</dd></div>{previewInfo ? <><div><dt>Format</dt><dd>{previewInfo.mimeType.replace("image/", "").toUpperCase() || "Image"}</dd></div><div><dt>File size</dt><dd>{formatBytes(previewInfo.byteSize)}</dd></div></> : <div><dt>Preview</dt><dd>Loading…</dd></div>}</dl> : <p className="my-5 text-sm text-[#20211f]/60">Details appear here after a photo is added.</p>}
            {canWrite ? <>
              <div className="c3-photo-guidance"><FileImage size={17}/><span>{selected?.kind === "record_formula_label" ? FORMULA_LABEL_FILE_HINT : ACCEPTED_FILE_HINT}<br/><strong>{selected?.kind === "record_formula_label" ? "Maximum 16 MiB · no client-side resizing" : "Prepared upload · 3 MiB"}</strong></span></div>
              <input ref={fileInput} className="c3-file-input" type="file" accept={selected?.kind === "record_formula_label" ? "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp" : "image/*,.jpg,.jpeg,.png,.webp,.heic,.heif"} aria-label={`Choose photo for ${selected?.title ?? "placement"}`} onChange={(event) => void chooseFile(event)}/>
              <button className="c3-photo-button c3-photo-button--dark" disabled={pending || !selected || !selected.uploadSupported} onClick={() => fileInput.current?.click()} type="button"><Upload size={15}/>{selected?.photo ? "Replace photo" : "Add a photo"}</button>
              {selected?.photo ? <><button className="c3-photo-button c3-photo-button--quiet" disabled={pending || !previewUrl} onClick={(event) => { opener.current = event.currentTarget; setViewing(true); }} type="button">View full size</button><button className="c3-photo-button c3-photo-button--remove" disabled={pending} onClick={(event) => { opener.current = event.currentTarget; setConfirmDelete(true); }} type="button"><Trash2 size={14}/>Remove photo</button></> : null}
            </> : <p className="c3-readonly-note" role="note">Read-only access · photo changes are available to Owners.</p>}
          </aside>
        </div>
        <div className="c3-photos-footer"><span><span className="c3-footer-dot"/> Guide photo storage</span><span>{selected?.photo ? "One photo assigned to this placement" : "No photo assigned"}</span></div>
        {message ? <p className={`c3-photo-message ${messageIsError ? "is-error" : ""}`} role={messageIsError ? "alert" : "status"}>{message}</p> : null}
        {confirmDelete && selected?.photo ? <div className="c3-dialog-scrim"><section className="c3-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="c3-delete-title" aria-describedby="c3-delete-copy"><span className="c3-confirm-icon"><Trash2 size={18}/></span><h3 id="c3-delete-title">Remove this photo?</h3><p id="c3-delete-copy">This removes the photo from {selected.title}. The placement will remain available.</p><div><button ref={keepRef} className="c3-photo-button c3-photo-button--quiet" onClick={() => setConfirmDelete(false)} type="button">Keep photo</button><button ref={confirmRef} className="c3-photo-button c3-photo-button--danger" disabled={pending} onClick={() => void removePhoto()} type="button">{pending ? "Removing…" : "Remove photo"}</button></div></section></div> : null}
        {viewing && previewUrl && !imageFailed ? <div className="c3-dialog-scrim c3-viewer-scrim" onClick={() => setViewing(false)}><section className="c3-viewer" role="dialog" aria-modal="true" aria-labelledby="c3-viewer-title" onClick={(event) => event.stopPropagation()}><header><span id="c3-viewer-title">{selected?.title}</span><button className="c3-viewer-close" onClick={() => setViewing(false)} type="button" aria-label="Close photo viewer"><X size={18}/></button></header><img src={previewUrl} alt={`${selected?.title} full-size photo`}/></section></div> : null}
      </section>
    </div>
  </StaffPageShell>;
}
