import { Link, useNavigate } from "react-router-dom";
import { FormEvent, useState } from "react";
import { StaffPageShell } from "../components/StaffPageShell";
import { createPaintGuide } from "../data/guides";

export function NewGuide() {
  const navigate = useNavigate();
  const [residenceName, setResidenceName] = useState("");
  const [primaryScopeNote, setPrimaryScopeNote] = useState("");
  const [validationError, setValidationError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedResidenceName = residenceName.trim();

    if (!trimmedResidenceName) {
      setValidationError("Residence Name is required.");
      return;
    }

    setValidationError("");
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const guide = await createPaintGuide({
        residenceName: trimmedResidenceName,
        primaryScopeNote: primaryScopeNote.trim(),
      });
      navigate(`/paint-guide/g/${guide.id}`);
    } catch {
      setSubmitError("Could not create Paint Guide. Please try again.");
      setIsSubmitting(false);
    }
  }

  return (
    <StaffPageShell title="New Paint Guide">
      <section className="max-w-2xl py-10 sm:py-14">
        <p className="max-w-xl leading-7 text-[#20211f]/65">
          Start with the residence and a concise scope note. Locations and finish records can be added in a later phase.
        </p>
        <form className="mt-8 border border-[#20211f]/15 bg-white p-6 sm:p-9" onSubmit={(event) => void handleSubmit(event)}>
          <div>
            <label className="text-sm font-semibold" htmlFor="paint-guide-residence-name">
              Residence Name
            </label>
            <input
              autoComplete="off"
              className="mt-2 w-full border border-[#20211f]/25 bg-white px-4 py-3 text-[#20211f]"
              disabled={isSubmitting}
              id="paint-guide-residence-name"
              onChange={(event) => setResidenceName(event.target.value)}
              required
              value={residenceName}
            />
            <p className="mt-2 text-sm text-[#20211f]/55">Example: Ramos Residence</p>
          </div>
          <div className="mt-7">
            <label className="text-sm font-semibold" htmlFor="paint-guide-primary-scope-note">
              Primary Scope Note <span className="font-normal text-[#20211f]/55">(optional)</span>
            </label>
            <textarea
              className="mt-2 min-h-32 w-full border border-[#20211f]/25 bg-white px-4 py-3 text-[#20211f]"
              disabled={isSubmitting}
              id="paint-guide-primary-scope-note"
              onChange={(event) => setPrimaryScopeNote(event.target.value)}
              value={primaryScopeNote}
            />
            <p className="mt-2 text-sm text-[#20211f]/55">
              Used throughout the Main and Second Floors unless noted otherwise.
            </p>
          </div>
          {validationError ? <p className="mt-5 text-sm text-[#9c2f2f]" role="alert">{validationError}</p> : null}
          {submitError ? <p className="mt-5 text-sm text-[#9c2f2f]" role="alert">{submitError}</p> : null}
          <div className="mt-8 flex flex-wrap gap-3">
            <button
              className="bg-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f5f1e8] transition-colors hover:bg-[#9b6b36] disabled:cursor-not-allowed disabled:opacity-60"
              disabled={isSubmitting}
              type="submit"
            >
              {isSubmitting ? "Creating…" : "Create Guide"}
            </button>
            <Link
              className="border border-[#20211f]/30 px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[#20211f]"
              to="/paint-guide"
            >
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </StaffPageShell>
  );
}
