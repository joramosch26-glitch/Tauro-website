import { Link, useParams } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "../../components/ui/alert-dialog";
import { useAuth } from "../auth/useAuth";
import { GuideEditorNav } from "../components/GuideEditorNav";
import { StaffPageShell } from "../components/StaffPageShell";
import { accessAvailabilityMessage, accessControls, copyStaffPrivateUrl, requestStaffAccess, StaffAccessClientError, type StaffAccessOperation, type StaffAccessStatus } from "../staff/access-client";
import { createQrPng, createQrPreview, createQrSvg, downloadQr, qrDownloadStillCurrent, qrValueStillCurrent, QR_PNG_FILENAME, QR_SVG_FILENAME } from "../staff/qr-code";

type LoadState = "loading" | "ready" | "not_found" | "error";
type Confirmation = "rotate" | "revoke" | null;
const actionClass = "border border-[#20211f] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[#9b6b36] hover:text-[#9b6b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6b36] disabled:cursor-not-allowed disabled:opacity-55";
const dialogActionClass = "border border-[#20211f] bg-[#20211f] text-[#f5f1e8] transition-colors hover:border-[#9b6b36] hover:bg-[#9b6b36] hover:text-[#fffdf8] focus-visible:border-[#9b6b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6b36] focus-visible:ring-2 focus-visible:ring-[#9b6b36] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:border-[#7d572c] active:bg-[#7d572c] active:text-[#fffdf8] disabled:cursor-not-allowed disabled:border-[#8f9088] disabled:bg-[#e4e0d7] disabled:text-[#5f625d] disabled:opacity-100";
const revokeDialogActionClass = "border border-[#9c2f2f] bg-[#9c2f2f] text-white transition-colors hover:border-[#7d2525] hover:bg-[#7d2525] hover:text-white focus-visible:border-[#7d2525] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7d2525] focus-visible:ring-2 focus-visible:ring-[#7d2525] focus-visible:ring-offset-2 focus-visible:ring-offset-white active:border-[#681e1e] active:bg-[#681e1e] active:text-white disabled:cursor-not-allowed disabled:border-[#a88787] disabled:bg-[#eadede] disabled:text-[#684a4a] disabled:opacity-100";
function accessLabel(status: StaffAccessStatus) { return status.accessState === "active" ? "Active" : status.accessState === "revoked" ? "Revoked" : "Not issued"; }
function errorMessage(status: StaffAccessClientError["status"]) { if (status === 401) return "Your staff session has expired. Sign in again to continue."; if (status === 403) return "You are not authorized to manage this access."; if (status === 404) return "This Paint Guide or its access record is unavailable."; if (status === 409) return "Access changed elsewhere. The latest status has been loaded."; return "Access could not be updated. Please try again."; }

