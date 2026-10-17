import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { GuideStatusBadge } from "../components/GuideStatusBadge";
import { StaffPageShell } from "../components/StaffPageShell";
import { listPaintGuides } from "../data/guides";
import type { PaintGuide } from "../data/types";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function GuideDashboard() {
  const [guides, setGuides] = useState<PaintGuide[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let active = true;

    void listPaintGuides()
      .then((nextGuides) => {
        if (!active) return;
        setGuides(nextGuides);
        setState("ready");
      })
      .catch(() => {
        if (!active) return;
        setState("error");
      });

    return () => {
      active = false;
    };
  }, []);

  const newGuideAction = (
    <Link
      className="inline-flex bg-[#20211f] px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#f5f1e8] transition-colors hover:bg-[#9b6b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6b36]"
      to="/paint-guide/new"
    >
      New Paint Guide
    </Link>
  );

  return (
    <StaffPageShell action={newGuideAction} title="Paint Guides">
      <section className="py-10 sm:py-14">
        {state === "loading" ? (
          <p aria-live="polite" className="text-sm uppercase tracking-[0.14em] text-[#20211f]/60">
            Loading Paint Guides…
          </p>
        ) : null}

        {state === "error" ? (
          <div className="border border-[#9c2f2f]/25 bg-white p-6">
            <p className="font-serif text-2xl">Could not load Paint Guides.</p>
            <p className="mt-2 text-[#20211f]/65">Please try again.</p>
          </div>
        ) : null}

        {state === "ready" && guides.length === 0 ? (
          <div className="max-w-2xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">A clear start</p>
            <h2 className="mt-4 font-serif text-3xl leading-tight sm:text-4xl">No Paint Guides yet.</h2>
            <p className="mt-4 max-w-xl leading-7 text-[#20211f]/65">
              Create the first residence guide to begin documenting paint colors and finishes.
            </p>
            <Link
              className="mt-8 inline-flex bg-[#20211f] px-5 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#f5f1e8] transition-colors hover:bg-[#9b6b36] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6b36]"
              to="/paint-guide/new"
            >
              Create Paint Guide
            </Link>
          </div>
        ) : null}

        {state === "ready" && guides.length > 0 ? (
          <div className="border-t border-[#20211f]/15">
            {guides.map((guide) => (
              <Link
                className="group grid gap-4 border-b border-[#20211f]/15 bg-white px-5 py-6 transition-colors hover:bg-[#fffdf8] sm:grid-cols-[minmax(0,1fr)_auto_auto] sm:items-center sm:px-7"
                key={guide.id}
                to={`/paint-guide/g/${guide.id}`}
              >
                <span className="font-serif text-2xl leading-tight group-hover:text-[#9b6b36]">{guide.residence_name}</span>
                <GuideStatusBadge status={guide.status} />
                <span className="text-xs uppercase tracking-[0.12em] text-[#20211f]/55">
                  Updated {formatDate(guide.updated_at)}
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </StaffPageShell>
  );
}
