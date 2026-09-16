import "./index.css";
import seo from "./seo.json";
import { useState, useEffect, useRef } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  useLocation,
  useNavigate,
} from "react-router-dom";

import Services from "./pages/Services";
import Projects from "./pages/Projects";
import About from "./pages/About";
import Contact from "./pages/Contact";
import HomeRoute from "./pages/HomeRoute";
import Orem from "./pages/Orem";
import Provo from "./pages/Provo"
import Alpine from "./pages/Alpine"
import Highland from "./pages/Highland"
import Mapleton from "./pages/Mapleton"
import Lehi from "./pages/Lehi"
import AmericanFork from "./pages/American-Fork"
import PleasantGrove from "./pages/Pleasant-Grove"
import CedarHills from "./pages/Cedar-Hills"
import WoodlandHills from "./pages/Woodland-Hills"
import ElkRidge from "./pages/Elk-Ridge"
import Springville from "./pages/Springville"
import Midway from "./pages/Midway"
import ParkCityDeerValley from "./pages/ParkCityDeerValley"
import Locations from "./pages/Locations";
import NotFound from "./pages/NotFound";


import AutoReveal from "./components/AutoReveal";

import {
  Phone,
  Mail,
  Instagram,
  Facebook,
  Menu,
  X,
} from "lucide-react";

const routeMetadata = new Map(seo.routes.map((route) => [route.route, route]));
const pageSchemas = seo.pageSchemas as Record<string, Array<{ name: string; item: string }>>;

