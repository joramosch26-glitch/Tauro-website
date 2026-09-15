import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const stages = [
  { title: "Understand the intent", text: "We start with a walkthrough of the surfaces, architectural details, lighting, and expectations. A clear scope connects the designer's vision with the builder's plan." },
  { title: "Prepare for what follows", text: "Protection, sanding, filling, caulking, and early priming establish the foundation. We coordinate the finish sequence around carpentry, flooring, and the other trades." },
  { title: "Carry the standard through", text: "Walls, trim, cabinetry, stain, and wood finishes each require a considered approach. Consistent preparation and controlled application bring the different surfaces together." },
  { title: "Finish the final details", text: "The final punch is part of the work, not an afterthought. We review the details, address touch-ups, and leave protected spaces clean and ready for handoff." },
];
const eyebrow = "text-xs font-semibold uppercase tracking-[0.24em]";
const heading = "text-4xl font-semibold leading-[1.08] tracking-[-0.04em] sm:text-5xl";

export default function About() {
  return (
    <div>
      <section aria-labelledby="about-heading" className="bg-[#f5f3ee]">
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:gap-16 lg:px-8 lg:py-24">
          <div className="min-w-0 lg:col-span-6">
            <p className={`${eyebrow} mb-8 flex items-center gap-3 text-[#9a6a25]`}>
              <span aria-hidden="true" className="h-px w-8 bg-[#a64036]" /> About Tauro
            </p>
            <h1 id="about-heading" className="text-5xl font-semibold leading-[0.98] tracking-[-0.045em] text-slate-950 sm:text-7xl lg:text-[5.5rem]">Built around<br />the finish.</h1>
            <p className="mt-8 max-w-md text-xl leading-8 text-slate-700">We work where craftsmanship, sequencing, and detail matter.</p>
            <p className="mt-6 max-w-md leading-8 text-slate-600">Tauro Painting is a Utah-based finishing partner for custom home builders, designers, and discerning homeowners. Our work connects detailed preparation with the finish quality a demanding home deserves.</p>
          </div>
          <figure className="min-w-0 lg:col-span-6">
            <img src="/tauro/stair-detail.webp" alt="Staircase and architectural millwork finished by Tauro Painting" fetchPriority="high" className="aspect-[4/5] w-full object-cover" />
            <figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">Architectural detail · Tauro Painting</figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="partner-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 lg:grid-cols-12 lg:px-8">
          <p className={`${eyebrow} text-[#9a6a25] lg:col-span-3`}>A finishing partner</p>
          <div className="lg:col-span-9">
            <h2 id="partner-heading" className={`${heading} max-w-3xl text-slate-950`}>Every surface belongs<br className="hidden sm:block" /> to a larger vision.</h2>
            <div className="mt-8 grid gap-6 text-base leading-8 text-slate-600 sm:grid-cols-2 sm:gap-10">
              <p>In a custom home, a wall is never just a wall. It meets a carefully built ceiling, a run of cabinetry, a stained door, or a piece of architectural woodwork. The finish needs to respect those relationships.</p>
              <p>We bring that understanding to high-end custom homes, premium new construction, and residential remodels in Utah County. For us, house painting means carrying a consistent standard across the details—not just covering the surfaces.</p>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="detail-heading" className="bg-slate-950 text-white">
        <div className="grid lg:grid-cols-2">
          <img src="/tauro/woodwork-detail.webp" alt="Architectural wood detail showing Tauro Painting's stain and wood finish work" loading="lazy" className="h-full min-h-[380px] w-full object-cover lg:min-h-[720px]" />
          <div className="flex items-center px-6 py-20 sm:px-12 lg:px-16 xl:px-24">
            <div className="max-w-xl">
              <p className={`${eyebrow} mb-7 text-[#c5a374]`}>Preparation. Precision. Consistency.</p>
              <h2 id="detail-heading" className={`${heading} lg:text-6xl`}>The details are<br />the work.</h2>
              <p className="mt-8 text-lg leading-8 text-white/75">A clean edge. An even tone in the stain. A smooth cabinetry finish. These are the details that give a space its coherence—and they begin with the surface underneath.</p>
              <p className="mt-6 leading-8 text-white/65">Our approach is grounded in detailed prep, protected spaces, and controlled application. From interior painting to architectural wood finishes, the standard stays consistent through the final punch.</p>
              <Link to="/projects" className="mt-9 inline-flex min-h-11 items-center gap-4 border-b border-white/50 py-2 text-xs font-semibold uppercase tracking-[0.14em] hover:text-[#c5a374] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">See the work <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="sequence-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-12 lg:gap-20 lg:px-8">
          <div className="lg:col-span-5">
            <p className={`${eyebrow} mb-6 text-[#9a6a25]`}>From prep to final punch</p>
            <h2 id="sequence-heading" className={`${heading} text-slate-950`}>Good finishes<br />follow a clear plan.</h2>
            <p className="mt-7 leading-8 text-slate-600">Luxury residential construction asks every trade to understand what comes before and what comes next. We work with builders and designers to make the finishing process part of that sequence.</p>
          </div>
          <ol className="lg:col-span-7">
            {stages.map((stage, index) => (
              <li key={stage.title} className="grid grid-cols-[2rem_1fr] gap-4 border-t border-slate-300 py-7 first:pt-6 sm:gap-6">
                <span className="pt-1 text-xs tracking-[0.1em] text-[#9a6a25]">0{index + 1}</span>
                <div><h3 className="text-xl font-semibold tracking-[-0.02em] text-slate-950">{stage.title}</h3><p className="mt-3 leading-7 text-slate-600">{stage.text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="accountability-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-7xl px-6 lg:px-8">
          <div className="grid items-end gap-10 lg:grid-cols-12">
            <div className="lg:col-span-7"><p className={`${eyebrow} mb-6 text-[#9a6a25]`}>Professional standards</p><h2 id="accountability-heading" className={`${heading} max-w-xl text-slate-950`}>Care for the home.<br />Respect for the team.</h2></div>
            <p className="max-w-lg leading-8 text-slate-600 lg:col-span-5">Clear communication, clean execution, and accountability are part of the finish. We work closely with the people shaping each home, keeping expectations visible from the initial scope to the final walkthrough.</p>
          </div>
          <div className="mt-12 grid gap-8 border-t border-slate-300 pt-8 sm:grid-cols-2">
            <div><h3 className="text-lg font-semibold text-slate-950">Licensed & insured</h3><p className="mt-2 text-sm text-slate-600">Utah contractor license S270</p></div>
            <div><h3 className="text-lg font-semibold text-slate-950">UVHBA member</h3><p className="mt-2 text-sm text-slate-600">Utah Valley Home Builders Association</p></div>
          </div>
          <figure className="mt-14"><img src="/tauro/interior-living.webp" alt="Completed custom home interior with architectural finishes by Tauro Painting" loading="lazy" className="h-[340px] w-full object-cover sm:h-[480px] lg:h-[560px]" /><figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-slate-500">A shared vision, carried through the finish.</figcaption></figure>
        </div>
      </section>

      <section aria-labelledby="about-cta" className="bg-slate-950 px-6 py-20 text-white lg:px-8 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className={`${eyebrow} mb-6 text-[#c5a374]`}>Start with a conversation</p>
          <h2 id="about-cta" className={`${heading} lg:text-6xl`}>Let's talk about<br />the home you're building.</h2>
          <p className="mx-auto mt-7 max-w-xl text-lg leading-8 text-white/70">Bring us into the details. We can walk the project, understand the scope, and talk through the finish.</p>
          <Link to="/contact" className="mt-9 inline-flex min-h-14 items-center justify-center gap-4 bg-white px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition-colors hover:bg-[#c5a374] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Request a Walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4 shrink-0" /></Link>
        </div>
      </section>
    </div>
  );
}
