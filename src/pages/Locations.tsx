import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const textLink = "inline-flex min-h-11 items-center gap-4 border-b border-current py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

const coverage = [
  "Orem · Tauro's business base", "Alpine & Highland", "American Fork & Pleasant Grove", "Cedar Hills & Lehi",
  "Mapleton & Springville", "Provo & Utah County", "Woodland Hills & Elk Ridge", "Heber Valley & surrounding communities",
];

const featuredMarkets = [
  {
    location: "Midway, Utah", title: "A finish process that meets the setting.", image: "/tauro/exterior-custom-home.webp",
    alt: "Tauro Painting exterior finish work on a custom home", href: "/locations/midway", link: "Explore Midway",
    description: "Tauro has completed custom-home work in the Midway area. Explore a considered approach to house painting, cabinetry, stain, wood finishes, interiors, exteriors, and final punch.",
  },
  {
    location: "Park City / Deer Valley, Utah", title: "Finish standards for exceptional homes.", image: "/tauro/exterior-residence.webp",
    alt: "Tauro Painting exterior finish work on a refined custom residence", href: "/locations/park-city-deer-valley", link: "Explore Park City / Deer Valley",
    description: "For high-end residential painting where materials, architectural woodwork, cabinetry, stain, and clear finishes must hold up to close inspection.",
  },
];

export default function Locations() {
  return (
    <div>
      <section aria-labelledby="locations-heading" className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:py-24">
          <div className="lg:col-span-8"><p className={`${eyebrow} mb-7 flex items-center gap-3 text-[#c5a374]`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Where Tauro works</p><h1 id="locations-heading" className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">Built for the places<br />where detail matters.</h1></div>
          <p className="max-w-md text-lg leading-8 text-white/75 lg:col-span-4">Premium residential finishing for custom homes across Utah County and select mountain communities—where builders, designers, materials, and sequencing demand close attention.</p>
        </div>
      </section>

      <section aria-labelledby="flagship-markets-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end"><div className="lg:col-span-7"><p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Featured markets</p><h2 id="flagship-markets-heading" className="max-w-3xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">Two markets. One exacting finish standard.</h2></div><p className="leading-8 text-slate-600 lg:col-span-4 lg:col-start-9">Explore the markets where Tauro&apos;s premium location pages are ready to guide a custom-home conversation.</p></div>
          <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-12">
            {featuredMarkets.map((market) => (
              <article key={market.href} className="flex flex-col">
                <figure className="overflow-hidden bg-slate-200"><img src={market.image} alt={market.alt} fetchPriority="high" className="aspect-[5/4] w-full object-cover transition-transform duration-700 hover:scale-[1.02]" /></figure>
                <div className="flex flex-1 flex-col pt-8"><p className={`${eyebrow} text-[#9a6a25]`}>{market.location}</p><h3 className="mt-5 text-4xl font-semibold leading-[1.06] tracking-[-0.04em] text-slate-950">{market.title}</h3><p className="mt-5 max-w-xl leading-8 text-slate-600">{market.description}</p><Link to={market.href} className={`${textLink} mt-8 w-fit text-slate-950`}>{market.link} <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section aria-labelledby="base-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8"><div className="lg:col-span-5"><p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Orem, Utah</p><h2 id="base-heading" className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">Our business base. A broader reach.</h2></div><div className="lg:col-span-6 lg:col-start-7"><p className="text-lg leading-8 text-slate-600">Tauro is based in Orem and works throughout Utah County, coordinating with custom-home builders, designers, and homeowners on premium interior and exterior finishing. The goal is consistent work across the surfaces that define a home: walls, millwork, cabinetry, stain, wood finishes, and exterior details.</p><Link to="/contact" className={`${textLink} mt-8 text-slate-950`}>Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div></div>
      </section>

      <section aria-labelledby="coverage-heading" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8"><div className="lg:col-span-5"><p className={`${eyebrow} mb-6 text-[#c5a374]`}>Regional coverage</p><h2 id="coverage-heading" className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">Other areas we serve.</h2><p className="mt-7 max-w-md leading-8 text-white/70">For the right custom-home project, Tauro serves these Utah County and surrounding communities. Tell us where the project stands and what finishes are involved.</p></div><ul className="grid border-t border-white/20 sm:grid-cols-2 lg:col-span-6 lg:col-start-7">{coverage.map((area) => <li key={area} className="border-b border-white/20 px-0 py-5 text-lg font-medium tracking-[-0.02em] text-white/85 sm:odd:pr-6 sm:even:pl-6">{area}</li>)}</ul></div>
      </section>

      <section aria-labelledby="locations-cta-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-8"><div><p className={`${eyebrow} mb-5 text-[#9a6a25]`}>A project in mind?</p><h2 id="locations-cta-heading" className="max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">Let&apos;s walk the project before the sequence gets complicated.</h2></div><Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></div>
      </section>
    </div>
  );
}
