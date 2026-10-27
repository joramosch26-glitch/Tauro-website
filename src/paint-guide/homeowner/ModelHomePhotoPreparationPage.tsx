import { useMemo, useState } from "react";
import type { FormEvent } from "react";
import { createStaffPhotoClient, parseStaffPhotoListResponse, type PhotoPlacementKind, type StaffPhotoPlacement } from "../staff/photo-client";
import { requestStaffAccess } from "../staff/access-client";

const ACTOR_ID = "e8fa431f-ea5c-46fb-b92c-6d5d213531bc";
const GUIDE_ID = "2a35d308-45a7-4b08-8d8d-83ddb16f0e29";
const SYNTHETIC_EMAIL = "paintguide.qa@example.invalid";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const LOCATIONS = [
  { id: "24ddd133-005e-4a35-ae45-ac140b53da91", name: "Great Room" },
  { id: "6bb2f847-be5c-46d4-97b0-000149c30b38", name: "Kitchen" },
  { id: "fe6d4359-49ca-4963-bd46-53bb58c374dc", name: "Primary Bedroom" },
  { id: "a874da26-6ff9-4c00-9028-bbe620897462", name: "Theater" },
  { id: "55b1fc09-75c0-4177-a91f-94845b833f06", name: "Garage" },
  { id: "de5a1ed0-8612-441c-bfe7-a3c4f9b68854", name: "Front Entry" },
] as const;
const RECORDS = [
  { id: "78879584-5b65-4919-a4d9-e75028f533a3", name: "Walls - White Dove, Satin", color: "#e8e2d2" },
  { id: "2f45f83d-78ab-4586-a98c-8b6cbfdeb1f8", name: "Ceilings - White Dove, Flat", color: "#f2efe6" },
  { id: "19a4a672-565d-4edc-8d92-5e065ec8b1f9", name: "Trim - White Dove, Semi-gloss", color: "#e8e2d2" },
  { id: "9815b25f-0f77-4478-9394-00a8fbb9cb2a", name: "Interior Doors - White Dove, Semi-gloss", color: "#e8e2d2" },
  { id: "dab05ce9-292c-42e3-8364-7b903df7e1f4", name: "Theater Walls - Kendall Charcoal, Matte", color: "#4a4a45" },
  { id: "713099a8-c0e3-475c-a815-6a76ad8374bc", name: "Garage Walls - Pure White, Satin", color: "#f5f5ef" },
  { id: "5154f6a0-8f4b-4b0c-b0b2-196dc0712de1", name: "Front Door - Iron Ore, Matte", color: "#3d3e3e" },
] as const;
const ASSIGNMENTS = [
  [RECORDS[0], LOCATIONS[0]], [RECORDS[0], LOCATIONS[1]], [RECORDS[0], LOCATIONS[2]],
  [RECORDS[1], LOCATIONS[0]], [RECORDS[1], LOCATIONS[1]], [RECORDS[1], LOCATIONS[2]],
  ...LOCATIONS.map((location) => [RECORDS[2], location] as const),
  ...LOCATIONS.slice(0, 5).map((location) => [RECORDS[3], location] as const),
  [RECORDS[4], LOCATIONS[3]], [RECORDS[5], LOCATIONS[4]], [RECORDS[6], LOCATIONS[5]],
] as const;

type Target = { key: string; title: string; placement: PhotoPlacementKind; locationId?: string; recordId?: string; labelRecord?: typeof RECORDS[number] };
const TARGETS: Target[] = [
  { key: "cover", title: "Residence cover - facade", placement: "residence_cover" },
  ...LOCATIONS.map((location) => ({ key: `location:${location.id}`, title: `${location.name} - overview`, placement: "location" as const, locationId: location.id })),
  ...ASSIGNMENTS.map(([record, location], index) => ({ key: `context:${index}`, title: `${location.name} - ${record.name} painted-surface detail`, placement: "record_context" as const, locationId: location.id, recordId: record.id })),
  ...RECORDS.map((record) => ({ key: `label:${record.id}`, title: `${record.name} - sample label`, placement: "record_formula_label" as const, recordId: record.id, labelRecord: record })),
];

