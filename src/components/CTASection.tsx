import { ArrowRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";

export default function CTASection() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-24 text-white lg:py-32">
      <img
        src="/tauro/exterior-custom-home.webp"
        alt=""
        aria-hidden="true"
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover opacity-25"
      />
      <div className="absolute inset-0 bg-slate-950/65" />
      <div className="relative z-10 mx-auto max-w-5xl px-6 text-center lg:px-8">
        <p className="mb-5 text-xs font-semibold uppercase tracking-[0.3em] text-amber-300">Start the conversation</p>
        <h2 className="text-4xl font-semibold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
          Building something that deserves a better finish?
        </h2>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/70">
          Send us the plans, schedule a walkthrough, or call us to talk through your next custom home or residential project.
        </p>
        <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
          <Link
            to="/contact"
            className="inline-flex items-center justify-center gap-2 bg-white px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-amber-400"
          >
            Request a walkthrough <ArrowRight className="h-4 w-4" />
          </Link>
          <a
            href="tel:8019289520"
            className="inline-flex items-center justify-center gap-2 border border-white/35 px-7 py-4 text-sm font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white hover:text-slate-950"
          >
            <Phone className="h-4 w-4" /> (801) 928-9520
          </a>
        </div>
      </div>
    </section>
  );
}
