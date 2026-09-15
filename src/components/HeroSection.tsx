import { ArrowDown, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const proof = [
  "Custom homes",
  "Builder-focused",
  "Premium finishes",
  "Utah craftsmanship",
];

export default function HeroSection() {
  return (
    <section id="home" className="relative min-h-[94vh] lg:min-h-screen overflow-hidden bg-slate-950">
      <img
        src="/tauro/hero-custom-home.webp"
        alt="High-end custom home interior finished by Tauro Painting in Utah"
        className="absolute inset-0 h-full w-full object-cover object-center"
        fetchPriority="high"
      />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,12,17,0.88)_0%,rgba(8,12,17,0.66)_38%,rgba(8,12,17,0.18)_72%,rgba(8,12,17,0.08)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,12,17,0.42)_0%,transparent_34%,rgba(8,12,17,0.66)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-[94vh] lg:min-h-screen max-w-7xl items-end px-6 pb-14 pt-36 lg:px-8 lg:pb-20">
        <div className="w-full">
          <div className="max-w-4xl">
            <p className="mb-6 text-xs font-semibold uppercase tracking-[0.34em] text-white/70 sm:text-sm">
              High-end painting & custom finishes · Utah
            </p>

            <h1 className="max-w-4xl text-[3.35rem] font-semibold leading-[0.95] tracking-[-0.045em] text-white sm:text-7xl lg:text-[6.4rem]">
              Finishes worthy
              <span className="block text-white/[0.72]">of the home.</span>
            </h1>

            <p className="mt-7 max-w-2xl text-base leading-7 text-white/[0.78] sm:text-lg sm:leading-8">
              Precision painting, cabinetry, woodwork, and exterior finishes for custom homes,
              luxury remodels, and premium residential construction across Utah.
            </p>

            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/contact"
                className="inline-flex items-center justify-center gap-2 bg-white px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-400"
              >
                Request a walkthrough
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/projects"
                className="inline-flex items-center justify-center border border-white/35 bg-white/5 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white backdrop-blur-sm transition hover:bg-white hover:text-slate-950"
              >
                Explore our work
              </Link>
            </div>
          </div>

          <div className="mt-12 grid max-w-4xl grid-cols-2 border-t border-white/20 pt-6 sm:grid-cols-4">
            {proof.map((item) => (
              <div key={item} className="border-white/15 py-2 pr-4 sm:border-r sm:last:border-r-0 sm:pl-5 sm:first:pl-0">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/[0.62]">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <a
        href="#services"
        aria-label="Scroll to services"
        className="absolute bottom-8 right-8 z-20 hidden h-12 w-12 items-center justify-center rounded-full border border-white/25 text-white transition hover:bg-white hover:text-slate-950 lg:flex"
      >
        <ArrowDown className="h-4 w-4" />
      </a>
    </section>
  );
}