async function makeDemoLabel(record: typeof RECORDS[number]) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200; canvas.height = 800;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the demo label.");
  context.fillStyle = "#f5f1e8"; context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#20211f"; context.fillRect(45, 45, 1110, 710);
  context.fillStyle = "#fffdf8"; context.fillRect(70, 70, 1060, 660);
  context.fillStyle = "#9b6b36"; context.fillRect(70, 70, 1060, 175);
  context.fillStyle = "#fffdf8"; context.font = "bold 56px sans-serif";
  context.fillText("DEMO - NOT A MIXING FORMULA", 105, 145);
  context.fillStyle = "#20211f"; context.font = "bold 46px sans-serif";
  context.fillText("ILLUSTRATIVE SAMPLE RECORD", 110, 330);
  context.font = "36px sans-serif"; context.fillText(record.name, 110, 405);
  context.fillText("No manufacturer recipe or tint formula is represented.", 110, 475);
  context.fillText("Real projects require a clear photo of the actual can sticker.", 110, 535);
  context.fillStyle = record.color; context.fillRect(110, 585, 170, 80);
  context.strokeStyle = "#20211f"; context.strokeRect(110, 585, 170, 80);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode the demo label.")), "image/png"));
  return new File([blob], "demo-not-a-mixing-formula.png", { type: "image/png" });
}

