import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const heading = "text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl";
const textLink = "inline-flex min-h-11 items-center gap-4 border-b border-current py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function Midway() {
  return (
    <div>
      <section aria-labelledby="midway-heading" className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 pb-12 pt-8 lg:px-8 lg:pt-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            <Link to="/" className="transition-colors hover:text-white">Home</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <Link to="/locations" className="transition-colors hover:text-white">Where Tauro works</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <span aria-current="page" className="text-[#c5a374]">Midway, Utah</span>
          </nav>
        </div>
        <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:pb-24">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} mb-7 flex items-center gap-3 text-[#c5a374]`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Midway, Utah</p>
            <h1 id="midway-heading" className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">Finishes made<br />for the setting.</h1>
          </div>
          <div className="lg:col-span-5 lg:pb-1">
            <p className="max-w-md text-lg leading-8 text-white/75">Custom home painting, cabinetry, stain, and architectural wood finishes for discerning homes in Midway, Utah.</p>
            <Link to="/contact" className={`${textLink} mt-7 text-white`}>Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
        <figure>
          <img src="/tauro/interior-great-room.webp" alt="Tauro Painting interior finish work in a custom home great room" fetchPriority="high" className="h-[360px] w-full object-cover object-center sm:h-[480px] lg:h-[600px]" />
          <figcaption className="mx-auto max-w-7xl px-6 py-5 text-[10px] uppercase tracking-[0.2em] text-white/60 lg:px-8">Real Tauro work · custom home finishes</figcaption>
        </figure>
      </section>

      <section aria-labelledby="midway-approach-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-12 lg:px-8">
          <p className={`${eyebrow} text-[#9a6a25] lg:col-span-3`}>A considered process</p>
          <div className="lg:col-span-9">
            <h2 id="midway-approach-heading" className={`${heading} max-w-3xl text-slate-950`}>The finish belongs in the plan.</h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600">In a custom home, house painting is not a final cosmetic layer. It is a sequence of preparation, protection, material choices, and precise application that has to work with the architecture, the builder&apos;s schedule, and the designer&apos;s intent.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="midway-services-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <figure className="lg:col-span-7">
            <img src="/tauro/office-woodwork.webp" alt="Tauro Painting cabinetry and architectural woodwork finish detail" loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-[6/5]" />
            <figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">Cabinetry, stain & architectural woodwork</figcaption>
          </figure>
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Interior to exterior</p>
            <h2 id="midway-services-heading" className={`${heading} text-slate-950`}>Every surface has its own standard.</h2>
            <p className="mt-7 leading-8 text-slate-600">We finish interiors and exteriors with the same attention to substrate, light, sheen, and protection. Cabinetry, doors, stain, clear coats, trim, ceilings, and exterior systems each receive the preparation their material requires.</p>
            <Link to="/services" className={`${textLink} mt-8 text-slate-900`}>Explore finishing services <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="midway-sequence-heading" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-12 lg:items-center lg:gap-16 lg:px-8">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#c5a374]`}>Builder & designer coordination</p>
            <h2 id="midway-sequence-heading" className={`${heading} text-white`}>From prep through final punch.</h2>
            <p className="mt-7 leading-8 text-white/70">We coordinate early priming, surface correction, cabinetry and wood finishes, protected application, and final touch-ups around the work of the other trades. The result is a finish process that supports a clean handoff instead of creating late-stage surprises.</p>
            <Link to="/about" className={`${textLink} mt-8 text-white`}>How Tauro works <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
          <figure className="lg:col-span-7"><img src="/tauro/entry-door.webp" alt="Stained wood entry door with a clear finish by Tauro Painting" loading="lazy" className="aspect-[5/4] w-full object-cover lg:aspect-[16/10]" /></figure>
        </div>
      </section>

      <section aria-labelledby="midway-work-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>The work, without the fiction</p>
            <h2 id="midway-work-heading" className={`${heading} max-w-2xl text-slate-950`}>See the finish language.</h2>
            <p className="mt-7 max-w-2xl leading-8 text-slate-600">Tauro has completed custom-home work in the Midway area. The project portfolio shares the kinds of interiors, cabinetry, doors, wood finishes, and exterior details we bring to premium residential work across Utah, without attaching unverified project names or addresses.</p>
          </div>
          <div className="flex flex-col items-start gap-5 lg:col-span-5 lg:items-end">
            <Link to="/projects" className="inline-flex min-h-14 items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">View Tauro projects <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
            <Link to="/locations" className={`${textLink} text-slate-900`}>Where Tauro works <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="midway-cta-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-8">
          <div><p className={`${eyebrow} mb-5 text-[#9a6a25]`}>Start with the walkthrough</p><h2 id="midway-cta-heading" className={`${heading} max-w-2xl text-slate-950`}>Bring us in before the details get expensive.</h2></div>
          <Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
      </section>
    </div>
  );
}
