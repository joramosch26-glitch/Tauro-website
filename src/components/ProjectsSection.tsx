import { ArrowUpRight, Instagram } from "lucide-react";
import { Link } from "react-router-dom";

const projects = [
  {
    image: "/tauro/interior-living.webp",
    title: "Architectural Interior",
    detail: "Custom home · Interior finish system",
    className: "lg:col-span-8 lg:row-span-2",
    height: "min-h-[520px] lg:min-h-[720px]",
  },
  {
    image: "/tauro/entry-door.webp",
    title: "Entry Finish",
    detail: "Doors · Stain & clear finish",
    className: "lg:col-span-4",
    height: "min-h-[350px]",
  },
  {
    image: "/tauro/woodwork-detail.webp",
    title: "Architectural Woodwork",
    detail: "Wood finish · Detail work",
    className: "lg:col-span-4",
    height: "min-h-[350px]",
  },
  {
    image: "/tauro/exterior-residence.webp",
    title: "Exterior Residence",
    detail: "Exterior coating system",
    className: "lg:col-span-4",
    height: "min-h-[430px]",
  },
  {
    image: "/tauro/cabinetry.webp",
    title: "Custom Cabinetry",
    detail: "Cabinet finish · Millwork",
    className: "lg:col-span-4",
    height: "min-h-[430px]",
  },
  {
    image: "/tauro/interior-great-room.webp",
    title: "Refined Interior",
    detail: "Walls · Trim · Architectural details",
    className: "lg:col-span-4",
    height: "min-h-[430px]",
  },
];

export default function ProjectsSection() {
  return (
    <section id="projects" className="bg-white py-24 lg:py-32">
      <div className="mx-auto max-w-[1500px] px-6 lg:px-8">
        <div className="mx-auto mb-14 grid max-w-7xl gap-7 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#9a6a25]">Selected work</p>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl lg:text-6xl">
              The work should speak before we do.
            </h2>
          </div>
          <div className="flex gap-5 lg:col-span-4 lg:justify-end">
            <Link
              to="/projects"
              className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-900"
            >
              Portfolio <ArrowUpRight className="h-4 w-4" />
            </Link>
            <a
              href="https://www.instagram.com/tauropainting"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.14em] text-slate-500 hover:text-slate-900"
            >
              <Instagram className="h-4 w-4" /> Instagram
            </a>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-12 lg:auto-rows-auto">
          {projects.map((project) => (
            <article
              key={project.title}
              className={`group relative overflow-hidden bg-slate-200 ${project.className} ${project.height}`}
            >
              <img
                src={project.image}
                alt={`${project.title} by Tauro Painting`}
                loading="lazy"
                className="absolute inset-0 h-full w-full object-cover transition duration-700 group-hover:scale-[1.025]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/5 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/65">{project.detail}</p>
                <h3 className="text-2xl font-semibold tracking-[-0.02em] text-white sm:text-3xl">{project.title}</h3>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
