import { useEffect, useMemo, useRef, useState } from "react";
import { parseStaffPhotoListResponse, createStaffPhotoClient, type StaffPhotoPlacement } from "../staff/photo-client";
import { requestStaffAccess, StaffAccessClientError, type StaffAccessStatus } from "../staff/access-client";

const ACTOR_ID = "e8fa431f-ea5c-46fb-b92c-6d5d213531bc";
const GUIDE_ID = "b28d3dd5-eb34-46a2-99de-7af143de80db";
const FORMULA_RECORD_ID = "15ed21e5-c7e4-4bd0-a822-d7ec889b37f6";
const SYNTHETIC_EMAIL = "paintguide.qa@example.invalid";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

type PhotoClient = ReturnType<typeof createStaffPhotoClient>;

async function makeSyntheticLabel() {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 700;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Could not prepare the synthetic image.");
  context.fillStyle = "#f5f1e8";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "#20211f";
  context.fillRect(55, 55, 890, 590);
  context.fillStyle = "#fffdf8";
  context.fillRect(82, 82, 836, 536);
  context.fillStyle = "#9b6b36";
  context.fillRect(82, 82, 836, 118);
  context.fillStyle = "#fffdf8";
  context.font = "bold 46px sans-serif";
  context.fillText("SYNTHETIC QA PAINT LABEL", 116, 155);
  context.fillStyle = "#20211f";
  context.font = "bold 38px sans-serif";
  context.fillText("QA TEST FORMULA", 116, 285);
  context.font = "30px sans-serif";
  context.fillText("Color: Synthetic Label Color", 116, 360);
  context.fillText("Code: QA-001  |  Sheen: Eggshell", 116, 418);
  context.fillStyle = "#6a806b";
  context.fillRect(116, 470, 185, 78);
  context.fillStyle = "#fffdf8";
  context.font = "bold 24px sans-serif";
  context.fillText("TEST ONLY", 144, 519);
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error("Could not encode the synthetic image.")), "image/png"));
  return new File([blob], "synthetic-formula-label.png", { type: "image/png" });
}

function messageForStatus(status: number) {
  if (status === 401) return "Sign in again to continue.";
  if (status === 403) return "The synthetic actor or guide was rejected by the server scope check.";
  if (status === 404) return "The synthetic guide or photo is unavailable.";
  return "The synthetic QA request did not complete.";
}

