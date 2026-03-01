export default function StandardSection() {
  const pillars = [
    {
      title: "Clarity before color",
      desc: "We confirm scope, surfaces, and expectations up front—so the result is predictable and repeatable.",
    },
    {
      title: "Prep is respect",
      desc: "Protection and surface work are treated as the main event. The finish only reflects what’s underneath.",
    },
    {
      title: "Precision is habit",
      desc: "Straight lines, clean transitions, consistent coverage. Not a “special request”—just the way it’s done.",
    },
    {
      title: "Quality is enforced",
      desc: "If something doesn’t meet the standard, it’s corrected. No excuses, no blame—just ownership.",
    },
  ];

  return (
    <section className="relative overflow-hidden bg-slate-950 py-24">
      {/* Subtle texture + gradients (A + B) */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_15%_20%,rgba(245,158,11,0.12),transparent_60%),radial-gradient(900px_500px_at_85%_25%,rgba(59,130,246,0.10),transparent_60%),radial-gradient(900px_600px_at_50%_90%,rgba(255,255,255,0.05),transparent_60%)]" />
        <div
          className="absolute inset-0 opacity-[0.10] mix-blend-overlay"
          style={{
            backgroundImage:
              "repeating-radial-gradient(circle at 20% 30%, rgba(255,255,255,0.08) 0 1px, transparent 1px 6px), repeating-radial-gradient(circle at 70% 60%, rgba(255,255,255,0.06) 0 1px, transparent 1px 7px)",
          }}
        />
        <div className="absolute inset-0 bg-[radial-gradient(1200px_700px_at_50%_50%,transparent_55%,rgba(0,0,0,0.65)_100%)]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-12 gap-14 items-start">
          {/* Left: Statement */}
          <div className="lg:col-span-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs tracking-[0.22em] uppercase text-white/80">
              The Standard
              <span className="h-1 w-1 rounded-full bg-amber-500" />
              Tauro Painting
            </div>

            <h2 className="mt-6 text-4xl sm:text-5xl font-bold text-white leading-[1.05]">
              Discipline isn’t a feature.
              <span className="block text-amber-400">It’s the baseline.</span>
            </h2>

            <p className="mt-6 text-lg text-white/70 leading-relaxed max-w-xl">
              Premium results don’t come from “trying harder.” They come from a standard
              that is followed every time—quietly, consistently, without shortcuts.
            </p>

            <div className="mt-10 rounded-2xl border border-white/10 bg-white/5 p-6">
              <p className="text-white font-semibold">No shortcuts. No compromise.</p>
              <p className="mt-2 text-white/70">
                If a step is required for a flawless finish, we do it. If something isn’t right,
                it gets corrected. Period.
              </p>
            </div>
          </div>

          {/* Right: Vertical pillars */}
          <div className="lg:col-span-7">
            <div className="relative">
              <div className="absolute left-3 top-0 bottom-0 w-px bg-white/10" />

              <div className="space-y-10">
                {pillars.map((p, idx) => (
                  <div key={p.title} className="relative pl-12">
                    <div className="absolute left-0 top-1">
                      <div className="h-6 w-6 rounded-full bg-slate-950 border border-white/10 flex items-center justify-center">
                        <div className="h-2.5 w-2.5 rounded-full bg-amber-500" />
                      </div>
                    </div>

                    <div className="flex items-start gap-4">
                      <div className="text-xs font-semibold tracking-[0.25em] uppercase text-amber-400 mt-1">
                        {String(idx + 1).padStart(2, "0")}
                      </div>
                      <div>
                        <h3 className="text-xl font-semibold text-white">{p.title}</h3>
                        <p className="mt-2 text-white/70 leading-relaxed">{p.desc}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-14 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-2xl border border-white/10 bg-white/5 px-7 py-6">
                <p className="text-white text-lg font-semibold">
                  Excellence is enforced on-site.
                </p>
                <div className="inline-flex items-center gap-2 rounded-full bg-amber-500/15 px-4 py-2 text-sm text-amber-200 border border-amber-500/20">
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                  Quality is non-negotiable
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-24 border-t border-white/10" />
      </div>
    </section>
  );
}