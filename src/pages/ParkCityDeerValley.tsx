import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const heading = "text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl";
const textLink = "inline-flex min-h-11 items-center gap-4 border-b border-current py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function ParkCityDeerValley() {
  return (
    <div>
      <section aria-labelledby="park-city-heading" className="bg-[#f5f3ee] text-slate-950">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-8 lg:px-8 lg:pt-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            <Link to="/" className="transition-colors hover:text-slate-950">Home</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <Link to="/locations" className="transition-colors hover:text-slate-950">Where Tauro works</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <span aria-current="page" className="text-[#9a6a25]">Park City / Deer Valley</span>
          </nav>
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:pb-24">
          <div className="lg:col-span-8">
            <p className={`${eyebrow} mb-7 flex items-center gap-3 text-[#9a6a25]`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Park City / Deer Valley, Utah</p>
            <h1 id="park-city-heading" className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[5.8rem]">Finish standards<br />for exceptional homes.</h1>
          </div>
          <div className="lg:col-span-4 lg:pb-1">
            <p className="text-lg leading-8 text-slate-600">For homes where every material, reveal, and transition is expected to hold up to a closer look.</p>
            <Link to="/contact" className={`${textLink} mt-7 text-slate-950`}>Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="park-city-image-heading" className="bg-slate-950 text-white">
        <figure>
          <img src="/tauro/exterior-residence.webp" alt="Tauro Painting exterior finish work on a refined custom residence" fetchPriority="high" className="h-[400px] w-full object-cover sm:h-[540px] lg:h-[680px]" />
          <figcaption id="park-city-image-heading" className="mx-auto max-w-7xl px-6 py-5 text-[10px] uppercase tracking-[0.2em] text-white/60 lg:px-8">Real Tauro work · exterior finish detail</figcaption>
        </figure>
      </section>

      <section aria-labelledby="park-city-intro-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <p className={`${eyebrow} text-[#9a6a25] lg:col-span-3`}>Luxury residential finishing</p>
          <div className="lg:col-span-8 lg:col-start-5">
            <h2 id="park-city-intro-heading" className={`${heading} max-w-3xl text-slate-950`}>The finish should be as resolved as the architecture.</h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600">Custom home painting in Park City and luxury home painting in Deer Valley call for more than coverage. They demand detailed prep, considered material choices, and a crew that can coordinate cleanly with builders, designers, and the other trades.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="park-city-materials-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Materials under scrutiny</p>
            <h2 id="park-city-materials-heading" className={`${heading} text-slate-950`}>Character lives in the details.</h2>
            <p className="mt-7 leading-8 text-slate-600">Cabinetry and wood finishes carry a room&apos;s visual weight. Stain, clear finishes, enamel, trim, doors, and architectural woodwork each need a finish system that respects the material and the light around it.</p>
            <Link to="/services" className={`${textLink} mt-8 text-slate-950`}>Explore cabinetry & wood finishes <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
          <figure className="lg:col-span-7">
            <img src="/tauro/stair-detail.webp" alt="Tauro Painting stair and interior wood finish detail" loading="lazy" className="aspect-[5/4] w-full object-cover" />
          </figure>
        </div>
      </section>

      <section aria-labelledby="park-city-sequence-heading" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7"><p className={`${eyebrow} mb-6 text-[#c5a374]`}>The quiet disciplines</p><h2 id="park-city-sequence-heading" className={`${heading} max-w-3xl text-white lg:text-6xl`}>Sequencing is part of the finish.</h2></div>
            <p className="leading-8 text-white/70 lg:col-span-4 lg:col-start-9">High-end residential painting comes together before the last coat: protection, correction, masking, coordination, and final punch all have to happen at the right moment.</p>
          </div>
          <div className="mt-14 grid border-t border-white/20 md:grid-cols-3">
            {["Prepare deliberately", "Coordinate closely", "Close with care"].map((title, index) => (
              <div key={title} className="border-b border-white/20 py-8 md:border-b-0 md:py-10 md:pr-8 md:[&:not(:last-child)]:border-r md:[&:not(:first-child)]:pl-8">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#c5a374]">0{index + 1}</p>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
              </div>
            ))}
          </div>
          <Link to="/about" className={`${textLink} mt-10 text-white`}>How Tauro works <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
      </section>

      <section aria-labelledby="park-city-portfolio-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <figure className="lg:col-span-6"><img src="/tauro/coffered-ceiling.webp" alt="Detailed custom-home ceiling finish by Tauro Painting" loading="lazy" className="aspect-[5/4] w-full object-cover" /></figure>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>See the standard</p>
            <h2 id="park-city-portfolio-heading" className={`${heading} text-slate-950`}>Work that makes the case.</h2>
            <p className="mt-7 leading-8 text-slate-600">Explore Tauro&apos;s portfolio of premium interior finishes, cabinetry, woodwork, exteriors, and custom-home details. Each image is presented as Tauro work—not as an unverified Park City or Deer Valley project.</p>
            <div className="mt-8 flex flex-wrap gap-5"><Link to="/projects" className="inline-flex min-h-14 items-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25]">View projects <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link><Link to="/locations" className={`${textLink} text-slate-950`}>Where Tauro works <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="park-city-cta-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-8">
          <div><p className={`${eyebrow} mb-5 text-[#9a6a25]`}>A clear first conversation</p><h2 id="park-city-cta-heading" className={`${heading} max-w-2xl text-slate-950`}>Let&apos;s walk the project before the sequence gets complicated.</h2></div>
          <Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
      </section>
    </div>
  );
}
