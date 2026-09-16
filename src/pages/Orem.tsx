import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const heading = "text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl";
const textLink = "inline-flex min-h-11 items-center gap-4 border-b border-current py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function Orem() {
  return (
    <div>
      <section aria-labelledby="orem-heading" className="bg-[#f5f3ee] text-slate-950">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-8 lg:px-8 lg:pt-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Link to="/" className="transition-colors hover:text-slate-950">Home</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <Link to="/locations" className="transition-colors hover:text-slate-950">Where Tauro works</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <span aria-current="page" className="text-[#9a6a25]">Orem, Utah</span>
          </nav>
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:pb-24">
          <div className="lg:col-span-8">
            <p className={`${eyebrow} mb-7 flex items-center gap-3 text-[#9a6a25]`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Orem, Utah</p>
            <h1 id="orem-heading" className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[5.8rem]">A clear standard,<br />close to home.</h1>
          </div>
          <div className="lg:col-span-4 lg:pb-1">
            <p className="text-lg leading-8 text-slate-600">Tauro Painting is based in Orem, serving custom-home builders, designers, and homeowners across Utah County with premium finishing systems.</p>
            <Link to="/contact" className={`${textLink} mt-7 text-slate-950`}>Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="orem-image-heading" className="bg-slate-950 text-white">
        <figure>
          <img src="/tauro/interior-open-plan.webp" alt="Tauro Painting custom-home interior finish work" fetchPriority="high" className="h-[400px] w-full object-cover object-center sm:h-[540px] lg:h-[680px]" />
          <figcaption id="orem-image-heading" className="mx-auto max-w-7xl px-6 py-5 text-[10px] uppercase tracking-[0.2em] text-white/60 lg:px-8">Real Tauro work · custom-home interior finish detail</figcaption>
        </figure>
      </section>

      <section aria-labelledby="orem-base-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <p className={`${eyebrow} text-[#9a6a25] lg:col-span-3`}>Orem business base</p>
          <div className="lg:col-span-8 lg:col-start-5">
            <h2 id="orem-base-heading" className={`${heading} max-w-3xl text-slate-950`}>The right finish starts with a shared understanding.</h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600">From our Orem business base, Tauro helps bring clarity to the finish work in demanding custom homes: what needs preparation, when each system belongs in the sequence, and how the completed surfaces should come together at final punch.</p>
            <p className="mt-6 text-sm leading-7 text-slate-500">Tauro Painting · 1144 N Main St, Orem, UT 84057</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="orem-systems-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <figure className="lg:col-span-7">
            <img src="/tauro/office-woodwork.webp" alt="Tauro Painting cabinetry and architectural woodwork finish detail" loading="lazy" className="aspect-[5/4] w-full object-cover" />
            <figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">Cabinetry, stain &amp; architectural woodwork</figcaption>
          </figure>
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Built around the surfaces</p>
            <h2 id="orem-systems-heading" className={`${heading} text-slate-950`}>Finish systems for the whole home.</h2>
            <p className="mt-7 leading-8 text-slate-600">Custom-home painting is a set of related disciplines. Premium interior and exterior finishes, cabinetry, stain and clear finishes, doors, trim, and architectural woodwork each call for detailed preparation and a finish system suited to the material.</p>
            <Link to="/services" className={`${textLink} mt-8 text-slate-950`}>Explore finishing services <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="orem-sequence-heading" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-12 lg:items-center lg:gap-16 lg:px-8">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#c5a374]`}>Coordination that protects the work</p>
            <h2 id="orem-sequence-heading" className={`${heading} text-white`}>The sequence is part of the standard.</h2>
            <p className="mt-7 leading-8 text-white/70">We work with builders and designers through surface correction, protected application, cabinetry and wood finishes, and final touch-ups. Clear coordination lets the finish work support the architecture and the handoff instead of competing with the work around it.</p>
            <Link to="/contact" className={`${textLink} mt-8 text-white`}>Start a project conversation <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
          <figure className="lg:col-span-7"><img src="/tauro/entry-door.webp" alt="Stained wood entry door with a clear finish by Tauro Painting" loading="lazy" className="aspect-[5/4] w-full object-cover lg:aspect-[16/10]" /></figure>
        </div>
      </section>

      <section aria-labelledby="orem-work-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>See the finish language</p>
            <h2 id="orem-work-heading" className={`${heading} max-w-2xl text-slate-950`}>A portfolio of work, without made-up labels.</h2>
            <p className="mt-7 max-w-2xl leading-8 text-slate-600">Explore Tauro&apos;s selected work across custom-home interiors, exteriors, cabinetry, woodwork, stain, and clear finishes. Each image represents real Tauro work without attaching unverified project names or locations.</p>
          </div>
          <div className="flex flex-col items-start gap-5 lg:col-span-5 lg:items-end">
            <Link to="/projects" className="inline-flex min-h-14 items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">View selected work <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
            <Link to="/locations" className={`${textLink} text-slate-900`}>Where Tauro works <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="orem-cta-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-8">
          <div><p className={`${eyebrow} mb-5 text-[#9a6a25]`}>Start at the right point</p><h2 id="orem-cta-heading" className={`${heading} max-w-2xl text-slate-950`}>Let&apos;s walk the project before finish work begins.</h2></div>
          <Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
      </section>
    </div>
  );
}
