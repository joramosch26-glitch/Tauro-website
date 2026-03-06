import { Link } from "react-router-dom";

export default function Locations() {
  return (
    <main className="pt-28 pb-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
          Areas We Serve
        </span>

        <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
          Utah County Locations
        </h1>

        <p className="text-lg text-slate-600 leading-relaxed mb-10">
          We serve homeowners across Utah County with premium interior and exterior
          painting. Choose a location to explore local service details.
        </p>

        <div className="grid sm:grid-cols-2 gap-6">
          {/* ✅ Existing location page */}
          <Link
            to="/locations/orem"
            className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
                  Orem, UT
                </h2>
                <p className="text-slate-600 mt-2 leading-relaxed">
                  House painters in Orem with disciplined prep and premium finishes.
                </p>
              </div>
              <span className="text-amber-600 font-semibold">View →</span>
            </div>
          </Link>

          {/* ✅ Existing location page */}
          <Link
  to="/locations/provo"
  className="group rounded-2xl border border-slate-200 bg-white p-6 shadow-sm hover:shadow-md transition"
>
  <div className="flex items-start justify-between gap-4">
    <div>
      <h2 className="text-xl font-semibold text-slate-900 group-hover:text-amber-700 transition-colors">
        Provo, UT
      </h2>
      <p className="text-slate-600 mt-2 leading-relaxed">
        House painters in Provo with disciplined prep and premium finishes.
      </p>
    </div>
    <span className="text-amber-600 font-semibold">View →</span>
  </div>
</Link>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm opacity-70">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  Lehi, UT
                </h2>
                <p className="text-slate-600 mt-2 leading-relaxed">
                  Location page coming soon.
                </p>
              </div>
              <span className="text-slate-500 font-semibold">Soon</span>
            </div>
          </div>
        </div>

        <div className="mt-12">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-8 py-3 rounded-lg transition"
          >
            Request a Free Estimate
          </Link>
        </div>
      </div>
    </main>
  );
}