export function SyntheticPreviewTestPage() {
  const [password, setPassword] = useState("");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("Sign in as the approved synthetic QA actor to test only its guide.");
  const [photos, setPhotos] = useState<StaffPhotoPlacement[]>([]);
  const [privateLink, setPrivateLink] = useState<string | null>(null);
  const [homeownerAccessStatus, setHomeownerAccessStatus] = useState<StaffAccessStatus | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [lastUpload, setLastUpload] = useState<string | null>(null);
  const imageUrlRef = useRef<string | null>(null);
  const recoverControllerRef = useRef<AbortController | null>(null);

  const photoClient: PhotoClient | null = useMemo(() => accessToken ? createStaffPhotoClient({
    getAccessToken: async () => accessToken,
    parseList: parseStaffPhotoListResponse,
  }) : null, [accessToken]);

  useEffect(() => () => {
    recoverControllerRef.current?.abort();
    recoverControllerRef.current = null;
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
  }, []);

  const publishImage = (url: string | null) => {
    if (imageUrlRef.current) URL.revokeObjectURL(imageUrlRef.current);
    imageUrlRef.current = url;
    setImageUrl(url);
  };

  const signIn = async () => {
    if (!SUPABASE_URL || !PUBLISHABLE_KEY || !password) {
      setMessage("The synthetic sign-in configuration is unavailable.");
      return;
    }
    setBusy(true);
    setMessage("Signing in to the synthetic QA account.");
    try {
      const response = await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/token?grant_type=password`, {
        method: "POST",
        headers: { apikey: PUBLISHABLE_KEY, "Content-Type": "application/json" },
        body: JSON.stringify({ email: SYNTHETIC_EMAIL, password }),
        cache: "no-store",
        referrerPolicy: "no-referrer",
        redirect: "error",
      });
      const payload: unknown = await response.json();
      if (!response.ok || !payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("auth");
      const result = payload as Record<string, unknown>;
      const user = result.user as Record<string, unknown> | null;
      if (typeof result.access_token !== "string" || !user || user.id !== ACTOR_ID) throw new Error("auth");
      setAccessToken(result.access_token);
      setMessage("Synthetic actor authenticated. Requests remain limited by the server to its configured guide.");
    } catch {
      setMessage("Could not authenticate the synthetic QA account. Check the account in the protected project.");
    } finally {
      setPassword("");
      setBusy(false);
    }
  };

  const signOut = async () => {
    const token = accessToken;
    recoverControllerRef.current?.abort();
    recoverControllerRef.current = null;
    setAccessToken(null);
    setBusy(false);
    setPhotos([]);
    setPrivateLink(null);
    setLastUpload(null);
    publishImage(null);
    if (token && SUPABASE_URL && PUBLISHABLE_KEY) {
      try {
        await fetch(`${SUPABASE_URL.replace(/\/$/, "")}/auth/v1/logout`, {
          method: "POST",
          headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}` },
          cache: "no-store",
          referrerPolicy: "no-referrer",
          redirect: "error",
        });
      } catch { /* The in-memory token is discarded even if sign-out is unavailable. */ }
    }
    setMessage("Signed out. The access token was discarded from this page.");
  };

  const refreshPhotos = async () => {
    if (!photoClient) return;
    setBusy(true);
    try {
      const value = await photoClient.list(GUIDE_ID);
      setPhotos(value);
      setMessage(`Loaded ${value.length} photo placement(s) for the synthetic guide.`);
    } catch (error) {
      setMessage(messageForStatus(Number((error as { status?: number }).status ?? 0)));
    } finally { setBusy(false); }
  };

  const uploadFormulaLabel = async () => {
    if (!photoClient) return;
    setBusy(true);
    try {
      const image = await makeSyntheticLabel();
      const result = await photoClient.upload({
        guideId: GUIDE_ID,
        placement: "record_formula_label",
        recordId: FORMULA_RECORD_ID,
        attemptId: crypto.randomUUID(),
        image,
      });
      setLastUpload(result.versionId);
      const updated = await photoClient.list(GUIDE_ID);
      setPhotos(updated);
      setMessage("Synthetic formula-label photo uploaded; the current slot was reloaded for replacement verification.");
    } catch (error) {
      setMessage(messageForStatus(Number((error as { status?: number }).status ?? 0)));
    } finally { setBusy(false); }
  };

  const readFormulaLabel = async () => {
    if (!photoClient) return;
    const current = photos.find((photo) => photo.placement === "record_formula_label" && photo.recordId === FORMULA_RECORD_ID)?.photo;
    if (!current) {
      setMessage("No current synthetic formula-label photo is available to read.");
      return;
    }
    setBusy(true);
    try {
      const blob = await photoClient.image(current.versionId, "full");
      publishImage(URL.createObjectURL(blob));
      setMessage("Read the current private synthetic photo through the authenticated server route.");
    } catch (error) {
      setMessage(messageForStatus(Number((error as { status?: number }).status ?? 0)));
    } finally { setBusy(false); }
  };

  const checkHomeownerLinkStatus = async () => {
    if (!accessToken) return;
    setBusy(true);
    setPrivateLink(null);
    setHomeownerAccessStatus(null);
    try {
      const current = await requestStaffAccess("status", accessToken, { guideId: GUIDE_ID });
      setHomeownerAccessStatus(current);
      setMessage(current.guideStatus !== "published"
        ? "The synthetic guide is not published. Status was checked only; no homeowner access was issued."
        : current.accessState === "active"
          ? "An existing synthetic homeowner link is active. You can recover the same link without issuing or rotating access."
          : current.accessState === "revoked"
            ? "Synthetic homeowner access is revoked. Recovery is unavailable; no access was issued."
            : "No synthetic homeowner link was found. Recovery is disabled; no access was issued.");
    } catch {
      setHomeownerAccessStatus(null);
      setMessage("Could not read synthetic homeowner-link status. No access was issued or changed.");
    } finally { setBusy(false); }
  };

  const recoverExistingHomeownerLink = async () => {
    if (!accessToken || homeownerAccessStatus?.accessState !== "active"
      || homeownerAccessStatus.guideStatus !== "published" || !homeownerAccessStatus.homeownerExchangeAvailable) return;
    setBusy(true);
    setMessage("Recovering the existing synthetic homeowner link. No new link will be issued.");
    setPrivateLink(null);
    const controller = new AbortController();
    recoverControllerRef.current?.abort();
    recoverControllerRef.current = controller;
    try {
      const result = await requestStaffAccess("recover", accessToken, { guideId: GUIDE_ID, signal: controller.signal });
      if (controller.signal.aborted || recoverControllerRef.current !== controller) return;
      const link = result.privateUrl ? new URL(result.privateUrl) : null;
      if (!link || link.origin !== window.location.origin || link.pathname !== "/paint-guide/p"
        || !/^#tpgh1\.[1-9][0-9]*\.[A-Za-z0-9_-]{43}$/.test(link.hash)) throw new Error("link");
      setPrivateLink(link.href);
      setMessage("Existing synthetic homeowner link recovered in memory. No new link was issued or rotated.");
    } catch (error) {
      if (controller.signal.aborted || recoverControllerRef.current !== controller) return;
      const status = error instanceof StaffAccessClientError ? error.status : null;
      setMessage(status === 404
        ? "No recoverable synthetic homeowner link exists. No new link was issued."
        : status === 409
          ? "Synthetic homeowner access is no longer active. No link was recovered or issued."
          : status === "timeout"
            ? "Recovery timed out. No new link was issued; you can safely retry."
          : "Could not recover the existing synthetic link. No new link was issued.");
    } finally {
      if (recoverControllerRef.current === controller) {
        recoverControllerRef.current = null;
        setBusy(false);
      }
    }
  };

  return <main className="min-h-screen bg-[#f5f1e8] px-5 py-10 text-[#20211f]">
    <section className="mx-auto max-w-3xl border border-[#20211f]/15 bg-white p-6 sm:p-10" data-synthetic-preview-test="true">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">Protected QA � synthetic data only</p>
      <h1 className="mt-4 font-serif text-4xl">Paint Guide test access</h1>
      <p className="mt-3 text-sm text-[#20211f]/70">Only the approved synthetic actor and guide are used. Requests go through the existing server APIs; this screen does not query the browser database client.</p>
      <p className="mt-4 rounded border border-[#20211f]/15 bg-[#f5f1e8] p-3 text-sm" role="status">{message}</p>
      {!accessToken ? <form className="mt-6 grid gap-3" onSubmit={(event) => { event.preventDefault(); void signIn(); }}>
        <label className="grid gap-1 text-sm font-medium">Synthetic account<input className="border p-3" readOnly value={SYNTHETIC_EMAIL} /></label>
        <label className="grid gap-1 text-sm font-medium">Temporary test password<input className="border p-3" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <button className="w-fit border border-[#20211f] bg-[#20211f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50" disabled={busy || !password} type="submit">Sign in to synthetic QA</button>
      </form> : <div className="mt-6 grid gap-5">
        <div className="flex flex-wrap gap-3">
          <button className="border border-[#20211f] px-4 py-3 text-sm font-semibold" disabled={busy} onClick={() => void refreshPhotos()}>List synthetic photos</button>
          <button className="border border-[#20211f] px-4 py-3 text-sm font-semibold" disabled={busy} onClick={() => void uploadFormulaLabel()}>{lastUpload ? "Replace formula-label photo" : "Add formula-label photo"}</button>
          <button className="border border-[#20211f] px-4 py-3 text-sm font-semibold" disabled={busy || photos.length === 0} onClick={() => void readFormulaLabel()}>Read current private photo</button>
          <button className="border border-[#20211f] px-4 py-3 text-sm font-semibold" disabled={busy} onClick={() => void checkHomeownerLinkStatus()}>Check homeowner link status</button>
          <button className="border border-[#20211f] px-4 py-3 text-sm font-semibold" disabled={busy || homeownerAccessStatus?.accessState !== "active" || homeownerAccessStatus.guideStatus !== "published" || !homeownerAccessStatus.homeownerExchangeAvailable} onClick={() => void recoverExistingHomeownerLink()}>Recover existing homeowner link</button>
          <button className="border border-[#20211f] px-4 py-3 text-sm font-semibold" disabled={busy && recoverControllerRef.current === null} onClick={() => void signOut()}>Sign out</button>
        </div>
        {privateLink ? <button className="w-fit border border-[#9b6b36] bg-[#9b6b36] px-5 py-3 text-sm font-semibold text-white" onClick={() => { const link = privateLink; setPrivateLink(null); window.location.assign(link); }}>Open synthetic homeowner guide</button> : null}
        <ul className="grid gap-2 text-sm" aria-label="Synthetic photo placements">{photos.map((photo) => <li className="border border-[#20211f]/15 p-3" key={`${photo.placement}:${photo.locationId}:${photo.recordId}`}>{photo.placement} � {photo.recordId ?? "guide"} � current version {photo.photo?.versionId ?? "none"}</li>)}</ul>
        {imageUrl ? <img className="max-h-96 w-fit border border-[#20211f]/15" alt="Synthetic private formula-label photo" src={imageUrl} /> : null}
      </div>}
    </section>
  </main>;
}

