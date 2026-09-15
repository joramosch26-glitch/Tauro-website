import { Link } from "react-router-dom";
import { useEffect } from "react";

export default function Springville() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="bg-[#f5f3ee] pb-24 pt-32">
      <div className="mx-auto max-w-5xl px-6">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#9a6a25]">Areas we serve</p>
        <h1 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 lg:text-6xl">
          House Painters in Springville, UT
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600">
          Tauro Painting provides high-end interior and exterior painting for custom homes, remodels,
          and premium residential projects in Springville, Utah.
        </p>

        <div className="mt-14 grid gap-10 border-t border-slate-300 pt-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">Interior & exterior painting</h2>
            <p className="mt-4 leading-7 text-slate-600">
              Our crews handle walls, ceilings, trim, doors, exterior systems, cabinetry, stain, and
              architectural woodwork with careful preparation and clean project coordination.
            </p>
          </div>
          <div>
            <h2 className="text-2xl font-semibold text-slate-950">A process built for custom work</h2>
            <p className="mt-4 leading-7 text-slate-600">
              From early priming through final punch, we coordinate the finish sequence around the builder's
              schedule and correct details before they become expensive problems later in the project.
            </p>
          </div>
        </div>

        <Link
          to="/contact"
          className="mt-12 inline-flex bg-slate-950 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-amber-500 hover:text-slate-950"
        >
          Request a walkthrough
        </Link>
      </div>
    </main>
  );
}
