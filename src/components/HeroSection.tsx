import { Star, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

const stats = [
  { value: "15+", label: "Years Experience" },
  { value: "500+", label: "Projects Completed" },
  { value: "100%", label: "Client Satisfaction" },
  { value: "Premium", label: "Quality Materials" },
];

export default function HeroSection() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0">
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
          style={{ backgroundImage: "url(/hero-luxury.jpg)" }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900/90 via-slate-900/60 to-slate-900/30" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent" />
      </div>

      {/* Decorative Lines */}
      <div className="absolute top-1/4 right-10 w-px h-40 bg-gradient-to-b from-transparent via-amber-400/50 to-transparent hidden lg:block" />
      <div className="absolute bottom-1/4 left-10 w-px h-40 bg-gradient-to-b from-transparent via-amber-400/50 to-transparent hidden lg:block" />

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6 lg:px-8 py-32 w-full">
        <div className="max-w-3xl">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10 mb-8">
            <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
            <span className="text-white/80 text-sm font-medium tracking-wide">
              The painters of Utah&apos;s most luxurious homes
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white leading-[1.1] mb-6">
            We Transform
            <span className="block text-amber-400">
              Homes Into Art
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-white/70 mb-10 leading-relaxed max-w-xl">
            Specialists in custom home and luxury residence painting.
            Impeccable finishes that elevate the value and beauty of your property.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link
              to="/contact"
              className="inline-flex items-center justify-center bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-8 py-3 text-base rounded-md transition-colors"
            >
              Get a Quote
              <ArrowRight className="w-5 h-5 ml-2" />
            </Link>

            <Link
              to="/projects"
              className="inline-flex items-center justify-center border border-white/30 text-white hover:bg-white/10 bg-transparent px-8 py-3 text-base rounded-md transition-colors"
            >
              View Projects
            </Link>
          </div>

          {/* Stats */}
          <div className="mt-20 pt-8 border-t border-white/10">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center sm:text-left">
                  <div className="text-3xl sm:text-4xl font-bold text-white mb-1">
                    {stat.value}
                  </div>
                  <p className="text-white/50 text-sm">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden lg:flex flex-col items-center gap-2">
        <span className="text-white/40 text-xs uppercase tracking-widest">
          Scroll
        </span>
        <div className="w-px h-12 bg-gradient-to-b from-amber-400/50 to-transparent" />
      </div>
    </section>
  );
}