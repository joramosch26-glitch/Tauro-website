import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { ArrowLeft, Check, ChevronRight, CircleAlert, FileImage, House, ImagePlus, LoaderCircle, Maximize2, MoreHorizontal, Trash2, Upload, X } from "lucide-react";
import type { PrototypePhotoAdapter, PrototypePhotoPlacement } from "./photo-prototype-adapter";
import "./photo-management-prototype.css";

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const bytesLabel = (value: number | null) => value === null ? "—" : value >= 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(value / 1024))} KB`;

type Props = { adapter: PrototypePhotoAdapter; onItemsChange?: (items: PrototypePhotoPlacement[]) => void };

function PlacementThumbnail({ item, onView }: { item: PrototypePhotoPlacement; onView: () => void }) {
  return item.src ? (
    <button className="c-photo-thumb" onClick={onView} type="button" aria-label={`View ${item.title} photo`}>
      <img src={item.src} alt={`${item.title} synthetic preview`} />
      <span className="c-photo-thumb-zoom" aria-hidden="true"><Maximize2 size={15} /></span>
    </button>
  ) : (
    <div className="c-photo-thumb c-photo-thumb--empty" aria-label={`${item.title}: no photo`}>
      {item.id === "residence-cover" ? <House size={25} strokeWidth={1.2} /> : <FileImage size={24} strokeWidth={1.2} />}
      <span>No photo</span>
    </div>
  );
}

export function PhotoManagementPrototype({ adapter, onItemsChange }: Props) {
  const [items, setItems] = useState<PrototypePhotoPlacement[]>([]);
  const [selectedId, setSelectedId] = useState("kitchen-room");
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [viewing, setViewing] = useState<PrototypePhotoPlacement | null>(null);
  const [imageFailed, setImageFailed] = useState(false);
  const objectUrls = useRef(new Set<string>());
  const fileInput = useRef<HTMLInputElement>(null);
  const viewerCloseButton = useRef<HTMLButtonElement>(null);
  const viewerOpener = useRef<HTMLElement | null>(null);
  const deleteKeepButton = useRef<HTMLButtonElement>(null);
  const deleteConfirmButton = useRef<HTMLButtonElement>(null);
  const deleteOpener = useRef<HTMLElement | null>(null);
  const selected = items.find(item => item.id === selectedId) ?? null;
  const withPhotos = items.filter(item => item.src).length;

  async function load() {
    setLoadState("loading");
    setMessage("");
    try {
      setItems(await adapter.list());
      setLoadState("ready");
    } catch {
      setLoadState("error");
    }
  }

  useEffect(() => { void load(); return () => { for (const url of objectUrls.current) URL.revokeObjectURL(url); }; }, [adapter]);
  useEffect(() => { onItemsChange?.(items); }, [items, onItemsChange]);
  useEffect(() => { setImageFailed(false); setConfirmDelete(false); setMessage(""); }, [selectedId]);
  useEffect(() => { setImageFailed(false); }, [selected?.id, selected?.src]);

  useEffect(() => {
    if (!viewing) return;
    viewerCloseButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setViewing(null); }
      if (event.key === "Tab") { event.preventDefault(); viewerCloseButton.current?.focus(); }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      viewerOpener.current?.focus();
    };
  }, [viewing]);

  useEffect(() => {
    if (!confirmDelete) return;
    deleteKeepButton.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); setConfirmDelete(false); return; }
      if (event.key !== "Tab") return;
      const first = deleteKeepButton.current;
      const last = deleteConfirmButton.current;
      if (!first || !last) return;
      const focusOutsideDialog = !document.querySelector(".c-confirm-card")?.contains(document.activeElement);
      if (event.shiftKey && (document.activeElement === first || focusOutsideDialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || focusOutsideDialog)) {
        event.preventDefault(); first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (deleteOpener.current?.isConnected) deleteOpener.current.focus();
      else document.querySelector<HTMLElement>(".c-placement-row.is-selected")?.focus();
    };
  }, [confirmDelete]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selected) return;
    setMessage("");
    if (!ACCEPTED_TYPES.has(file.type)) { setMessage("Choose a JPEG, PNG, or WebP image."); return; }
    if (file.size < 1 || file.size > MAX_BYTES) { setMessage("Images must be smaller than 10 MB."); return; }
    const previous = selected.src;
    const localUrl = URL.createObjectURL(file);
    objectUrls.current.add(localUrl);
    setPending(true);
    try {
      const next = await adapter.replace(selected.id, { src: localUrl, fileName: file.name, mimeType: file.type, byteSize: file.size });
      setItems(current => current.map(item => item.id === next.id ? next : item));
      if (previous?.startsWith("blob:")) { URL.revokeObjectURL(previous); objectUrls.current.delete(previous); }
      setMessage(`${selected.title} photo added for this prototype.`);
    } catch {
      URL.revokeObjectURL(localUrl);
      objectUrls.current.delete(localUrl);
      setMessage("The prototype could not save this photo. Try again.");
    } finally { setPending(false); }
  }

  async function removePhoto() {
    if (!selected) return;
    setPending(true);
    setMessage("");
    try {
      await adapter.remove(selected.id);
      if (selected.src?.startsWith("blob:")) { URL.revokeObjectURL(selected.src); objectUrls.current.delete(selected.src); }
      setItems(current => current.map(item => item.id === selected.id ? { ...item, src: null, fileName: null, mimeType: null, byteSize: null } : item));
      setMessage(`${selected.title} photo removed from this prototype.`);
      setConfirmDelete(false);
      setViewing(null);
    } catch {
      setMessage("The prototype could not remove this photo. Try again.");
      setConfirmDelete(false);
    } finally { setPending(false); }
  }

  if (loadState === "loading") return <main className="c-photo-app"><div className="c-photo-loading" role="status"><LoaderCircle className="c-spin" size={18} /> Loading photo placements…</div></main>;
  if (loadState === "error") return <main className="c-photo-app"><section className="c-photo-load-error" role="alert"><CircleAlert size={22} /><h1>Photos could not be loaded</h1><p>The local prototype returned a synthetic error. No project data was contacted.</p><button className="c-button c-button--dark" onClick={() => void load()} type="button">Try again</button></section></main>;

  return (
    <main className="c-photo-app">
      <div className="c-photo-prototype-banner"><span>Local prototype</span><span>Sample images and edits stay in memory for this session.</span></div>
      <header className="c-photo-topbar" inert={confirmDelete}>
        <a className="c-photo-back" href="#prototype" aria-label="Back to guide"><ArrowLeft size={16} /> Paint Guides</a>
        <div className="c-photo-breadcrumb"><span>Cedar QA Residence</span><ChevronRight size={14} /><strong>Photos</strong></div>
        <button className="c-user-chip" type="button" aria-label="Synthetic QA staff account"><span>QA</span><span>QA Staff</span><MoreHorizontal size={17} /></button>
      </header>

      <div className="c-photo-layout">
        <aside className="c-photo-sidebar" aria-label="Photo placements" inert={confirmDelete}>
          <div className="c-sidebar-heading"><span className="c-sidebar-kicker">Guide editor</span><h1>Photos</h1><p>Keep helpful room context close to each selection.</p></div>
          <div className="c-guide-mini"><span className="c-guide-mini-mark"><House size={16} /></span><span><strong>Cedar QA Residence</strong><small>Published sample guide</small></span><ChevronRight size={15} /></div>
          <div className="c-placement-label"><span>PHOTO PLACEMENTS</span><span>{withPhotos}/{items.length}</span></div>
          {(["Residence", "Main Floor"] as const).map(group => <section className="c-placement-group" key={group}>
            <h2>{group}</h2>
            {items.filter(item => item.group === group).map(item => <button className={`c-placement-row${selectedId === item.id ? " is-selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)} type="button" aria-current={selectedId === item.id ? "page" : undefined}>
              <span className={`c-placement-dot${item.src ? " has-photo" : ""}`} aria-hidden="true">{item.src ? <Check size={11} /> : null}</span><span className="c-placement-text"><strong>{item.title}</strong><small>{item.src ? "Photo added" : "No photo"}</small></span><ChevronRight size={15} />
            </button>)}
          </section>)}
          <div className="c-sidebar-note"><span className="c-note-mark">i</span><p>Photos are optional. Each image is tied to one residence, location, or paint selection.</p></div>
        </aside>

        <section className="c-photo-workspace" aria-label="Selected photo placement">
          <div className="c-photo-workspace-content" inert={confirmDelete}>
          <div className="c-workspace-heading"><div><p className="c-eyebrow">{selected?.group} · PHOTO PLACEMENT</p><h2>{selected?.title}</h2><p>{selected?.context}</p></div><span className="c-status-pill"><span /> {selected?.src ? (message.startsWith("The prototype could not save") ? "Previous photo saved" : "Photo added") : "Optional"}</span></div>
          <div className="c-photo-content-grid">
            <div className={`c-photo-preview${selected?.src ? " has-photo" : " is-empty"}`}>
              {selected?.src && !imageFailed ? <img key={selected.src} src={selected.src} alt={`${selected.title} photo preview`} onError={() => setImageFailed(true)} onLoad={() => setImageFailed(false)} /> : (
                <div className="c-photo-empty-state"><span><ImagePlus size={25} strokeWidth={1.35} /></span><strong>{imageFailed ? "Preview unavailable" : "No photo added yet"}</strong><p>{imageFailed ? "The image could not be opened. You can choose another file." : "Add a clear photo to help the homeowner recognize this space."}</p></div>
              )}
              {selected?.src && !imageFailed ? <button className="c-preview-open" onClick={event => { viewerOpener.current = event.currentTarget; setViewing(selected); }} type="button" aria-label={`View ${selected.title} photo full size`}><Maximize2 size={15} /></button> : null}
              {pending ? <div className="c-preview-saving" role="status"><LoaderCircle className="c-spin" size={17} /> Saving in this session…</div> : null}
            </div>
            <aside className="c-photo-details">
              <span className="c-details-eyebrow">PHOTO DETAILS</span>
              {selected?.src ? <dl><div><dt>File name</dt><dd>{selected.fileName}</dd></div><div><dt>Format</dt><dd>{selected.mimeType?.replace("image/", "").toUpperCase()}</dd></div><div><dt>File size</dt><dd>{bytesLabel(selected.byteSize)}</dd></div></dl> : <p className="c-details-empty">Details appear here after a photo is selected.</p>}
              <div className="c-photo-guidance"><span><Check size={14} /></span><p>JPG, PNG, or WebP<br /><strong>10 MiB maximum</strong></p></div>
              <input ref={fileInput} className="c-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label={`Choose photo for ${selected?.title ?? "placement"}`} onChange={event => void handleFileChange(event)} />
              <button className="c-button c-button--dark c-upload-button" disabled={pending} onClick={() => fileInput.current?.click()} type="button"><Upload size={15} />{selected?.src ? "Replace photo" : "Add a photo"}</button>
              {selected?.src ? <><button className="c-button c-button--quiet" disabled={pending} onClick={event => { viewerOpener.current = event.currentTarget; setViewing(selected); }} type="button">View full size</button><button className="c-button c-button--remove" disabled={pending} onClick={event => { deleteOpener.current = event.currentTarget; setConfirmDelete(true); }} type="button"><Trash2 size={14} />Remove photo</button></> : null}
              {message.startsWith("The prototype could not save") && selected?.src ? <p className="c-photo-recovery" role="status">The previous saved photo is still assigned. Choose the failed replacement again to retry.</p> : null}
            </aside>
          </div>

          <div className="c-photo-footer"><span><span className="c-footer-dot" /> Local-only · no uploads or persistent storage</span><span>{selected?.src ? "One photo assigned to this placement" : "No photo assigned"}</span></div>
          {message ? <p className={`c-photo-message${message.startsWith("The prototype could") || message.startsWith("Choose") || message.startsWith("Images") ? " is-error" : ""}`} role={message.startsWith("The prototype could") || message.startsWith("Choose") || message.startsWith("Images") ? "alert" : "status"}>{message}</p> : null}
          </div>
          {confirmDelete && selected?.src ? <div className="c-confirm-scrim"><section className="c-confirm-card" role="alertdialog" aria-modal="true" aria-labelledby="c-delete-title" aria-describedby="c-delete-copy"><span className="c-confirm-icon"><Trash2 size={18} /></span><h3 id="c-delete-title">Remove this photo?</h3><p id="c-delete-copy">This only clears the sample placement in the current browser session.</p><div><button ref={deleteKeepButton} className="c-button c-button--quiet" onClick={() => setConfirmDelete(false)} type="button">Keep photo</button><button ref={deleteConfirmButton} className="c-button c-button--danger" disabled={pending} onClick={() => void removePhoto()} type="button">{pending ? "Removing…" : "Remove photo"}</button></div></section></div> : null}
          {viewing?.src ? <div className="c-viewer-scrim" onClick={() => setViewing(null)}><section className="c-viewer" role="dialog" aria-modal="true" aria-labelledby="c-viewer-title" onClick={event => event.stopPropagation()}><header><span id="c-viewer-title">{viewing.title}</span><button ref={viewerCloseButton} onClick={() => setViewing(null)} type="button" aria-label="Close photo viewer"><X size={18} /></button></header><img src={viewing.src} alt={`${viewing.title} full-size photo`} /></section></div> : null}
        </section>
      </div>
      <span className="c-photo-prototype-watermark">C2 CONCEPT · SYNTHETIC DATA</span>
    </main>
  );
}
