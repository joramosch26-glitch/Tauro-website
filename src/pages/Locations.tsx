import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const markets = [
  { name: "Midway", slug: "midway", note: "Custom-home finishing in the Heber Valley" },
  { name: "Alpine", slug: "alpine" },
  { name: "Highland", slug: "highland" },
  { name: "Mapleton", slug: "mapleton" },
  { name: "Springville", slug: "springville" },
  { name: "Orem", slug: "orem" },
  { name: "American Fork", slug: "american-fork" },
  { name: "Pleasant Grove", slug: "pleasant-grove" },
  { name: "Cedar Hills", slug: "cedar-hills" },
  { name: "Lehi", slug: "lehi" },
  { name: "Provo", slug: "provo" },
  { name: "Woodland Hills", slug: "woodland-hills" },
  { name: "Elk Ridge", slug: "elk-ridge" },
];

const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";

export default function Locations() {
  return (
    <div>
      <section aria-labelledby="locations-heading" className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-16 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:py-24">
          <div className="lg:col-span-8">
            <p className={`${eyebrow} mb-7 flex items-center gap-3 text-[#c5a374]`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Service areas</p>
            <h1 id="locations-heading" className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">Where Tauro<br />works.</h1>
          </div>
          <p className="max-w-md text-lg leading-8 text-white/75 lg:col-span-4">Custom-home painting and finishing for Utah projects where the architecture, material, and sequence deserve close attention.</p>
        </div>
      </section>

      <section aria-labelledby="featured-market-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <figure className="lg:col-span-7"><img src="/tauro/exterior-custom-home.webp" alt="Custom home exterior finished by Tauro Painting" className="aspect-[5/4] w-full object-cover" fetchPriority="high" /></figure>
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Featured market · Midway, Utah</p>
            <h2 id="featured-market-heading" className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">A finish process that meets the setting.</h2>
            <p className="mt-7 leading-8 text-slate-600">Tauro has real custom-home work in the Midway area. Explore how we approach interiors, exteriors, cabinetry, stain, wood finishes, and final punch for premium residential projects.</p>
            <Link to="/locations/midway" className="mt-8 inline-flex min-h-14 items-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25]">Explore Midway <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="markets-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7"><p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Utah markets</p><h2 id="markets-heading" className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">Regional coverage.<br />A single standard.</h2></div>
            <p className="leading-8 text-slate-600 lg:col-span-4 lg:col-start-9">Our base is in Orem. We work throughout Utah County and take on select custom-home finishing work in surrounding mountain and resort communities.</p>
          </div>
          <ul className="mt-14 grid border-t border-slate-300 sm:grid-cols-2 lg:grid-cols-3">
            {markets.map((market) => (
              <li key={market.slug} className="border-b border-slate-200 sm:[&:not(:nth-child(2n))]:border-r lg:[&:nth-child(2n)]:border-r-0 lg:[&:not(:nth-child(3n))]:border-r">
                <Link to={`/locations/${market.slug}`} className="group flex min-h-32 flex-col justify-between p-6 transition-colors hover:bg-[#f5f3ee]">
                  <span className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">{market.name}, UT</span>
                  <span className="mt-5 flex items-end justify-between gap-4 text-sm leading-6 text-slate-600"><span>{market.note ?? "Explore Tauro service coverage"}</span><ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0 text-[#9a6a25]" /></span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="bg-slate-950 py-20 text-white lg:py-24">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-8 px-6 lg:flex-row lg:items-end lg:px-8">
          <div><p className={`${eyebrow} mb-5 text-[#c5a374]`}>A project in mind?</p><h2 className="text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl">Let&apos;s walk the project.</h2></div>
          <Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-white px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition-colors hover:bg-[#c5a374] lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </section>
    </div>
  );
}
