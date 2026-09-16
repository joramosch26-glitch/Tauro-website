import { ArrowUpRight, ChevronRight } from "lucide-react";
import { Link } from "react-router-dom";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const heading = "text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl";
const textLink = "inline-flex min-h-11 items-center gap-4 border-b border-current py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function Provo() {
  return (
    <div>
      <section aria-labelledby="provo-heading" className="bg-slate-950 text-white">
        <div className="mx-auto max-w-7xl px-6 pb-10 pt-8 lg:px-8 lg:pt-10">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/55">
            <Link to="/" className="transition-colors hover:text-white">Home</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <Link to="/locations" className="transition-colors hover:text-white">Where Tauro works</Link>
            <ChevronRight aria-hidden="true" className="h-3 w-3" />
            <span aria-current="page" className="text-[#c5a374]">Provo, Utah</span>
          </nav>
        </div>
        <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:pb-24">
          <div className="lg:col-span-7">
            <p className={`${eyebrow} mb-7 flex items-center gap-3 text-[#c5a374]`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Provo, Utah</p>
            <h1 id="provo-heading" className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[5.7rem]">A stronger finish<br />for the outside in.</h1>
          </div>
          <div className="lg:col-span-4 lg:col-start-9 lg:pb-1">
            <p className="text-lg leading-8 text-white/75">Exterior painting and premium custom-home finishing for Provo projects where the surfaces, sequence, and final details all matter.</p>
            <Link to="/contact" className={`${textLink} mt-7 text-white`}>Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="provo-exterior-image-heading" className="bg-[#f5f3ee]">
        <figure className="mx-auto max-w-[1600px]">
          <img src="/tauro/exterior-residence.webp" alt="Tauro Painting exterior finish work on a custom residence" fetchPriority="high" className="h-[400px] w-full object-cover sm:h-[540px] lg:h-[680px]" />
          <figcaption id="provo-exterior-image-heading" className="px-6 py-5 text-[10px] uppercase tracking-[0.2em] text-slate-500 lg:px-8">Real Tauro work · exterior finish detail</figcaption>
        </figure>
      </section>

      <section aria-labelledby="provo-exterior-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <p className={`${eyebrow} text-[#9a6a25] lg:col-span-3`}>Exterior painting in Provo</p>
          <div className="lg:col-span-8 lg:col-start-5">
            <h2 id="provo-exterior-heading" className={`${heading} max-w-3xl text-slate-950`}>The exterior has to perform before it can impress.</h2>
            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-600">Quality exterior painting in Provo starts with the substrate, not the final coat. We assess preparation, protection, transitions, and coating systems so a custom home&apos;s exterior finish can meet the demands of weather, materials, and close inspection.</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="provo-systems-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>More than coverage</p>
            <h2 id="provo-systems-heading" className={`${heading} text-slate-950`}>Exterior systems, resolved with the rest of the home.</h2>
            <p className="mt-7 leading-8 text-slate-600">For premium residential painting, exterior work belongs in the larger finish plan. We coordinate detailed preparation and exterior systems with premium interior painting, cabinetry, stain and clear finishes, and architectural woodwork so the whole home carries a consistent standard.</p>
            <Link to="/services" className={`${textLink} mt-8 text-slate-950`}>Explore finishing services <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
          <figure className="lg:col-span-7">
            <img src="/tauro/exterior-custom-home.webp" alt="Tauro Painting exterior coating work on a custom home" loading="lazy" className="aspect-[5/4] w-full object-cover" />
            <figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">Custom-home exterior finishing</figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="provo-process-heading" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7"><p className={`${eyebrow} mb-6 text-[#c5a374]`}>A finish sequence with intent</p><h2 id="provo-process-heading" className={`${heading} max-w-3xl text-white lg:text-6xl`}>Prep, coordination, final punch.</h2></div>
            <p className="leading-8 text-white/70 lg:col-span-4 lg:col-start-9">From early surface correction through protected application and final touch-ups, Tauro works with builders and designers to keep finish work moving at the right time.</p>
          </div>
          <div className="mt-14 grid border-t border-white/20 md:grid-cols-3">
            {[
              ["01", "Prepare the surface", "Detailed preparation gives exterior and interior finishes the conditions they need."],
              ["02", "Coordinate the work", "Clear sequencing helps finishes sit cleanly alongside the other trades."],
              ["03", "Close with care", "Final punch brings the same attention to the last details as the first pass."],
            ].map(([number, title, detail]) => (
              <div key={number} className="border-b border-white/20 py-8 md:border-b-0 md:py-10 md:pr-8 md:[&:not(:last-child)]:border-r md:[&:not(:first-child)]:pl-8">
                <p className="text-[10px] font-semibold tracking-[0.2em] text-[#c5a374]">{number}</p>
                <h3 className="mt-5 text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
                <p className="mt-4 leading-7 text-white/65">{detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="provo-work-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <figure className="lg:col-span-6"><img src="/tauro/coffered-ceiling.webp" alt="Detailed custom-home ceiling finish by Tauro Painting" loading="lazy" className="aspect-[5/4] w-full object-cover" /></figure>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>See the standard</p>
            <h2 id="provo-work-heading" className={`${heading} text-slate-950`}>The work carries the conversation.</h2>
            <p className="mt-7 leading-8 text-slate-600">Explore Tauro&apos;s selected work across premium interiors, exteriors, cabinetry, architectural woodwork, stain, and clear finishes. The portfolio shares real Tauro work without attaching unverified Provo project names or locations.</p>
            <div className="mt-8 flex flex-wrap gap-5"><Link to="/projects" className="inline-flex min-h-14 items-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">View selected work <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link><Link to="/locations" className={`${textLink} text-slate-950`}>Where Tauro works <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
          </div>
        </div>
      </section>

      <section aria-labelledby="provo-cta-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-8">
          <div><p className={`${eyebrow} mb-5 text-[#9a6a25]`}>Start with the surfaces</p><h2 id="provo-cta-heading" className={`${heading} max-w-2xl text-slate-950`}>Let&apos;s walk the project before the finish schedule tightens.</h2></div>
          <Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
      </section>
    </div>
  );
}
