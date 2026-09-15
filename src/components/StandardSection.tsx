import { Check } from "lucide-react";

const standards = [
  "Early priming coordination before finish carpentry and flooring when the project allows it",
  "Detailed protection, sanding, caulking, filling, and surface correction before finish coats",
  "Consistent systems for walls, trim, cabinetry, doors, stain, and clear finishes",
  "Final punch completed with the same attention as the first coat",
];

export default function StandardSection() {
  return (
    <section className="overflow-hidden bg-slate-950 text-white">
      <div className="grid lg:min-h-[760px] lg:grid-cols-2">
        <div className="relative min-h-[520px] lg:min-h-full">
          <img
            src="/tauro/coffered-ceiling.webp"
            alt="Detailed custom ceiling finish by Tauro Painting"
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-black/10" />
        </div>

        <div className="flex items-center px-6 py-20 sm:px-10 lg:px-16 xl:px-24">
          <div className="max-w-2xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-400">The Tauro standard</p>
            <h2 className="text-4xl font-semibold leading-[1.04] tracking-[-0.04em] sm:text-5xl lg:text-6xl">
              Prep is not a phase we rush through.
            </h2>
            <p className="mt-7 text-lg leading-8 text-white/[0.68]">
              The finish only looks as good as the surface underneath it. Our process is built around disciplined prep,
              clean coordination, and quality control from rough construction through the final walkthrough.
            </p>

            <div className="mt-10 space-y-5 border-t border-white/15 pt-8">
              {standards.map((item) => (
                <div key={item} className="flex gap-4">
                  <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-amber-400/45 bg-amber-400/10">
                    <Check className="h-3.5 w-3.5 text-amber-300" />
                  </div>
                  <p className="leading-7 text-white/[0.76]">{item}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
