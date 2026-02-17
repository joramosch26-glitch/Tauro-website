import { content } from "./content";
import { useState, useEffect, useRef } from 'react';
import { 
  Paintbrush, 
  Home, 
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
  ArrowRight,
  ArrowUpRight,
  Clock,
  Shield,
  Award,
  Sparkles,
  Palette,
  TrendingUp,
  Users,
  Quote
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';

function App() {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('reveal-visible');
          }
        });
      },
      { threshold: 0.15, rootMargin: '-50px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const navLinks = [
    { name: 'Home', href: '#home' },
    { name: 'Services', href: '#services' },
    { name: 'Projects', href: '#projects' },
    { name: 'About', href: '#about' },
    { name: 'Process', href: '#process' },
    { name: 'Contact', href: '#contact' },
  ];

  const services = [
    {
      icon: <Home className="w-8 h-8" />,
      title: 'Interior Painting',
      subtitle: 'Interiors',
      description: 'We transform interior spaces with impeccable finishes that elevate your home\'s aesthetics. We use premium low-VOC paints for a healthy environment.',
      features: ['Walls & ceilings', 'Trim & moldings', 'Specialty finishes', 'Custom colors'],
      image: '/interior-luxury-1.jpg'
    },
    {
      icon: <Building2 className="w-8 h-8" />,
      title: 'Exterior Painting',
      subtitle: 'Exteriors',
      description: 'We protect and beautify your property\'s facade with durable paints designed to withstand Utah\'s extreme weather conditions.',
      features: ['Residential facades', 'Doors & windows', 'Decks & patios', 'Siding'],
      image: '/villa-exterior.jpg'
    },
    {
      icon: <Palette className="w-8 h-8" />,
      title: 'Cabinets & Woodwork',
      subtitle: 'Cabinetry',
      description: 'We refinish your cabinets with factory-quality finishes that give new life to kitchens and bathrooms. Specialized techniques for flawless results.',
      features: ['Kitchen cabinets', 'Bathroom vanities', 'Interior doors', 'Moldings'],
      image: '/kitchen-luxury.jpg'
    },
    {
      icon: <Sparkles className="w-8 h-8" />,
      title: 'Custom Homes',
      subtitle: 'Luxury',
      description: 'Specialists in luxury custom homes. We understand the level of perfection these projects demand and exceed expectations.',
      features: ['New construction', 'Remodeling', 'Premium finishes', 'Attention to detail'],
      image: '/interior-luxury-2.jpg'
    }
  ];

  const projects = [
    {
      image: '/interior-luxury-1.jpg',
      title: 'Mountain View Residence',
      location: 'Park City, UT',
      category: 'Interior',
      description: 'Complete interior painting of 8,000 sq ft home'
    },
    {
      image: '/villa-exterior.jpg',
      title: 'Desert Villa',
      location: 'St. George, UT',
      category: 'Exterior',
      description: 'Exterior painting of Mediterranean villa'
    },
    {
      image: '/kitchen-luxury.jpg',
      title: 'Gourmet Kitchen',
      location: 'Salt Lake City, UT',
      category: 'Cabinetry',
      description: 'Custom cabinet refinishing'
    },
    {
      image: '/dining-luxury.jpg',
      title: 'Executive Dining Room',
      location: 'Provo, UT',
      category: 'Interior',
      description: 'Deep tone walls with white moldings'
    },
    {
      image: '/bathroom-luxury.jpg',
      title: 'Master Spa Suite',
      location: 'Lehi, UT',
      category: 'Interior',
      description: 'Luxury finishes in master bathroom'
    },
    {
      image: '/office-luxury.jpg',
      title: 'Executive Office',
      location: 'Orem, UT',
      category: 'Interior',
      description: 'Custom library and office space'
    }
  ];

  const process = [
    {
      number: '01',
      title: 'Consultation',
      description: 'We evaluate your project, discuss your vision and color preferences, and provide a detailed estimate.'
    },
    {
      number: '02',
      title: 'Preparation',
      description: 'We protect your furniture, floors, and belongings. We prepare surfaces to ensure perfect adhesion.'
    },
    {
      number: '03',
      title: 'Execution',
      description: 'We apply premium paint with specialized techniques, uniform coats, and meticulous attention to detail.'
    },
    {
      number: '04',
      title: 'Completion',
      description: 'Quality inspection, complete cleanup, and delivery of your transformed space with satisfaction guarantee.'
    }
  ];

  const testimonials = [
    {
      name: 'Sarah & Michael Thompson',
      location: 'Park City, UT',
      rating: 5,
      text: 'Tauro Painting exceeded all our expectations. Their attention to detail in our mountain home was exceptional. Every corner turned out perfect.',
      project: 'Complete 6,000 sq ft residence'
    },
    {
      name: 'David Chen',
      location: 'Salt Lake City, UT',
      rating: 5,
      text: 'First-class professionalism. The team arrived on time, worked clean, and our cabinet finish looks factory-new. Highly recommended.',
      project: 'Kitchen cabinet refinishing'
    },
    {
      name: 'Jennifer Williams',
      location: 'Provo, UT',
      rating: 5,
      text: 'We hired Tauro to paint the exterior of our historic home. They respected every architectural detail. The result is simply spectacular.',
      project: 'Exterior Victorian home'
    }
  ];

  const stats = [
    { value: '15+', label: 'Years Experience', icon: <Clock className="w-5 h-5" /> },
    { value: '2,500+', label: 'Projects Completed', icon: <Home className="w-5 h-5" /> },
    { value: '100%', label: 'Satisfaction', icon: <Star className="w-5 h-5" /> },
    { value: '50+', label: 'Custom Homes', icon: <Award className="w-5 h-5" /> }
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav 
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          isScrolled 
            ? 'bg-white/95 backdrop-blur-md shadow-sm py-4' 
            : 'bg-transparent py-6'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo */}
            <a 
              href="#home" 
              onClick={(e) => { e.preventDefault(); scrollToSection('#home'); }}
              className="flex items-center gap-3 group"
            >
              <div className={`p-2.5 rounded-lg transition-all duration-300 ${isScrolled ? 'bg-slate-900' : 'bg-white/10 backdrop-blur-sm'}`}>
                <Paintbrush className="w-6 h-6 text-amber-400" />
              </div>
              <div className="flex flex-col">
                <span className={`text-xl font-bold tracking-tight transition-colors ${isScrolled ? 'text-slate-900' : 'text-white'}`}>
                  {content.brand.name}

                </span>
                <span className={`text-[10px] uppercase tracking-[0.2em] transition-colors ${isScrolled ? 'text-slate-500' : 'text-white/60'}`}>
                  {content.brand.tagline}

                </span>
              </div>
            </a>

            {/* Desktop Navigation */}
            <div className="hidden lg:flex items-center gap-8">
              {navLinks.map((link) => (
                <a
                  key={link.name}
                  href={link.href}
                  onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                  className={`text-sm font-medium transition-all duration-300 hover:text-amber-500 relative group ${
                    isScrolled ? 'text-slate-700' : 'text-white/90'
                  }`}
                >
                  {link.name}
                  <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                </a>
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
                isScrolled ? 'text-slate-900' : 'text-white'
              }`}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile Menu */}
          {isMobileMenuOpen && (
            <div className="lg:hidden mt-4 pb-4 border-t border-white/10 pt-4 bg-white/95 backdrop-blur-md rounded-xl mt-2 p-4">
              <div className="flex flex-col gap-3">
                {navLinks.map((link) => (
                  <a
                    key={link.name}
                    href={link.href}
                    onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                    className="text-sm font-medium text-slate-700 hover:text-amber-600 py-2"
                  >
                    {link.name}
                  </a>
                ))}
                <Button 
                  onClick={() => { setShowQuoteDialog(true); setIsMobileMenuOpen(false); }}
                  className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold w-full mt-2"
                >
                  Free Quote
                </Button>
              </div>
            </div>
          )}
        </div>
      </nav>

      {/* Hero Section */}
      <section id="home" ref={heroRef} className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background Image with Parallax */}
        <div className="absolute inset-0">
          <div 
            className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
            style={{ backgroundImage: 'url(/hero-luxury.jpg)' }}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
        </div>

        {/* Decorative Elements */}
        <div className="absolute top-1/4 right-10 w-px h-40 bg-gradient-to-b from-transparent via-amber-400/50 to-transparent hidden lg:block" />
        <div className="absolute bottom-1/4 left-10 w-px h-40 bg-gradient-to-b from-transparent via-amber-400/50 to-transparent hidden lg:block" />

        {/* Content */}
        <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-32 w-full">
          <div className="max-w-3xl">
            {/* Badge */}
            <div className="reveal reveal-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8">
              <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
              <span className="text-white/80 text-sm font-medium tracking-wide">The painters of Utah's most luxurious homes</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="reveal reveal-fade-up text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6" style={{ transitionDelay: '100ms' }}>
              We Transform
              <span className="block text-amber-400">Homes Into Art</span>
            </h1>
            
            {/* Subheadline */}
            <p className="reveal reveal-fade-up text-lg sm:text-xl text-white/70 mb-10 leading-relaxed max-w-xl" style={{ transitionDelay: '200ms' }}>
              Specialists in custom home and luxury residence painting. 
              Impeccable finishes that elevate the value and beauty of your property.
            </p>
            
            {/* CTA Buttons */}
            <div className="reveal reveal-fade-up flex flex-col sm:flex-row gap-4" style={{ transitionDelay: '300ms' }}>
              <Button 
                size="lg"
                onClick={() => setShowQuoteDialog(true)}
                className="bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-8 text-base"
              >
                Get a Quote
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => scrollToSection('#projects')}
                className="border-white/30 text-white hover:bg-white/10 bg-transparent px-8 text-base"
              >
                View Projects
              </Button>
            </div>

            {/* Stats Bar */}
            <div className="reveal reveal-fade-up mt-20 pt-8 border-t border-white/10" style={{ transitionDelay: '400ms' }}>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center sm:text-left">
                    <div className="flex items-center justify-center sm:justify-start gap-2 text-amber-400 mb-1">
                      {stat.icon}
                      <span className="text-3xl sm:text-4xl font-bold text-white">{stat.value}</span>
                    </div>
                    <p className="text-white/50 text-sm">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2">
          <span className="text-white/40 text-xs uppercase tracking-widest">Scroll</span>
          <div className="w-px h-12 bg-gradient-to-b from-amber-400/50 to-transparent" />
        </div>
      </section>

      {/* Services Section */}
      <section id="services" className="py-24 lg:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="reveal reveal-fade-up max-w-3xl mb-16">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
              <Sparkles className="w-4 h-4" />
              Our Services
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              Excellence in Every Finish
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed">
              We offer complete painting solutions for luxury homes, using 
              premium materials and specialized techniques that guarantee exceptional results.
            </p>
          </div>

          {/* Services Grid */}
          <div className="grid lg:grid-cols-2 gap-8">
            {services.map((service, index) => (
              <div
                key={index}
                className={`reveal reveal-fade-up group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 ${
                  index === 0 || index === 3 ? 'lg:col-span-2' : ''
                }`}
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                <div className={`grid ${index === 0 || index === 3 ? 'lg:grid-cols-2' : ''} gap-0`}>
                  {/* Image */}
                  <div className={`relative overflow-hidden ${index === 1 || index === 2 ? 'h-48' : 'h-64 lg:h-full'}`}>
                    <img 
                      src={service.image} 
                      alt={service.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                    <div className="absolute top-4 left-4">
                      <span className="px-3 py-1 bg-white/90 backdrop-blur-sm rounded-full text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {service.subtitle}
                      </span>
                    </div>
                  </div>
                  
                  {/* Content */}
                  <div className="p-8 lg:p-10">
                    <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                      {service.icon}
                    </div>
                    <h3 className="text-2xl font-bold text-slate-900 mb-4">{service.title}</h3>
                    <p className="text-slate-600 mb-6 leading-relaxed">{service.description}</p>
                    <ul className="grid grid-cols-2 gap-3">
                      {service.features.map((feature, fIndex) => (
                        <li key={fIndex} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Projects Section */}
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
            <Button 
              onClick={() => window.open('https://www.instagram.com/tauropainting', '_blank')}
              variant="outline"
              className="border-slate-300 text-slate-700 hover:bg-slate-50 w-fit"
            >
              <Instagram className="w-5 h-5 mr-2" />
              View on Instagram
            </Button>
          </div>

          {/* Projects Grid - Masonry Style */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project, index) => (
              <div
                key={index}
                className={`reveal reveal-fade-up group relative overflow-hidden rounded-2xl bg-slate-100 ${
                  index === 0 || index === 3 ? 'md:col-span-2 lg:col-span-2' : ''
                }`}
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                <div className={`relative overflow-hidden ${index === 0 || index === 3 ? 'h-80 lg:h-96' : 'h-72'}`}>
                  <img 
                    src={project.image} 
                    alt={project.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300" />
                  
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
                    <h3 className="text-xl font-bold text-white mb-1">{project.title}</h3>
                    <p className="text-white/70 text-sm opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                      {project.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-24 lg:py-32 bg-slate-900 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute inset-0" style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: '40px 40px'
          }} />
        </div>

        <div className="max-w-7xl mx-auto px-6 lg:px-8 relative z-10">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            {/* Content */}
            <div className="reveal reveal-slide-right">
              <span className="inline-flex items-center gap-2 text-amber-400 font-semibold text-sm uppercase tracking-wider mb-4">
                <Users className="w-4 h-4" />
                About Us
              </span>
              <h2 className="text-4xl lg:text-5xl font-bold text-white mb-6">
                Excellence is Our Signature
              </h2>
              <div className="space-y-4 text-slate-300 leading-relaxed">
                <p>
                  Tauro Painting is a licensed and insured family-owned business based in Utah County. 
                  We specialize in luxury custom homes, as well as commercial and residential new construction 
                  and remodeling projects throughout Utah.
                </p>
                <p>
                  Along with our team, who play a fundamental role in representing the company, we have 
                  dedicated ourselves to perfecting every skill. We go above and beyond to ensure all needs 
                  and expectations are met.
                </p>
                <p>
                  Tauro's main goal is for every contractor and/or customer to feel complete satisfaction 
                  with the result of their project and to know they made the right choice in hiring us.
                </p>
              </div>

              {/* Features */}
              <div className="grid grid-cols-2 gap-6 mt-10">
                {[
                  { icon: <Shield className="w-5 h-5" />, title: 'Licensed & Insured', desc: 'License S270 active' },
                  { icon: <Award className="w-5 h-5" />, title: 'UVHBA Member', desc: 'Utah Valley Home Builders' },
                  { icon: <Star className="w-5 h-5" />, title: 'Premium Quality', desc: 'First-class materials' },
                  { icon: <Clock className="w-5 h-5" />, title: 'On Time', desc: 'We meet deadlines' }
                ].map((item, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-400 flex-shrink-0">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-white text-sm">{item.title}</h4>
                      <p className="text-slate-400 text-xs">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Image */}
            <div className="reveal reveal-slide-left" style={{ transitionDelay: '200ms' }}>
              <div className="relative">
                <div className="absolute -inset-4 bg-amber-500/20 rounded-3xl blur-2xl" />
                <img 
                  src="/craftsmanship.jpg" 
                  alt="Tauro Painting Craftsmanship"
                  className="relative rounded-2xl shadow-2xl w-full"
                />
                {/* Floating Badge */}
                <div className="absolute -bottom-6 -left-6 bg-amber-500 text-slate-900 p-6 rounded-2xl shadow-xl">
                  <div className="text-4xl font-bold">15+</div>
                  <div className="text-sm font-medium">Years of Experience</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section id="process" className="py-24 lg:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="reveal reveal-fade-up text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
              <Clock className="w-4 h-4" />
              Our Process
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              How We Work
            </h2>
            <p className="text-slate-600 text-lg">
              A proven process that guarantees exceptional results on every project.
            </p>
          </div>

          {/* Process Steps */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {process.map((step, index) => (
              <div
                key={index}
                className="reveal reveal-fade-up relative"
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                {/* Connector Line */}
                {index < process.length - 1 && (
                  <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-amber-300 to-transparent" />
                )}
                
                <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow duration-300 h-full">
                  <div className="text-5xl font-bold text-amber-200 mb-6">{step.number}</div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3">{step.title}</h3>
                  <p className="text-slate-600 text-sm leading-relaxed">{step.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-24 lg:py-32 bg-white">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          {/* Section Header */}
          <div className="reveal reveal-fade-up text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
              <Quote className="w-4 h-4" />
              Testimonials
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
              What Our Clients Say
            </h2>
            <p className="text-slate-600 text-lg">
              Our clients' satisfaction is the true testament to our work.
            </p>
          </div>

          {/* Testimonials Grid */}
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <div
                key={index}
                className="reveal reveal-fade-up bg-slate-50 rounded-2xl p-8 relative"
                style={{ transitionDelay: `${index * 100 + 200}ms` }}
              >
                {/* Quote Icon */}
                <div className="absolute -top-4 left-8 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                  <Quote className="w-4 h-4 text-slate-900" />
                </div>

                {/* Rating */}
                <div className="flex gap-1 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-5 h-5 text-amber-400 fill-amber-400" />
                  ))}
                </div>

                {/* Text */}
                <p className="text-slate-700 mb-6 leading-relaxed">"{testimonial.text}"</p>

                {/* Project Tag */}
                <div className="inline-block px-3 py-1 bg-amber-100 rounded-full text-xs font-medium text-amber-700 mb-6">
                  {testimonial.project}
                </div>

                {/* Author */}
                <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <span className="text-slate-600 font-bold">{testimonial.name.charAt(0)}</span>
                  </div>
                  <div>
                    <div className="font-semibold text-slate-900">{testimonial.name}</div>
                    <div className="text-sm text-slate-500">{testimonial.location}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 lg:py-32 bg-amber-500 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600 rounded-full blur-3xl opacity-30 translate-y-1/2 -translate-x-1/2" />

        <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
          <h2 className="reveal reveal-fade-up text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Ready to Transform Your Space?
          </h2>
          <p className="reveal reveal-fade-up text-slate-800 text-lg mb-10 max-w-2xl mx-auto" style={{ transitionDelay: '100ms' }}>
            Contact us today for a free consultation. Discover why we are the preferred painters 
            for Utah's most luxurious homes.
          </p>
          <div className="reveal reveal-fade-up flex flex-col sm:flex-row gap-4 justify-center" style={{ transitionDelay: '200ms' }}>
            <Button 
              size="lg"
              onClick={() => setShowQuoteDialog(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 text-base"
            >
              Request a Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => window.location.href = 'tel:8019289520'}
              className="border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white px-8 text-base"
            >
              <Phone className="w-5 h-5 mr-2" />
              (801) 928-9520
            </Button>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 lg:py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16">
            {/* Contact Info */}
            <div className="reveal reveal-slide-right">
              <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
                <Phone className="w-4 h-4" />
                Contact Us
              </span>
              <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
                Start Your Project
              </h2>
              <p className="text-slate-600 mb-10 leading-relaxed">
                We're here to help transform your home. Contact us by phone, 
                email, or fill out the form and we'll get back to you within 24 hours.
              </p>

              <div className="space-y-6">
                {[
                  { icon: <Phone className="w-5 h-5" />, label: 'Phone', value: '(801) 928-9520', href: 'tel:8019289520' },
                  { icon: <Mail className="w-5 h-5" />, label: 'Email', value: 'tauropaintingutah@gmail.com', href: 'mailto:tauropaintingutah@gmail.com' },
                  { icon: <MapPin className="w-5 h-5" />, label: 'Address', value: '1144 N Main St, Orem, UT 84057', href: '#' },
                  { icon: <Clock className="w-5 h-5" />, label: 'Hours', value: 'Mon-Fri: 8AM-6PM | Sat: 9AM-2PM', href: '#' }
                ].map((item, index) => (
                  <a
                    key={index}
                    href={item.href}
                    className="flex items-start gap-4 group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                      {item.icon}
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm mb-1">{item.label}</h4>
                      <p className="text-slate-600 group-hover:text-amber-600 transition-colors">{item.value}</p>
                    </div>
                  </a>
                ))}
              </div>

              {/* Social Links */}
              <div className="mt-10 pt-8 border-t border-slate-200">
                <h4 className="font-semibold text-slate-900 mb-4">Follow Us</h4>
                <div className="flex gap-3">
                  <a 
                    href="https://www.instagram.com/tauropainting" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-amber-500 hover:text-white transition-colors"
                  >
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a 
                    href="https://www.facebook.com/tauropainting" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-amber-500 hover:text-white transition-colors"
                  >
                    <Facebook className="w-5 h-5" />
                  </a>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="reveal reveal-slide-left" style={{ transitionDelay: '200ms' }}>
              <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-lg">
                <h3 className="text-2xl font-bold text-slate-900 mb-2">Request a Quote</h3>
                <p className="text-slate-600 mb-8">Fill out the form and we'll contact you soon.</p>
                
                <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); setShowQuoteDialog(true); }}>
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Name</label>
                      <Input placeholder="Your name" className="border-slate-200 h-12" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">Phone</label>
                      <Input placeholder="(801) 000-0000" className="border-slate-200 h-12" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
                    <Input type="email" placeholder="you@email.com" className="border-slate-200 h-12" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Project Type</label>
                    <select className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="">Select a type</option>
                      <option value="interior">Interior Painting</option>
                      <option value="exterior">Exterior Painting</option>
                      <option value="cabinets">Cabinets</option>
                      <option value="custom">Custom Home</option>
                      <option value="complete">Complete Project</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Message</label>
                    <Textarea 
                      placeholder="Tell us about your project..." 
                      className="border-slate-200 min-h-[120px]"
                    />
                  </div>
                  <Button type="submit" className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-12">
                    Submit Request
                    <ArrowUpRight className="w-5 h-5 ml-2" />
                  </Button>
                </form>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-16">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12">
            {/* Brand */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2.5 rounded-lg bg-amber-500">
                  <Paintbrush className="w-6 h-6 text-slate-900" />
                </div>
                <div className="flex flex-col">
                  <span className="text-xl font-bold tracking-tight">Tauro Painting</span>
                  <span className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Luxury Finishes</span>
                </div>
              </div>
              <p className="text-slate-400 mb-6 max-w-md leading-relaxed">
                Specialists in custom home and luxury residence painting in Utah. 
                We transform spaces with impeccable finishes since 2009.
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

            {/* Quick Links */}
            <div>
              <h4 className="font-semibold mb-6 text-white">Quick Links</h4>
              <ul className="space-y-3">
                {navLinks.map((link) => (
                  <li key={link.name}>
                    <a 
                      href={link.href}
                      onClick={(e) => { e.preventDefault(); scrollToSection(link.href); }}
                      className="text-slate-400 hover:text-amber-400 transition-colors"
                    >
                      {link.name}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-semibold mb-6 text-white">Contact</h4>
              <ul className="space-y-3 text-slate-400">
                <li className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-amber-500" />
                  (801) 928-9520
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-amber-500" />
                  tauropaintingutah@gmail.com
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-amber-500 mt-1" />
                  <span>1144 N Main St<br />Orem, UT 84057</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-slate-500 text-sm">
              &copy; {new Date().getFullYear()} Tauro Painting LLC. All rights reserved.
            </p>
            <p className="text-slate-500 text-sm">
              License S270 • UVHBA Member
            </p>
          </div>
        </div>
      </footer>

      {/* Quote Dialog */}
      <Dialog open={showQuoteDialog} onOpenChange={setShowQuoteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-slate-800">Request Sent!</DialogTitle>
            <DialogDescription className="text-slate-600">
              Thank you for contacting Tauro Painting. We'll get back to you within 24 hours to discuss your project.
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
