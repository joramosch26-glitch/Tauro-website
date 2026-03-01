import { ClipboardCheck, FileText, ShieldCheck, Sparkles } from "lucide-react";

const steps = [
  {
    icon: ClipboardCheck,
    title: "Walkthrough & Scope",
    desc: "We review surfaces, lighting, details, and expectations—so the result is predictable from day one.",
    meta: "On-site • 30–60 min",
  },
  {
    icon: FileText,
    title: "Proposal & Schedule",
    desc: "Clear plan, defined scope, and timing. You know exactly what’s happening and when.",
    meta: "Scope • Materials • Timeline",
  },
  {
    icon: ShieldCheck,
    title: "Protection & Execution",
    desc: "Protection-first habits, clean worksite discipline, and controlled technique across every surface.",
    meta: "Clean edges • Consistent coverage",
  },
  {
    icon: Sparkles,
    title: "Final Walkthrough",
    desc: "We review details together, resolve anything that falls short, and leave the space clean and ready.",
    meta: "Touch-ups • Clean handoff",
  },
];

export default function ProcessSection() {
  return (
    <section id="process" className="relative bg-white py-24 lg:py-28">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10 mb-14">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs tracking-[0.22em] uppercase text-slate-700">
              Our Process
              <span className="h-1 w-1 rounded-full bg-amber-500" />
              What to expect
            </div>

            <h2 className="mt-6 text-4xl lg:text-5xl font-bold text-slate-900 leading-[1.05]">
              A calm workflow.
              <span className="block text-amber-600">A premium result.</span>
            </h2>

            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              No chaos. No guessing. Just a clear plan, disciplined execution, and a
              finish delivered with confidence.
            </p>
          </div>

          {/* Small highlight card */}
          <div className="w-full lg:w-[360px] rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
            <p className="text-sm uppercase tracking-[0.22em] text-slate-500">
              The Experience
            </p>
            <p className="mt-3 text-slate-900 font-semibold text-lg">
              You’ll always know what’s next.
            </p>
            <p className="mt-2 text-slate-600">
              Clear scope, protected spaces, clean execution, and a final walkthrough.
            </p>
          </div>
        </div>

        {/* Split layout with image */}
        <div className="grid lg:grid-cols-12 gap-10 items-stretch">
          {/* Image panel */}
          <div className="lg:col-span-5">
            <div className="relative h-[420px] lg:h-full min-h-[520px] overflow-hidden rounded-3xl border border-slate-200 shadow-sm">
              {/* Image (put in /public/process.jpg) */}
              <img
                src="/process.jpg"
                alt="Tauro Painting process"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />

              {/* Soft overlays for premium look */}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />
              <div className="absolute inset-0 bg-[radial-gradient(900px_400px_at_20%_20%,rgba(245,158,11,0.18),transparent_60%)]" />

              {/* Caption */}
              <div className="absolute bottom-0 left-0 right-0 p-7">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-4 py-2 text-xs tracking-[0.22em] uppercase text-white/80">
                  Built on discipline
                  <span className="h-1 w-1 rounded-full bg-amber-400" />
                  Finished with precision
                </div>

                <p className="mt-4 text-white text-2xl font-semibold leading-tight">
                  A process designed to protect your home
                  <span className="text-white/80">—and elevate it.</span>
                </p>
              </div>
            </div>
          </div>

          {/* Steps panel */}
          <div className="lg:col-span-7">
            <div className="h-full rounded-3xl border border-slate-200 bg-white shadow-sm p-8 lg:p-10">
              <div className="grid sm:grid-cols-2 gap-6">
                {steps.map((s) => {
                  const Icon = s.icon;
                  return (
                    <div
                      key={s.title}
                      className="group rounded-2xl border border-slate-200 bg-slate-50/40 p-6 hover:bg-white hover:shadow-sm transition-all"
                    >
                      <div className="flex items-start gap-4">
                        <div className="h-11 w-11 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
                          <Icon className="h-5 w-5 text-amber-600" />
                        </div>

                        <div className="flex-1">
                          <h3 className="text-lg font-bold text-slate-900">
                            {s.title}
                          </h3>
                          <p className="mt-2 text-slate-600 leading-relaxed">
                            {s.desc}
                          </p>
                        </div>
                      </div>

                      <div className="mt-5 pt-5 border-t border-slate-200">
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500">
                          {s.meta}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Editorial close (light) */}
<div className="mt-10 rounded-2xl border border-slate-200 bg-white p-7">
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <p className="text-slate-900 text-lg font-semibold">
      Clean work. Clear communication. Zero shortcuts.
    </p>

    <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
      <span className="h-2 w-2 rounded-full bg-amber-500" />
      Quality is non-negotiable
    </div>
  </div>

  <div className="mt-5 grid grid-cols-3 gap-3 text-xs uppercase tracking-[0.22em] text-slate-500">
    <span>Protected spaces</span>
    <span>Disciplined execution</span>
    <span className="text-right">Clean handoff</span>
  </div>
</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-20 border-t border-slate-200" />
      </div>
    </section>
  );
}