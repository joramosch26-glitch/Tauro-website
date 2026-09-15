import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const links = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Projects", to: "/projects" },
  { label: "Locations", to: "/locations" },
  { label: "Contact", to: "/contact" },
];

export default function NotFound() {
  return (
    <section aria-labelledby="not-found-heading" className="min-h-[70vh] bg-[#f5f3ee] text-slate-950">
      <div className="mx-auto grid max-w-7xl gap-12 px-6 py-20 lg:grid-cols-12 lg:items-end lg:gap-16 lg:px-8 lg:py-28">
        <div className="lg:col-span-8">
          <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]"><span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />404 · Page not found</p>
          <h1 id="not-found-heading" className="max-w-4xl text-5xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-7xl lg:text-[5.8rem]">This page is<br />not in the plan.</h1>
        </div>
        <div className="lg:col-span-4">
          <p className="text-lg leading-8 text-slate-600">The page could not be found. Continue with Tauro&apos;s services, selected work, service areas, or project contact.</p>
          <Link to="/contact" className="mt-8 inline-flex min-h-14 items-center gap-5 bg-slate-950 px-6 py-4 text-xs font-semibold uppercase tracking-[0.12em] text-white transition-colors hover:bg-[#9a6a25] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">Request a walkthrough <ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link>
        </div>
      </div>
      <nav aria-label="Helpful pages" className="border-t border-slate-300 bg-white">
        <ul className="mx-auto grid max-w-7xl px-6 sm:grid-cols-2 lg:grid-cols-5 lg:px-8">
          {links.map((link) => <li key={link.to} className="border-b border-slate-200 lg:border-b-0 lg:[&:not(:last-child)]:border-r"><Link to={link.to} className="flex min-h-24 items-center justify-between gap-4 py-6 text-sm font-semibold uppercase tracking-[0.12em] text-slate-950 transition-colors hover:text-[#9a6a25] sm:px-5 lg:px-6">{link.label}<ArrowUpRight aria-hidden="true" className="h-4 w-4" /></Link></li>)}
        </ul>
      </nav>
    </section>
  );
}