export function ModelHomePhotoPreparationPage() {
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [message, setMessage] = useState("Synthetic model-home upload. All uploads are pinned to one fictional guide.");
  const [photos, setPhotos] = useState<StaffPhotoPlacement[]>([]);
  const [privateLink, setPrivateLink] = useState<string | null>(null);
  const client = useMemo(() => accessToken ? createStaffPhotoClient({ getAccessToken: async () => accessToken, parseList: parseStaffPhotoListResponse }) : null, [accessToken]);

  const signIn = async (event: FormEvent) => {
    event.preventDefault();
    if (!SUPABASE_URL || !PUBLISHABLE_KEY || !password) return;
    setBusyKey("auth");
    try {
      const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
        method: "POST", headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: SYNTHETIC_EMAIL, password }), cache: "no-store", referrerPolicy: "no-referrer", redirect: "error",
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("auth");
      const result = payload as Record<string, unknown>;
      const user = result.user as Record<string, unknown> | null;
      if (typeof result.access_token !== "string" || !user || user.id !== ACTOR_ID) throw new Error("auth");
      setAccessToken(result.access_token);
      setMessage("Authenticated synthetic owner. Server authorization remains restricted to this model guide and the diagnostic guide.");
    } catch { setMessage("Synthetic sign-in failed; no password was retained."); }
    finally { setPassword(""); setBusyKey(null); }
  };

  const refresh = async () => {
    if (!client) return;
    setBusyKey("refresh");
    try { const rows = await client.list(GUIDE_ID); setPhotos(rows); setMessage(`Loaded ${rows.length} model-home photo placement(s).`); }
    catch { setMessage("Could not list model-home photos; server scope checks remain in force."); }
    finally { setBusyKey(null); }
  };

  const upload = async (target: Target, selected?: File) => {
    if (!client) return;
    setBusyKey(target.key);
    try {
      const image = target.labelRecord ? await makeDemoLabel(target.labelRecord) : selected;
      if (!image) throw new Error("Select an image file for this photo placement.");
      const result = await client.upload({ guideId: GUIDE_ID, placement: target.placement,
        ...(target.locationId ? { locationId: target.locationId } : {}),
        ...(target.recordId ? { recordId: target.recordId } : {}), attemptId: crypto.randomUUID(), image });
      const rows = await client.list(GUIDE_ID); setPhotos(rows);
      setMessage(`${target.title} saved as current version ${result.versionId}.`);
    } catch (error) {
      const status = Number((error as { status?: number }).status ?? 0);
      setMessage(status === 403 ? "The server rejected this synthetic guide scope." : status === 413 ? "The image exceeds the safe photo size limit." : "Photo upload failed; existing current photo was preserved.");
    } finally { setBusyKey(null); }
  };

  const signOut = async () => {
    const token = accessToken; setAccessToken(null); setPhotos([]);
    setPrivateLink(null);
    if (token && SUPABASE_URL && PUBLISHABLE_KEY) try {
      await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/logout`, { method: "POST", headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` }, cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" });
    } catch { /* In-memory token is discarded regardless. */ }
    setMessage("Signed out; in-memory access token discarded.");
  };

  const issueHomeownerLink = async () => {
    if (!accessToken) return;
    setBusyKey("homeowner-link");
    try {
      const current = await requestStaffAccess("status", accessToken, { guideId: GUIDE_ID });
      if (current.guideStatus !== "published") throw new Error("draft");
      if (current.accessState === "revoked") throw new Error("revoked");
      const operation = current.accessState === "absent" ? "issue" : "recover";
      const result = await requestStaffAccess(operation, accessToken, { guideId: GUIDE_ID });
      const link = result.privateUrl ? new URL(result.privateUrl) : null;
      if (!link || link.origin !== window.location.origin || link.pathname !== "/paint-guide/p"
        || !/^#tpgh1\.[1-9][0-9]*\.[A-Za-z0-9_-]{43}$/.test(link.hash)) throw new Error("link");
      setPrivateLink(link.href);
      setMessage("Private model-home link issued. The URL contains its bearer token; it stays in this tab and is not logged.");
    } catch (error) {
      setMessage((error as Error).message === "draft"
        ? "The model guide remains draft until its photo checklist is complete and it is explicitly published."
        : "Could not issue a private model-home link; server scope checks remain in force.");
    } finally { setBusyKey(null); }
  };

  return <main className="min-h-screen bg-[#f5f1e8] px-5 py-10 text-[#20211f]">
    <section className="mx-auto max-w-5xl border border-[#20211f]/15 bg-white p-6 sm:p-10" data-model-home-preview="true">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">Protected QA � fictional project</p>
      <h1 className="mt-4 font-serif text-4xl">Ramos Residence - Model Home</h1>
      <p className="mt-3 text-sm text-[#20211f]/70">Only the hard-pinned model guide and synthetic owner are accepted. Each context photo belongs to one assigned room and paint record. Generated sample labels explicitly say "DEMO - NOT A MIXING FORMULA"; real projects require actual can-sticker photos.</p>
      <p className="mt-4 rounded border border-[#20211f]/15 bg-[#f5f1e8] p-3 text-sm" role="status">{message}</p>
      {!accessToken ? <form className="mt-6 grid max-w-xl gap-3" onSubmit={(event) => void signIn(event)}>
        <label className="grid gap-1 text-sm font-medium">Synthetic account<input className="border p-3" readOnly value={SYNTHETIC_EMAIL} /></label>
        <label className="grid gap-1 text-sm font-medium">Test password<input className="border p-3" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="w-fit border bg-[#20211f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busyKey !== null || !password}>Sign in to synthetic QA</button>
      </form> : <div className="mt-6 grid gap-5">
        <div className="flex flex-wrap gap-3"><button className="border px-4 py-3 text-sm font-semibold" disabled={busyKey !== null} onClick={() => void refresh()}>Refresh all model photos</button><button className="border px-4 py-3 text-sm font-semibold" disabled={busyKey !== null} onClick={() => void issueHomeownerLink()}>Issue private model-home link</button><button className="border px-4 py-3 text-sm font-semibold" disabled={busyKey !== null} onClick={() => void signOut()}>Sign out</button></div>
        {privateLink ? <button className="w-fit border border-[#9b6b36] bg-[#9b6b36] px-5 py-3 text-sm font-semibold text-white" onClick={() => { const link = privateLink; setPrivateLink(null); window.location.assign(link); }}>Open private homeowner guide</button> : null}
        <p className="text-sm font-semibold">Photo checklist ({TARGETS.length} slots): one cover, six room overviews, twenty assignment-specific painted-surface details, and seven clearly synthetic sample labels.</p>
        <div className="grid gap-3">{TARGETS.map((target) => {
          const current = photos.find((photo) => photo.placement === target.placement && photo.locationId === (target.locationId ?? null) && photo.recordId === (target.recordId ?? null))?.photo;
          return <article className="grid gap-2 border border-[#20211f]/15 p-4 sm:grid-cols-[1fr_auto] sm:items-center" key={target.key}>
            <div><h2 className="font-medium">{target.title}</h2><p className="text-xs text-[#20211f]/60">Current version: {current?.versionId ?? "not uploaded"}</p></div>
            {target.labelRecord ? <button className="border px-3 py-2 text-sm font-semibold disabled:opacity-50" disabled={busyKey !== null} onClick={() => void upload(target)}>Create demo-marked sample label</button> : <label className="grid gap-1 text-sm">{current ? "Replace photo" : "Choose photo"}<input className="max-w-xs text-xs" type="file" accept="image/jpeg,image/png,image/webp" disabled={busyKey !== null} onChange={(event) => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (file) void upload(target, file); }} /></label>}
          </article>;
        })}</div>
      </div>}
    </section>
  </main>;
}