function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null);
  const mobileMenuRef = useRef<HTMLDivElement>(null);

  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.hash) {
      document.getElementById(location.hash.slice(1))?.scrollIntoView();
    } else {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
    }
  }, [location.pathname, location.hash]);

  // ✅ Normalize trailing slashes: "/services/" -> "/services"
  useEffect(() => {
    const { pathname, search, hash } = location;

    if (pathname.length > 1 && pathname.endsWith("/")) {
      const normalized = pathname.replace(/\/+$/, "");
      navigate(`${normalized}${search}${hash}`, { replace: true });
    }
  }, [location.pathname, location.search, location.hash, navigate]);

  useEffect(() => {
    const normalizedPath =
      location.pathname.length > 1
        ? location.pathname.replace(/\/+$/, "").toLowerCase()
        : location.pathname.toLowerCase();
    const routeMeta = routeMetadata.get(normalizedPath);
    const data = routeMeta ?? {
      ...seo.notFound,
      canonical: `${seo.productionOrigin}${normalizedPath}`,
    };
    const robots = routeMeta ? "index,follow" : seo.notFound.robots;

    const upsertMeta = (
      selector: string,
      attrName: "property" | "name",
      attrValue: string,
      contentValue: string,
    ) => {
      let element = document.querySelector(selector) as HTMLMetaElement | null;
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attrName, attrValue);
        document.head.appendChild(element);
      }
      element.setAttribute("content", contentValue);
    };

    document.title = data.title;

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement("link");
      canonical.rel = "canonical";
      document.head.appendChild(canonical);
    }
    canonical.href = data.canonical;

    upsertMeta('meta[name="description"]', "name", "description", data.description);
    upsertMeta('meta[name="robots"]', "name", "robots", robots);
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[property="og:site_name"]', "property", "og:site_name", seo.siteName);
    upsertMeta('meta[property="og:title"]', "property", "og:title", data.title);
    upsertMeta('meta[property="og:description"]', "property", "og:description", data.description);
    upsertMeta('meta[property="og:url"]', "property", "og:url", data.canonical);
    upsertMeta('meta[property="og:image"]', "property", "og:image", seo.socialImage.url);
    upsertMeta('meta[property="og:image:width"]', "property", "og:image:width", String(seo.socialImage.width));
    upsertMeta('meta[property="og:image:height"]', "property", "og:image:height", String(seo.socialImage.height));
    upsertMeta('meta[name="twitter:card"]', "name", "twitter:card", "summary_large_image");
    upsertMeta('meta[name="twitter:title"]', "name", "twitter:title", data.title);
    upsertMeta('meta[name="twitter:description"]', "name", "twitter:description", data.description);
    upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", seo.socialImage.url);

    let businessScript = document.getElementById("ld-json-business") as HTMLScriptElement | null;
    if (!businessScript) {
      businessScript = document.createElement("script");
      businessScript.id = "ld-json-business";
      businessScript.type = "application/ld+json";
      document.head.appendChild(businessScript);
    }
    businessScript.text = JSON.stringify(seo.business);

    const breadcrumbs = pageSchemas[normalizedPath];
    let pageScript = document.getElementById("ld-json-page") as HTMLScriptElement | null;
    if (breadcrumbs && routeMeta) {
      if (!pageScript) {
        pageScript = document.createElement("script");
        pageScript.id = "ld-json-page";
        pageScript.type = "application/ld+json";
        document.head.appendChild(pageScript);
      }
      const webpageId = `${routeMeta.canonical}#webpage`;
      const breadcrumbId = `${routeMeta.canonical}#breadcrumb`;
      pageScript.text = JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "WebPage",
            "@id": webpageId,
            url: routeMeta.canonical,
            name: routeMeta.title,
            description: routeMeta.description,
            about: { "@id": seo.business["@id"] },
            breadcrumb: { "@id": breadcrumbId },
          },
          {
            "@type": "BreadcrumbList",
            "@id": breadcrumbId,
            itemListElement: breadcrumbs.map((item, index) => ({
              "@type": "ListItem",
              position: index + 1,
              name: item.name,
              item: item.item,
            })),
          },
        ],
      });
    } else {
      pageScript?.remove();
    }
  }, [location.pathname]);

  const isHome = location.pathname === "/";
  const navSolid = !isHome || isScrolled;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const focusFrame = window.requestAnimationFrame(() => {
      mobileMenuRef.current?.querySelector<HTMLElement>("a")?.focus();
    });
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsMobileMenuOpen(false);
      mobileMenuButtonRef.current?.focus();
    };

    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileMenuOpen]);

  const navLinks = [
    { name: "Home", to: "/" },
    { name: "Services", to: "/services" },
    { name: "Projects", to: "/projects" },
    { name: "About", to: "/about" },
    { name: "Contact", to: "/contact" },
  ];

  // ✅ SPA-safe: from any route -> navigate home -> then scroll to section
  const scrollToSection = (href: string) => {
    const doScroll = () => {
      const element = document.querySelector(href);
      if (element) element.scrollIntoView({ behavior: "smooth", block: "start" });
    };

    // Always close mobile menu
    setIsMobileMenuOpen(false);

    if (isHome) {
      doScroll();
      return;
    }

    navigate("/");
    window.setTimeout(doScroll, 50);
  };

  return (
    <div className="min-h-screen bg-white">
      <a href="#main-content" className="fixed left-4 top-4 z-[100] -translate-y-24 bg-white px-4 py-3 text-sm font-semibold text-slate-950 shadow-lg transition-transform focus:translate-y-0">
        Skip to main content
      </a>
      {/* Auto-reveal styles + behavior (scoped to <main>) */}
      <AutoReveal />

      {/* Navigation */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          navSolid
            ? "bg-white/95 backdrop-blur-md shadow-sm py-4"
            : "bg-transparent py-6"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("#home");
              }}
              className="flex items-center gap-3 group"
            >
              <img
                src="/tauro/logo-tauro.png"
                alt="Tauro Painting"
                className={`h-11 w-auto object-contain transition ${navSolid ? "" : "brightness-0 invert"}`}
              />
            </a>

            {/* Desktop Navigation (underline animado) */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <NavLink
                  key={link.name}
                  to={link.to}
                  className={({ isActive }) =>
                    `relative group px-1 py-2 text-sm font-medium transition-colors ${
                      navSolid
                        ? "text-slate-700 hover:text-slate-900"
                        : "text-white/80 hover:text-white"
                    } ${
                      isActive
                        ? navSolid
                          ? "text-amber-600"
                          : "text-amber-400"
                        : ""
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      {link.name}
                      <span
                        className={`pointer-events-none absolute left-0 right-0 -bottom-1 h-0.5 bg-amber-500 origin-left transform transition-transform duration-300 ${
                          isActive
                            ? "scale-x-100"
                            : "scale-x-0 group-hover:scale-x-100"
                        }`}
                      />
                    </>
                  )}
                </NavLink>
              ))}
            </div>

            {/* CTA Button */}
            <div className="hidden lg:block">
              <Link
                to="/contact"
                className={`inline-flex items-center justify-center px-5 py-3 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  navSolid
                    ? "bg-slate-950 text-white hover:bg-amber-500 hover:text-slate-950"
                    : "border border-white/35 bg-white/5 text-white backdrop-blur-sm hover:bg-white hover:text-slate-950"
                }`}
              >
                Request a walkthrough
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <button
              ref={mobileMenuButtonRef}
              type="button"
              aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMobileMenuOpen}
              aria-controls="mobile-navigation"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className={`lg:hidden p-2 rounded-lg transition-colors ${
              navSolid ? "text-slate-900" : "text-white"
             }`}
            >
              {isMobileMenuOpen ? (
                <X className="w-6 h-6" />
              ) : (
                <Menu className="w-6 h-6" />
              )}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div ref={mobileMenuRef} id="mobile-navigation" className="lg:hidden mt-4 pb-4 border-t border-white/10 pt-4 bg-white/95 backdrop-blur-md rounded-xl mt-2 p-4">
              <div className="flex flex-col gap-3">
                {navLinks.map((link) => (
                  <Link
                    key={link.name}
                    to={link.to}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="text-slate-700"
                  >
                    {link.name}
                  </Link>
                ))}
                <Link
                  to="/contact"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-2 inline-flex w-full items-center justify-center bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                >
                  Request a walkthrough
                </Link>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Routes */}
      <main id="main-content" tabIndex={-1} className={isHome ? "" : "pt-28"}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/services" element={<Services />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<NotFound />} />
          <Route path="/locations/orem" element={<Orem />} />
          <Route path="/locations/provo" element={<Provo />} />
          <Route path="/locations/alpine" element={<Alpine />} />
          <Route path="/locations/highland" element={<Highland />} />
          <Route path="/locations/mapleton" element={<Mapleton />} />
          <Route path="/locations/lehi" element={<Lehi />} />
          <Route path="/locations/american-fork" element={<AmericanFork />} />
          <Route path="/locations/pleasant-grove" element={<PleasantGrove />} />
          <Route path="/locations/springville" element={<Springville />} />
          <Route path="/locations/cedar-hills" element={<CedarHills />} />
          <Route path="/locations/woodland-hills" element={<WoodlandHills />} />
          <Route path="/locations/elk-ridge" element={<ElkRidge />} />
          <Route path="/locations/midway" element={<Midway />} />
          <Route path="/locations/park-city-deer-valley" element={<ParkCityDeerValley />} />
          <Route path="/locations" element={<Locations />} />
        </Routes>
      </main>

      {/* Footer (global) */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <img
                  src="/tauro/logo-tauro.png"
                  alt="Tauro Painting"
                  className="h-16 w-auto brightness-0 invert"
                />
              </div>

              <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                High-end painting, cabinetry, stain, wood finishes, and exterior systems for custom homes and premium residential construction in Utah.
              </p>

              <div className="flex gap-3">
                <a
                  href="https://www.instagram.com/tauropainting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-amber-500 hover:text-slate-900 transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.facebook.com/tauropainting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center hover:bg-amber-500 hover:text-slate-900 transition-colors"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-6 text-white">Quick Links</h4>
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <Link
                      className="text-slate-400 hover:text-white transition-colors"
                      to={link.to}
                    >
                      {link.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-6 text-white">Contact</h4>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-500" />
                  <a
                    className="hover:text-white transition-colors"
                    href="tel:8019289520"
                  >
                    (801) 928-9520
                  </a>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-500" />
                  <a
                    className="hover:text-white transition-colors"
                    href="mailto:tauropaintingutah@gmail.com"
                  >
                    tauropaintingutah@gmail.com
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Tauro Painting LLC. All rights
              reserved.
            </p>
            <p className="text-slate-500 text-sm">License S270 • UVHBA Member</p>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default App;
