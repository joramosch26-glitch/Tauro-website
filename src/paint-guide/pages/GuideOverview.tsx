import { Link, useParams } from "react-router-dom";
import { FormEvent, useEffect, useState } from "react";
import { GuideStatusBadge } from "../components/GuideStatusBadge";
import { StaffPageShell } from "../components/StaffPageShell";
import { GuideEditorNav } from "../components/GuideEditorNav";
import { getPaintGuide, updatePaintGuide } from "../data/guides";
import type { PaintGuide, PaintGuideStatus } from "../data/types";
import { homeownerDesignErrorMessage } from "../data/homeowner-design-schema";

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
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [status, setStatus] = useState<PaintGuideStatus>("draft");
  const [validationError, setValidationError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveNotice, setSaveNotice] = useState("");
  const [loadError, setLoadError] = useState("");
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
        setCity(nextGuide.city ?? "");
        setStateName(nextGuide.state ?? "");
        setPropertyType(nextGuide.property_type ?? "");
        setStatus(nextGuide.status);
        setState("ready");
      })
      .catch((error) => {
        if (!active) return;
        setLoadError(homeownerDesignErrorMessage(error, "Could not load this Paint Guide. Please try again."));
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
        city,
        state: stateName,
        propertyType,
      });
      setGuide(updatedGuide);
      setResidenceName(updatedGuide.residence_name);
      setPrimaryScopeNote(updatedGuide.primary_scope_note ?? "");
      setCity(updatedGuide.city ?? "");
      setStateName(updatedGuide.state ?? "");
      setPropertyType(updatedGuide.property_type ?? "");
      setStatus(updatedGuide.status);
      setSaveNotice("Changes saved.");
    } catch (error) {
      setSaveError(homeownerDesignErrorMessage(error, "Could not save changes. Please try again."));
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
          <h2 className="font-serif text-3xl">{state === "error" ? "Could not load Paint Guide." : "Paint Guide not found"}</h2>
          <p className="mt-3 leading-7 text-[#20211f]/65" role="alert">{loadError || "Return to the dashboard to view available Paint Guides."}</p>
          <Link className="mt-7 inline-flex border border-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em]" to="/paint-guide">Back to Paint Guides</Link>
        </section>
      </StaffPageShell>
    );
  }

  return (
    <StaffPageShell title={guide?.residence_name ?? "Paint Guide"}>
      <GuideEditorNav active="overview" />
      {guide?.homeowner_design_fields_available === false ? <p className="mt-6 border border-[#9c2f2f]/25 bg-[#fff7f3] p-4 text-sm text-[#792c25]" role="status">Property metadata is unavailable until the reviewed database migration is applied. Saving is paused to avoid dropping those fields.</p> : null}
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
            <fieldset className="grid gap-4 border-t border-[#20211f]/10 pt-6 sm:grid-cols-3" disabled={isSaving}>
              <legend className="font-serif text-xl">Property details <span className="font-sans text-sm text-[#20211f]/55">(optional)</span></legend>
              <label className="text-sm font-semibold">City<input className="mt-2 w-full border border-[#20211f]/25 bg-white px-3 py-3 disabled:bg-[#20211f]/5" disabled={guide?.homeowner_design_fields_available === false} value={city} onChange={event => setCity(event.target.value)} /></label>
              <label className="text-sm font-semibold">State<input className="mt-2 w-full border border-[#20211f]/25 bg-white px-3 py-3 disabled:bg-[#20211f]/5" disabled={guide?.homeowner_design_fields_available === false} value={stateName} onChange={event => setStateName(event.target.value)} maxLength={80} /></label>
              <label className="text-sm font-semibold sm:col-span-3">Property type<input className="mt-2 w-full border border-[#20211f]/25 bg-white px-3 py-3 disabled:bg-[#20211f]/5" disabled={guide?.homeowner_design_fields_available === false} placeholder="Enter the configured property type" value={propertyType} onChange={event => setPropertyType(event.target.value)} /></label>
            </fieldset>
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
            <p className="mt-2 text-sm text-[#20211f]/55">Publish the guide before managing homeowner access on the Access &amp; QR page.</p>
          </div>
          {validationError ? <p className="mt-5 text-sm text-[#9c2f2f]" role="alert">{validationError}</p> : null}
          {saveError ? <p className="mt-5 text-sm text-[#9c2f2f]" role="alert">{saveError}</p> : null}
          {saveNotice ? <p aria-live="polite" className="mt-5 text-sm text-[#40513c]" role="status">{saveNotice}</p> : null}
          <button className="mt-8 bg-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f5f1e8] transition-colors hover:bg-[#9b6b36] disabled:cursor-not-allowed disabled:opacity-60" disabled={isSaving || guide?.homeowner_design_fields_available === false} type="submit">{isSaving ? "Saving…" : "Save Changes"}</button>
        </form>
        <aside className="border-t border-[#20211f]/15 pt-6 lg:border-l lg:border-t-0 lg:pl-7 lg:pt-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#9b6b36]">Guide details</p>
          <p className="mt-4 text-sm leading-7 text-[#20211f]/65">Last updated {guide ? formatDate(guide.updated_at) : ""}</p>
          <Link className="mt-8 inline-flex text-sm font-semibold underline" to={`/paint-guide/g/${guideId}/access`}>Manage Access &amp; QR</Link>
        </aside>
      </section>
    </StaffPageShell>
  );
}

