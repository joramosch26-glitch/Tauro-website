import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const services = [
  {
    eyebrow: "01 · Interior",
    title: "Custom Home Interiors",
    description:
      "Walls, ceilings, trim, doors, and architectural details finished with the consistency high-end construction demands.",
    image: "/tauro/interior-open-plan.webp",
    alt: "Open-plan custom home interior painted by Tauro Painting",
  },
  {
    eyebrow: "02 · Woodwork",
    title: "Cabinetry & Fine Finishes",
    description:
      "Factory-smooth enamel, stained wood, clear coats, and detailed millwork finishes built around the design intent.",
    image: "/tauro/cabinetry.webp",
    alt: "Custom cabinetry and millwork finish by Tauro Painting",
  },
  {
    eyebrow: "03 · Exterior",
    title: "Exterior Systems",
    description:
      "Careful preparation and durable coating systems for custom residences exposed to Utah's demanding climate.",
    image: "/tauro/exterior-custom-home.webp",
    alt: "Modern custom home exterior finished by Tauro Painting",
  },
];

export default function ServicesSection() {
  return (
    <section id="services" className="bg-[#f5f3ee] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="mb-14 grid gap-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-7">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#9a6a25]">
              What we do
            </p>
            <h2 className="max-w-4xl text-4xl font-semibold tracking-[-0.035em] text-slate-950 sm:text-5xl lg:text-6xl">
              Built for the level of detail custom homes require.
            </h2>
          </div>
          <div className="lg:col-span-4 lg:col-start-9">
            <p className="text-base leading-7 text-slate-600">
              We coordinate with builders, designers, and homeowners from early prep through final punch,
              protecting the schedule while holding the finish to a higher standard.
            </p>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          {services.map((service) => (
            <article key={service.title} className="group overflow-hidden bg-white">
              <div className="relative aspect-[4/5] overflow-hidden bg-slate-200">
                <img
                  src={service.image}
                  alt={service.alt}
                  loading="lazy"
                  className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.035]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/55 via-transparent to-transparent" />
                <p className="absolute left-6 top-6 text-xs font-semibold uppercase tracking-[0.22em] text-white/80">
                  {service.eyebrow}
                </p>
              </div>
              <div className="p-7 lg:p-8">
                <h3 className="text-2xl font-semibold tracking-[-0.025em] text-slate-950">{service.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{service.description}</p>
              </div>
            </article>
          ))}
        </div>

        <div className="mt-10 flex justify-end">
          <Link
            to="/services"
            className="inline-flex items-center gap-2 border-b border-slate-900 pb-1 text-sm font-semibold uppercase tracking-[0.14em] text-slate-900"
          >
            View all services <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
