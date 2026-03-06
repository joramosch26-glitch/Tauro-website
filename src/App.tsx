import "./index.css";
import { content } from "./content";
import { useState, useEffect } from "react";
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
import Locations from "./pages/Locations";


import AutoReveal from "./components/AutoReveal";

import {
  Paintbrush,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Menu,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();

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

    const metaByPath: Record<string, { title: string; desc: string }> = {
  "/": {
    title: "House Painters in Utah County | Tauro Painting",
    desc:
      "Premium interior and exterior house painters in Utah County. Serving Orem, Provo, Lehi, and surrounding areas. Free estimates.",
  },
  "/services": {
    title: "Painting Services in Utah County | Tauro Painting",
    desc:
      "Interior painting, exterior painting, cabinet refinishing, and detailed prep across Utah County. Fast scheduling and free estimates.",
  },
  "/projects": {
    title: "Painting Projects in Utah County | Tauro Painting",
    desc:
      "Explore recent residential and commercial painting projects completed across Utah County with premium finishes and meticulous prep.",
  },
  "/about": {
    title: "About Tauro Painting | Utah County",
    desc:
      "Learn about Tauro Painting—craftsmanship, premium materials, and a refined process built for premium finishes across Utah County.",
  },
  "/contact": {
    title: "Contact Tauro Painting | Free Estimate",
    desc:
      "Request a free estimate from Tauro Painting. Interior and exterior painting across Utah County. Fast response and scheduling.",
  },
  "/locations": {
  title: "Utah County Locations | Tauro Painting",
  desc:
    "Explore the Utah County areas we serve—starting with Orem. Premium interior and exterior painting with disciplined prep and refined finishes.",
},
"/locations/orem": {
  title: "House Painters in Orem, UT | Tauro Painting",
  desc:
    "Professional interior and exterior house painters in Orem, Utah. Premium finishes, detailed preparation, and free estimates.",
},
"/locations/provo": {
  title: "House Painting in Provo, UT | Tauro Painting",
  desc:
    "Tauro Painting provides interior and exterior house painting in Provo, Utah. Clean work, premium finishes, and reliable service for Utah County homeowners.",
},
"/locations/Alpine": {
  title: "House Painting in Alpine, UT | Tauro Painting",
  desc:
    "Tauro Painting provides interior and exterior house painting in Alpine, Utah. Clean work, premium finishes, and reliable service for Utah County homeowners.",
},
};


    const fallback = metaByPath["/"];
    const data = metaByPath[normalizedPath] ?? fallback;

    // Run after other effects to "win" if something else sets title/desc
    const t = window.setTimeout(() => {
      document.title = data.title;

      // Canonical dinámico por ruta (usando path normalizado)
      const origin = window.location.origin;
      const canonicalUrl = `${origin}${normalizedPath}`;

      let canonical = document.querySelector(
        'link[rel="canonical"]'
      ) as HTMLLinkElement | null;

      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }

      canonical.href = canonicalUrl;

      // OG/Twitter dinámico por ruta (previews sociales)
      const upsertMeta = (
        selector: string,
        attrName: "property" | "name",
        attrValue: string,
        contentValue: string
      ) => {
        let el = document.querySelector(selector) as HTMLMetaElement | null;
        if (!el) {
          el = document.createElement("meta");
          el.setAttribute(attrName, attrValue);
          document.head.appendChild(el);
        }
        el.setAttribute("content", contentValue);
      };

      // Asegurar tags base (constantes)
      upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
      upsertMeta(
        'meta[name="twitter:card"]',
        "name",
        "twitter:card",
        "summary_large_image"
      );

      // Open Graph
      upsertMeta(
        'meta[property="og:title"]',
        "property",
        "og:title",
        data.title
      );
      upsertMeta(
        'meta[property="og:description"]',
        "property",
        "og:description",
        data.desc
      );
      upsertMeta('meta[property="og:url"]', "property", "og:url", canonicalUrl);

      // Twitter
      upsertMeta(
        'meta[name="twitter:title"]',
        "name",
        "twitter:title",
        data.title
      );
      upsertMeta(
        'meta[name="twitter:description"]',
        "name",
        "twitter:description",
        data.desc
      );

      // Imagen social (site-wide)
      const ogImage = `${window.location.origin}/og.jpg`;
      upsertMeta('meta[property="og:image"]', "property", "og:image", ogImage);
      upsertMeta('meta[name="twitter:image"]', "name", "twitter:image", ogImage);

      let meta = document.querySelector(
        'meta[name="description"]'
      ) as HTMLMetaElement | null;

      if (!meta) {
        meta = document.createElement("meta");
        meta.name = "description";
        document.head.appendChild(meta);
      }

      meta.content = data.desc;

      // ✅ LocalBusiness / PaintingContractor structured data (JSON-LD)
const ldId = "ld-json-localbusiness";
const business = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: content.brand.name,
  url: window.location.origin,
  image: `${window.location.origin}/og.jpg`,
  logo: `${window.location.origin}/og.jpg`,
  telephone: "+18019289520",
  address: {
    "@type": "PostalAddress",
    streetAddress: "1144 N Main St",
    addressLocality: "Orem",
    addressRegion: "UT",
    postalCode: "84057",
    addressCountry: "US",
  },
  areaServed: [
    { "@type": "AdministrativeArea", name: "Utah" },
  ],
  sameAs: [
    "https://www.instagram.com/tauropainting",
    "https://www.facebook.com/tauropainting",
  ],
};

let ld = document.getElementById(ldId) as HTMLScriptElement | null;
if (!ld) {
  ld = document.createElement("script");
  ld.id = ldId;
  ld.type = "application/ld+json";
  document.head.appendChild(ld);
}
ld.text = JSON.stringify(business);

    }, 0);

    return () => window.clearTimeout(t);
  }, [location.pathname]);

  const isHome = location.pathname === "/";
  const navSolid = !isHome || isScrolled;

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 100);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
              <div
                className={`p-2.5 rounded-lg transition-all duration-300 ${
                  navSolid ? "bg-slate-900" : "bg-white/10 backdrop-blur-sm"
                }`}
              >
                <Paintbrush className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-xl font-bold tracking-tight transition-colors ${
                    navSolid ? "text-slate-900" : "text-white"
                  }`}
                >
                  {content.brand.name}
                </span>
                <span
                  className={`text-[10px] uppercase tracking-[0.2em] transition-colors ${
                    navSolid ? "text-slate-500" : "text-white/60"
                  }`}
                >
                  {content.brand.tagline}
                </span>
              </div>
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
              <Button
                onClick={() => setShowQuoteDialog(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-6"
              >
                Schedule a Walkthrough
              </Button>
            </div>

            {/* Mobile Menu Button */}
            <button
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
            <div className="lg:hidden mt-4 pb-4 border-t border-white/10 pt-4 bg-white/95 backdrop-blur-md rounded-xl mt-2 p-4">
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
                <Button
                  onClick={() => {
                    setShowQuoteDialog(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold w-full mt-2"
                >
                  Free Quote
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Routes */}
      <main className={isHome ? "" : "pt-28"}>
        <Routes>
          <Route path="/" element={<HomeRoute />} />
          <Route path="/services" element={<Services />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="*" element={<HomeRoute />} />
          <Route path="/locations/orem" element={<Orem />} />
          <Route path="/locations/provo" element={<Provo />} />
          <Route path="/locations/alpine" element={<Alpine />} />
          <Route path="/locations" element={<Locations />} />
        </Routes>
      </main>

      {/* Footer (global) */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-amber-500">
                  <Paintbrush className="w-6 h-6 text-slate-900" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold tracking-tight">
                    {content.brand.name}
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">
                    {content.brand.tagline}
                  </span>
                </div>
              </div>

              <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                Specialists in custom home and luxury residence painting in Utah.
                We transform spaces with impeccable finishes.
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
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-500 mt-1" />
                  <span>
                    1144 N Main St
                    <br />
                    Orem, UT 84057
                  </span>
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

      {/* Quote Dialog (global) */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">
              Request Sent!
            </DialogTitle>
            <DialogDescription className="text-slate-600">
              Thank you for contacting Tauro Painting. We'll get back to you
              within 24 hours to discuss your project.
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            <Button
              onClick={() => setShowQuoteDialog(false)}
              className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold"
            >
              Got it
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;