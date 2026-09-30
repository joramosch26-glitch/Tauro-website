import { Link, useParams } from "react-router-dom";
import { FormEvent, useEffect, useState } from "react";
import { GuideStatusBadge } from "../components/GuideStatusBadge";
import { StaffPageShell } from "../components/StaffPageShell";
import { getPaintGuide, updatePaintGuide } from "../data/guides";
import type { PaintGuide, PaintGuideStatus } from "../data/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function GuideOverview() {
  const { guideId = "" } = useParams();
  const [guide, setGuide] = useState<PaintGuide | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "not_found" | "error">("loading");
  const [residenceName, setResidenceName] = useState("");
  const [primaryScopeNote, setPrimaryScopeNote] = useState("");
  const [status, setStatus] = useState<PaintGuideStatus>("draft");
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    setState("loading");

    void getPaintGuide(guideId)
      .then((nextGuide) => {
        if (!active) return;
        if (!nextGuide) {
          setState("not_found");
          return;
        }

        setGuide(nextGuide);
        setResidenceName(nextGuide.residence_name);
        setPrimaryScopeNote(nextGuide.primary_scope_note ?? "");
        setStatus(nextGuide.status);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
      });

    return () => {
      active = false;
    };
  }, [guideId]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedResidenceName = residenceName.trim();

    if (!trimmedResidenceName) {
      setValidationError("Residence Name is required.");
      return;
    }

    setValidationError("");
    setSaveError("");
    setSaveNotice("");
    setIsSaving(true);

    try {
      const updatedGuide = await updatePaintGuide(guideId, {
        residenceName: trimmedResidenceName,
        primaryScopeNote: primaryScopeNote.trim(),
        status,
      });
      setGuide(updatedGuide);
      setResidenceName(updatedGuide.residence_name);
      setPrimaryScopeNote(updatedGuide.primary_scope_note ?? "");
      setStatus(updatedGuide.status);
      setSaveNotice("Changes saved.");
    } catch {
      setSaveError("Could not save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  if (state === "loading") {
    return <StaffPageShell title="Paint Guide"><p className="py-12 text-sm uppercase tracking-[0.14em] text-[#20211f]/60">Loading Paint Guide…</p></StaffPageShell>;
  }

  if (state === "not_found" || state === "error") {
    return (
      <StaffPageShell title="Paint Guide">
        <section className="max-w-xl py-12">
          <h2 className="font-serif text-3xl">Paint Guide not found</h2>
          <p className="mt-3 leading-7 text-[#20211f]/65">Return to the dashboard to view available Paint Guides.</p>
          <Link className="mt-7 inline-flex border border-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]" to="/paint-guide">Back to Paint Guides</Link>
        </section>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell title={guide?.residence_name ?? "Paint Guide"}>
      <section className="grid gap-10 py-10 sm:py-14 lg:grid-cols-[minmax(0,1fr)_15rem]">
        <form className="border border-[#20211f]/15 bg-white p-6 sm:p-9" onSubmit={(event) => void handleSubmit(event)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-serif text-3xl">Overview</h2>
            <GuideStatusBadge status={status} />
          </div>
          <div className="mt-8">
            <label className="text-sm font-semibold" htmlFor="paint-guide-edit-residence-name">Residence Name</label>
            <input className="mt-2 w-full border border-[#20211f]/25 bg-white px-4 py-3" disabled={isSaving} id="paint-guide-edit-residence-name" onChange={(event) => setResidenceName(event.target.value)} required value={residenceName} />
          </div>
          <div className="mt-7">
            <label className="text-sm font-semibold" htmlFor="paint-guide-edit-primary-scope-note">Primary Scope Note <span className="font-normal text-[#20211f]/55">(optional)</span></label>
            <textarea className="mt-2 min-h-32 w-full border border-[#20211f]/25 bg-white px-4 py-3" disabled={isSaving} id="paint-guide-edit-primary-scope-note" onChange={(event) => setPrimaryScopeNote(event.target.value)} value={primaryScopeNote} />
          </div>
          <div className="mt-7">
            <label className="text-sm font-semibold" htmlFor="paint-guide-edit-status">Status</label>
            <select className="mt-2 w-full border border-[#20211f]/25 bg-white px-4 py-3" disabled={isSaving} id="paint-guide-edit-status" onChange={(event) => setStatus(event.target.value as PaintGuideStatus)} value={status}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </select>
            <p className="mt-2 text-sm text-[#20211f]/55">Published is an internal lifecycle state. Homeowner access is not available yet.</p>
          </div>
          {validationError ? <p className="mt-5 text-sm text-[#9c2f2f]" role="alert">{validationError}</p> : null}
          {saveError ? <p className="mt-5 text-sm text-[#9c2f2f]" role="alert">{saveError}</p> : null}
          {saveNotice ? <p aria-live="polite" className="mt-5 text-sm text-[#40513c]" role="status">{saveNotice}</p> : null}
          <button className="mt-8 bg-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f5f1e8] transition-colors hover:bg-[#9b6b36] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving} type="submit">{isSaving ? "Saving…" : "Save Changes"}</button>
        </form>
        <aside className="border-t border-[#20211f]/15 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">Guide details</p>
          <p className="mt-4 text-sm leading-7 text-[#20211f]/65">Last updated {guide ? formatDate(guide.updated_at) : ""}</p>
          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.18em] text-[#20211f]/45">Coming later</p>
          <ul className="mt-3 space-y-2 text-sm text-[#20211f]/55"><li>Colors</li><li>Locations</li><li>QR</li><li>Preview</li></ul>
        </aside>
      </section>
    </StaffPageShell>
  );
}
