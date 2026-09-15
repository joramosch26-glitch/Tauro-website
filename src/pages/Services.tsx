import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  { label: "Interior painting", title: "A considered finish. In every room.", image: "interior-open-plan.webp", alt: "Custom home interior with carefully finished walls, ceilings, and millwork by Tauro Painting", description: "Light reveals everything. We prepare and finish walls, ceilings, trim, and doors with the consistency that custom homes demand—from the first coat of primer to the final detail.", details: ["Walls & ceilings", "Trim & interior doors", "New construction & remodels"] },
  { label: "Exterior painting", title: "Architecture, protected.", image: "exterior-custom-home.webp", alt: "Modern Utah custom home exterior finished by Tauro Painting", description: "An exterior finish has to do more than look beautiful. Thoughtful surface preparation and durable coating systems protect the home's character through Utah's changing seasons.", details: ["Siding & stucco", "Exterior wood & trim", "Doors & window details"] },
];
const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const heading = "text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl";
const textLink = "inline-flex min-h-11 items-center gap-4 border-b border-current py-2 text-xs font-semibold uppercase tracking-[0.14em] transition-colors hover:text-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4";

export default function Services() {
  return (
    <div>
      <section aria-labelledby="services-heading" className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-12 lg:grid-cols-12 lg:items-end lg:px-8 lg:pb-16 lg:pt-16">
          <div className="lg:col-span-8">
            <p className={`${eyebrow} mb-7 flex items-center gap-3 text-white/65`}><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />Our expertise</p>
            <h1 id="services-heading" className="max-w-3xl text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]">Built for<br />custom homes.</h1>
          </div>
          <div className="lg:col-span-4 lg:pb-1">
            <p className="max-w-md text-lg leading-8 text-white/75">Precision finishing systems for interiors, exteriors, cabinetry, and architectural woodwork.</p>
            <Link to="/contact" className={`${textLink} mt-6 text-white`}>Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
        <figure>
          <img src="/tauro/interior-great-room.webp" alt="Architectural great room with detailed ceiling and interior finishes by Tauro Painting" fetchPriority="high" className="h-[360px] w-full object-cover object-center sm:h-[480px] lg:h-[580px]" />
          <figcaption className="mx-auto flex max-w-7xl flex-wrap justify-between gap-3 px-6 py-5 text-[10px] uppercase tracking-[0.2em] text-white/60 lg:px-8"><span>Real spaces. Refined finishes.</span><span>Tauro Painting · Utah</span></figcaption>
        </figure>
      </section>

      <section aria-labelledby="approach-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-12 lg:px-8">
          <p className={`${eyebrow} text-[#9a6a25] lg:col-span-3`}>The finish is in the details</p>
          <div className="lg:col-span-9">
            <h2 id="approach-heading" className={`${heading} text-slate-950`}>One standard.<br />Every surface.</h2>
            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-600">Our house painting work in Utah County starts long before the finish coat. We coordinate with builders, designers, and homeowners to bring preparation, material selection, and precise execution into one considered process.</p>
          </div>
        </div>
      </section>

      {services.map((service, index) => (
        <section key={service.label} aria-labelledby={`service-${index}`} className={index === 0 ? "bg-white py-20 lg:py-28" : "bg-[#f5f3ee] py-20 lg:py-28"}>
          <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
            <figure className={`min-w-0 lg:col-span-7 ${index === 1 ? "lg:order-2" : ""}`}>
              <img src={`/tauro/${service.image}`} alt={service.alt} loading="lazy" className="aspect-[4/5] w-full object-cover sm:aspect-[6/5] lg:aspect-[4/5]" />
              <figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">{service.label} · Tauro Painting</figcaption>
            </figure>
            <div className="min-w-0 lg:col-span-5">
              <p className={`${eyebrow} mb-6 text-[#9a6a25]`}><span className="mr-4 text-slate-400">0{index + 1}</span>{service.label}</p>
              <h2 id={`service-${index}`} className={`${heading} text-slate-950`}>{service.title}</h2>
              <p className="mt-7 text-base leading-8 text-slate-600">{service.description}</p>
              <ul className="mt-8 border-t border-slate-300">{service.details.map(detail => <li key={detail} className="border-b border-slate-200 py-4 text-sm text-slate-700">{detail}</li>)}</ul>
            </div>
          </div>
        </section>
      ))}

      <section aria-labelledby="woodwork-heading" className="bg-slate-950 py-20 text-white lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="mb-12 grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-7">
              <p className={`${eyebrow} mb-6 text-[#c5a374]`}>03 <span className="ml-4">Cabinetry & wood finishes</span></p>
              <h2 id="woodwork-heading" className={`${heading} max-w-xl lg:text-6xl`}>Material character.<br /><span className="text-white/65">Meticulous finish.</span></h2>
            </div>
            <p className="max-w-lg text-base leading-8 text-white/70 lg:col-span-5">Smooth enamel, carefully applied stain, and clear finishes bring depth to cabinetry, doors, and architectural woodwork. We work with the grain, the design, and the light to make every detail feel intentional.</p>
          </div>
          <div className="grid items-start gap-8 sm:grid-cols-12">
            <figure className="sm:col-span-7"><img src="/tauro/office-woodwork.webp" alt="Custom architectural woodwork and cabinetry finished by Tauro Painting" loading="lazy" className="aspect-[4/5] w-full object-cover" /><figcaption className="mt-4 text-xs text-white/60">Cabinetry & architectural millwork</figcaption></figure>
            <figure className="sm:col-span-5 sm:mt-24"><img src="/tauro/entry-door.webp" alt="Stained wood entry door with a clear finish by Tauro Painting" loading="lazy" className="aspect-[4/5] w-full object-cover" /><figcaption className="mt-4 text-xs text-white/60">Stain, clear coats & custom doors</figcaption></figure>
          </div>
        </div>
      </section>

      <section aria-labelledby="coordination-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:px-8">
          <div className="lg:col-span-6"><p className={`${eyebrow} mb-6 text-[#9a6a25]`}>04 <span className="ml-4">Custom homes & builder coordination</span></p><h2 id="coordination-heading" className={`${heading} max-w-lg text-slate-950`}>Part of the plan.<br />From the beginning.</h2></div>
          <div className="lg:col-span-5 lg:col-start-8">
            <p className="text-lg leading-8 text-slate-600">Early priming. Protected surfaces. A finish sequence that works with the other trades. We coordinate our work around the build, with clear communication from the initial walkthrough through final punch.</p>
            <p className="mt-6 leading-7 text-slate-600">Interior painting, exterior painting, cabinetry, and wood finishes for custom homes and remodels across Utah County—including Orem, Provo, Lehi, American Fork, Pleasant Grove, Alpine, Highland, Saratoga Springs, Eagle Mountain, Mapleton, and Springville.</p>
            <Link to="/locations" className={`${textLink} mt-6 text-slate-900`}>Explore our service areas <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>

      <section aria-labelledby="services-cta" className="bg-white py-20 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-10 px-6 lg:flex-row lg:items-end lg:px-8">
          <div><p className={`${eyebrow} mb-5 text-[#9a6a25]`}>Let's talk about your project</p><h2 id="services-cta" className={`${heading} max-w-2xl text-slate-950`}>The right finish starts<br className="hidden sm:block" /> with a conversation.</h2></div>
          <div className="flex w-full shrink-0 flex-col items-start gap-5 lg:w-auto">
            <Link to="/contact" className="inline-flex min-h-14 w-full items-center justify-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 lg:w-auto">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
            <Link to="/projects" className={textLink}>See the work <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
          </div>
        </div>
      </section>
    </div>
  );
}