export function GuideAccess() {
  const { guideId = "" } = useParams();
  const { profile, session } = useAuth();
  const [state, setState] = useState<LoadState>("loading");
  const [status, setStatus] = useState<StaffAccessStatus | null>(null);
  const [privateUrl, setPrivateUrl] = useState<string | null>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(null);
  const [qrError, setQrError] = useState("");
  const privateUrlRef = useRef<string | null>(null);
  const qrGenerationRef = useRef(0);
  const [pending, setPending] = useState<StaffAccessOperation | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState<Confirmation>(null);
  const setRevealedPrivateUrl = useCallback((value: string | null) => {
    privateUrlRef.current = value;
    qrGenerationRef.current += 1;
    setQrPreview(null);
    setQrError("");
    setPrivateUrl(value);
  }, []);
  const invalidateQrDownloads = useCallback(() => { qrGenerationRef.current += 1; }, []);
  const loadStatus = useCallback(async (keepMessage = false) => {
    setState("loading");
    setRevealedPrivateUrl(null);
    if (!keepMessage) {
      setMessage("");
      setError("");
    }
    try { const response = await requestStaffAccess("status", session?.access_token, { guideId }); setStatus(response); setState("ready"); }
    catch (reason) { const clientError = reason instanceof StaffAccessClientError ? reason : new StaffAccessClientError("network"); setState(clientError.status === 404 ? "not_found" : "error"); setError(errorMessage(clientError.status)); }
  }, [guideId, session?.access_token, setRevealedPrivateUrl]);
  useEffect(() => { let active = true; setRevealedPrivateUrl(null); setMessage(""); setError(""); setState("loading"); void requestStaffAccess("status", session?.access_token, { guideId }).then((response) => { if (active) { setStatus(response); setState("ready"); } }).catch((reason) => { if (!active) return; const clientError = reason instanceof StaffAccessClientError ? reason : new StaffAccessClientError("network"); setState(clientError.status === 404 ? "not_found" : "error"); setError(errorMessage(clientError.status)); }); return () => { active = false; }; }, [guideId, session?.access_token, setRevealedPrivateUrl]);
  useEffect(() => () => { privateUrlRef.current = null; qrGenerationRef.current += 1; }, []);
  useEffect(() => {
    let active = true;
    setQrPreview(null);
    setQrError("");
    if (!privateUrl) return () => { active = false; };
    void createQrPreview(privateUrl).then((preview) => { if (active && qrValueStillCurrent(privateUrl, privateUrlRef.current)) setQrPreview(preview); }).catch(() => { if (active && qrValueStillCurrent(privateUrl, privateUrlRef.current)) setQrError("QR preview could not be generated. The private link remains available to copy."); });
    return () => { active = false; };
  }, [privateUrl]);
  async function perform(operation: Exclude<StaffAccessOperation, "status">) {
    if (!status || pending) return;
    setConfirmation(null); invalidateQrDownloads(); setPending(operation); setError(""); setMessage("");
    try { const response = await requestStaffAccess(operation, session?.access_token, { guideId, expectedTokenGeneration: status.tokenGeneration ?? undefined, expectedSessionEpoch: status.sessionEpoch ?? undefined }); setStatus(response); setRevealedPrivateUrl(response.privateUrl ?? null); setMessage(operation === "issue" ? "Homeowner access was created. Copy the private link now." : operation === "recover" ? "The current private link has been recovered." : operation === "rotate" ? "A new private link was created. The previous link and homeowner sessions no longer work." : "Homeowner access was revoked. An owner can restore it later by rotating access."); }
    catch (reason) { const clientError = reason instanceof StaffAccessClientError ? reason : new StaffAccessClientError("network"); if (clientError.status === 409) { setRevealedPrivateUrl(null); setError(errorMessage(409)); await loadStatus(true); } else setError(errorMessage(clientError.status)); }
    finally { setPending(null); }
  }
  async function copyPrivateUrl() { if (!privateUrl) return; setError(""); if (await copyStaffPrivateUrl(privateUrl)) setMessage("Private link copied."); else setError("The private link could not be copied. Select it and copy it manually."); }
  async function downloadQrCode(format: "png" | "svg") {
    if (!privateUrl) return;
    const requestedUrl = privateUrl;
    const requestedGeneration = qrGenerationRef.current;
    setQrError("");
    try {
      const blob = format === "png" ? await createQrPng(requestedUrl) : await createQrSvg(requestedUrl);
      if (!qrDownloadStillCurrent(requestedUrl, privateUrlRef.current, requestedGeneration, qrGenerationRef.current)) return;
      downloadQr(blob, format === "png" ? QR_PNG_FILENAME : QR_SVG_FILENAME);
    }
    catch { setQrError(`QR ${format.toUpperCase()} could not be generated. Try again or use Copy Link.`); }
  }
  if (state === "loading") return <StaffPageShell title="Access & QR"><p aria-live="polite" className="py-12 text-sm uppercase tracking-[0.14em] text-[#20211f]/60">Loading access status…</p></StaffPageShell>;
  if (state === "not_found" || state === "error" || !status || !profile) return <StaffPageShell title="Access & QR"><section className="max-w-xl py-12"><h2 className="font-serif text-3xl">{state === "not_found" ? "Paint Guide unavailable" : "Could not load access"}</h2><p className="mt-3 leading-7 text-[#20211f]/65">{error || "Return to the dashboard to view available Paint Guides."}</p><div className="mt-7 flex flex-wrap gap-3"><Link className={actionClass} to="/paint-guide">Back to Paint Guides</Link><button className={actionClass} onClick={() => void loadStatus()} type="button">Try Again</button></div></section></StaffPageShell>;
  const controls = accessControls(profile.role, status, Boolean(privateUrl)); const working = pending !== null;
  const localQr = privateUrl?.startsWith("http://127.0.0.1:") || privateUrl?.startsWith("http://localhost:");
  return <StaffPageShell title="Access & QR"><GuideEditorNav active="access" /><section className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_15rem]"><div className="border border-[#20211f]/15 bg-white p-6 sm:p-9"><div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">Homeowner Access</p><h2 className="mt-3 font-serif text-3xl">Share with care</h2></div><span className="border border-[#20211f]/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em]">{accessLabel(status)}</span></div><dl className="mt-9 grid gap-6 border-y border-[#20211f]/15 py-6 sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-[0.15em] text-[#20211f]/50">Access status</dt><dd className="mt-2 text-lg font-medium">{accessLabel(status)}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-[0.15em] text-[#20211f]/50">Homeowner availability</dt><dd className="mt-2 text-lg font-medium">{status.homeownerExchangeAvailable ? "Available" : "Unavailable"}</dd><p className="mt-1 text-sm leading-6 text-[#20211f]/60">{accessAvailabilityMessage(status)}</p></div></dl>{privateUrl ? <section className="mt-8 border border-[#53634f]/25 bg-[#edf2ea] p-5" aria-label="Revealed private link"><p className="text-xs font-semibold uppercase tracking-[0.15em] text-[#40513c]">Private link revealed</p><p className="mt-3 break-all font-mono text-xs leading-6 text-[#20211f]" data-private-link="revealed">{privateUrl}</p><button className={`mt-4 ${actionClass}`} disabled={working} onClick={() => void copyPrivateUrl()} type="button">Copy Link</button></section> : null}{error ? <p className="mt-6 text-sm text-[#9c2f2f]" role="alert">{error}</p> : null}{message ? <p aria-live="polite" className="mt-6 text-sm text-[#40513c]" role="status">{message}</p> : null}<section className="mt-9"><h3 className="font-serif text-2xl">Access actions</h3><div className="mt-5 flex flex-wrap gap-3">{controls.issue ? <button className={actionClass} disabled={working} onClick={() => void perform("issue")} type="button">{pending === "issue" ? "Issuing…" : "Issue Access"}</button> : null}{controls.recover ? <button className={actionClass} disabled={working} onClick={() => void perform("recover")} type="button">{pending === "recover" ? "Recovering…" : "Recover Access"}</button> : null}{controls.rotate ? <button className={actionClass} disabled={working} onClick={() => setConfirmation("rotate")} type="button">Rotate Access</button> : null}{controls.revoke ? <button className={`${actionClass} border-[#9c2f2f] text-[#9c2f2f] hover:border-[#9c2f2f] hover:text-[#9c2f2f]`} disabled={working} onClick={() => setConfirmation("revoke")} type="button">Revoke Access</button> : null}</div>{controls.recover ? <p className="mt-4 text-sm leading-6 text-[#20211f]/60">Recovering access does not change the homeowner link.</p> : null}</section></div><aside className="border-t border-[#20211f]/15 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">QR Code</p>{privateUrl ? <div className="mt-4 space-y-4"><div className="mx-auto max-w-[15rem] bg-white p-3">{qrPreview ? <img alt="QR code for the revealed private Paint Guide link" className="block h-auto w-full" src={qrPreview} /> : <p className="py-16 text-center text-xs uppercase tracking-[0.14em] text-[#20211f]/50">Preparing QR code…</p>}</div><p className="text-sm leading-7 text-[#20211f]/65">Scan this code to open the private Paint Guide.</p>{localQr ? <p className="border-l-2 border-[#9b6b36] pl-3 text-sm leading-6 text-[#20211f]/65">Local development QR codes use a loopback address and will not open on a separate phone.</p> : null}<div className="flex flex-col gap-3 sm:flex-row lg:flex-col"><button className={actionClass} disabled={working || !qrPreview} onClick={() => void downloadQrCode("png")} type="button">Download PNG</button><button className={actionClass} disabled={working || !qrPreview} onClick={() => void downloadQrCode("svg")} type="button">Download SVG</button></div>{qrError ? <p className="text-sm text-[#9c2f2f]" role="alert">{qrError}</p> : null}</div> : <div className="mt-4"><p className="text-sm leading-7 text-[#20211f]/65">Recover or issue access to reveal a private link and generate its QR code.</p><div className="mt-5 flex flex-col gap-3"><button className={actionClass} disabled type="button">Download PNG</button><button className={actionClass} disabled type="button">Download SVG</button></div></div>}</aside></section><AlertDialog open={confirmation !== null} onOpenChange={(open) => { if (!open) setConfirmation(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirmation === "rotate" ? "Rotate homeowner access?" : "Revoke homeowner access?"}</AlertDialogTitle><AlertDialogDescription>{confirmation === "rotate" ? "The current homeowner link and existing homeowner sessions will stop working. A new private link will be generated." : "The homeowner link and existing homeowner sessions will stop working. An owner can restore it later by rotating access."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={working}>Cancel</AlertDialogCancel><AlertDialogAction className={confirmation === "revoke" ? revokeDialogActionClass : dialogActionClass} disabled={working} onClick={() => { if (confirmation) void perform(confirmation); }}>{confirmation === "rotate" ? "Rotate Access" : "Revoke Access"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></StaffPageShell>;
}
