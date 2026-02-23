import { content } from "../content";
import { TrendingUp, MapPin, Instagram } from "lucide-react";

type Project = (typeof content.projects)[number];

export default function ProjectsSection() {
  const projects: readonly Project[] = content.projects;

  return (
    <section id="projects" className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">

        {/* Section Header */}
        <div className="reveal reveal-fade-up flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-16">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
              <TrendingUp className="w-4 h-4" />
              Portfolio
            </span>

            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              Featured Projects
            </h2>

            <p className="text-slate-600 text-lg">
              Explore our collection of work on Utah's most exclusive residences.
            </p>
          </div>

          <button
            onClick={() =>
              window.open("https://www.instagram.com/tauropainting", "_blank")
            }
            className="inline-flex items-center gap-2 border border-slate-300 text-slate-700 hover:bg-slate-50 px-4 py-2 rounded-lg transition-colors duration-300 w-fit"
          >
            <Instagram className="w-5 h-5" />
            View on Instagram
          </button>
        </div>

        {/* Projects Grid - Masonry Style */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project, index) => (
            <div
              key={project.title}
              className={`reveal reveal-fade-up group relative overflow-hidden rounded-2xl bg-slate-100 ${
                index === 0 || index === 3
                  ? "md:col-span-2 lg:col-span-2"
                  : ""
              }`}
              style={{ transitionDelay: `${index * 100 + 200}ms` }}
            >
              <div
                className={`relative overflow-hidden ${
                  index === 0 || index === 3
                    ? "h-80 lg:h-96"
                    : "h-72"
                }`}
              >
                <img
                  src={project.image}
                  alt={project.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  loading="lazy"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
              </div>

              {/* Category Badge */}
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 bg-amber-500 rounded-full text-xs font-semibold text-slate-900 uppercase tracking-wider">
                  {project.category}
                </span>
              </div>

              {/* Content Overlay */}
              <div className="absolute bottom-0 left-0 right-0 p-6 translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                <div className="flex items-center gap-2 text-amber-400 text-sm mb-2">
                  <MapPin className="w-4 h-4" />
                  {project.location}
                </div>

                <h3 className="text-xl font-bold text-white mb-1">
                  {project.title}
                </h3>

                <p className="text-white/70 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  {project.description}
                </p>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
}