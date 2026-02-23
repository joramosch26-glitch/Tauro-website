import { content } from "../content";

type Project = (typeof content.projects)[number];

function tileClass(index: number) {
  switch (index % 6) {
    case 0:
      return "lg:col-span-2 lg:row-span-2";
    case 1:
      return "lg:col-span-1 lg:row-span-2";
    case 2:
      return "lg:col-span-1 lg:row-span-2";
    case 3:
      return "lg:col-span-2 lg:row-span-2";
    case 4:
      return "lg:col-span-1 lg:row-span-2";
    case 5:
      return "lg:col-span-1 lg:row-span-2";
    default:
      return "";
  }
}

export default function Projects() {
  const projects = content.projects as readonly Project[];

  return (
    <main className="min-h-screen">
      <section className="mx-auto max-w-6xl px-4 py-16">
        <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
          <header>
            <h1 className="text-3xl font-bold tracking-tight">Featured Projects</h1>
            <p className="mt-2 text-muted-foreground">
              Explore our collection of work on Utah&apos;s most exclusive residences.
            </p>
          </header>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:auto-rows-[220px]">
          {projects.map((p, idx) => {
            const category = (p as unknown as { category?: string }).category;
            const location = (p as unknown as { location?: string }).location;

            return (
              <article
  key={`${(p as any).id ?? (p as any).title ?? "project"}-${idx}`}
  className={[
    "group relative overflow-hidden rounded-2xl border bg-card",
    tileClass(idx),
  ].join(" ")}
>
                <img
                  src={(p as any).image}
                  alt={(p as any).title}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                  loading="lazy"
                />

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {category ? (
                  <div className="absolute left-4 top-4">
                    <span className="inline-flex items-center rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-black">
                      {String(category).toUpperCase()}
                    </span>
                  </div>
                ) : null}

                <div className="absolute bottom-0 left-0 right-0 p-5">
                  {location ? (
                    <p className="mb-1 text-xs font-medium text-orange-200/90">
                      {location}
                    </p>
                  ) : null}

                  <h2 className="text-lg font-semibold text-white">{(p as any).title}</h2>

                  {(p as any).description ? (
                    <p className="mt-1 line-clamp-2 text-sm text-white/80">
                      {(p as any).description}
                    </p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}