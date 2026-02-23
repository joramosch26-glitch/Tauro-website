import { content } from "./content";
import { useState, useEffect } from "react";
import { Routes, Route, Link, NavLink, useLocation } from "react-router-dom";

import Home from "./pages/Home";
import Services from "./pages/Services";
import Projects from "./pages/Projects";
import About from "./pages/About";
import Contact from "./pages/Contact";

import ProjectsSection from "./components/ProjectsSection";
import AboutSection from "./components/AboutSection";
import ContactSection from "./components/ContactSection";
import TestimonialsSection from "./components/TestimonialsSection";
import CTASection from "./components/CTASection";
import ProcessSection from "./components/ProcessSection";
import HeroSection from "./components/HeroSection";
import ServicesSection from "./components/ServicesSection";

import {
  Paintbrush,
  Home as HomeIcon,
  Building2,
  Phone,
  Mail,
  MapPin,
  Instagram,
  Facebook,
  Menu,
  X,
  Star,
  CheckCircle2,
  Clock,
  Award,
  Sparkles,
  Palette,
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
  const isHome = location.pathname === "/";
  const navSolid = !isHome || isScrolled;

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("reveal-visible");
          }
        });
      },
      { threshold: 0.15, rootMargin: "-50px 0px" }
    );

    document.querySelectorAll(".reveal").forEach((el) =>
      observer.observe(el)
    );

    return () => observer.disconnect();
  }, [location.pathname]);

  const navLinks = [
    { name: "Home", to: "/" },
    { name: "Services", to: "/services" },
    { name: "Projects", to: "/projects" },
    { name: "About", to: "/about" },
    { name: "Contact", to: "/contact" },
  ];

  const services = [
    {
      icon: <HomeIcon className="w-8 h-8" />,
      title: "Interior Painting",
      subtitle: "Interiors",
      description:
        "We transform interior spaces with impeccable finishes that elevate your home's aesthetics.",
      features: [
        "Walls & ceilings",
        "Trim & moldings",
        "Specialty finishes",
        "Custom colors",
      ],
      image: "/interior-luxury-1.jpg",
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: "Exterior Painting",
      subtitle: "Exteriors",
      description:
        "We protect and beautify your property's facade with durable paints.",
      features: [
        "Residential facades",
        "Doors & windows",
        "Decks & patios",
        "Siding",
      ],
      image: "/villa-exterior.jpg",
    },
    {
      icon: <Palette className="w-8 h-8" />,
      title: "Cabinets & Woodwork",
      subtitle: "Cabinetry",
      description:
        "We refinish your cabinets with factory-quality finishes.",
      features: [
        "Kitchen cabinets",
        "Bathroom vanities",
        "Interior doors",
        "Moldings",
      ],
      image: "/kitchen-luxury.jpg",
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: "Custom Homes",
      subtitle: "Luxury",
      description:
        "Specialists in luxury custom homes with premium finishes.",
      features: [
        "New construction",
        "Remodeling",
        "Premium finishes",
        "Attention to detail",
      ],
      image: "/interior-luxury-2.jpg",
    },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
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
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("#home");
              }}
              className="flex items-center gap-3 group"
            >
              <div
                className={`p-2.5 rounded-lg ${
                  navSolid ? "bg-slate-900" : "bg-white/10 backdrop-blur-sm"
                }`}
              >
                <Paintbrush className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-xl font-bold ${
                    navSolid ? "text-slate-900" : "text-white"
                  }`}
                >
                  {content.brand.name}
                </span>
                <span
                  className={`text-[10px] uppercase ${
                    navSolid ? "text-slate-500" : "text-white/60"
                  }`}
                >
                  {content.brand.tagline}
                </span>
              </div>
            </a>

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
        } ${isActive ? (navSolid ? "text-amber-600" : "text-amber-400") : ""}`
      }
    >
      {({ isActive }) => (
        <>
          {link.name}
          <span
            className={`pointer-events-none absolute left-0 right-0 -bottom-1 h-0.5 bg-amber-500 origin-left transform transition-transform duration-300 ${
              isActive ? "scale-x-100" : "scale-x-0 group-hover:scale-x-100"
            }`}
          />
        </>
      )}
    </NavLink>
  ))}
</div>

            <Button
              onClick={() => setShowQuoteDialog(true)}
              className="hidden lg:block bg-amber-500 hover:bg-amber-600 text-slate-900"
            >
              Schedule a Walkthrough
            </Button>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden"
            >
              {isMobileMenuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </nav>

      {!isHome && (
        <main className="pt-28">
          <Routes>
            <Route path="/services" element={<Services />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="*" element={<Home />} />
          </Routes>
        </main>
      )}

      {isHome && (
        <>
          <HeroSection />

          <ServicesSection />

          <ProjectsSection />
          <AboutSection />
          <ProcessSection />
          <TestimonialsSection />
          <CTASection />
          <ContactSection />
        </>
      )}

      {/* Dialog */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Sent!</DialogTitle>
            <DialogDescription>
              We'll get back to you within 24 hours.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default App;
