import { Users, Shield, Award, Star, Clock } from "lucide-react";

export default function AboutSection() {
  return (
    <section id="about" className="py-24 lg:py-32 bg-slate-900 relative overflow-hidden">
      {/* Background Pattern */}
      <div className="absolute inset-0 opacity-5">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
            backgroundSize: "40px 40px",
          }}
        />
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
                Tauro&apos;s main goal is for every contractor and/or customer to feel complete satisfaction
                with the result of their project and to know they made the right choice in hiring us.
              </p>
            </div>

            {/* Features */}
            <div className="grid grid-cols-2 gap-6 mt-10">
              {[
                { icon: <Shield className="w-5 h-5" />, title: "Licensed & Insured", desc: "License S270 active" },
                { icon: <Award className="w-5 h-5" />, title: "UVHBA Member", desc: "Utah Valley Home Builders" },
                { icon: <Star className="w-5 h-5" />, title: "Premium Quality", desc: "First-class materials" },
                { icon: <Clock className="w-5 h-5" />, title: "On Time", desc: "We meet deadlines" },
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
          <div className="reveal reveal-slide-left" style={{ transitionDelay: "200ms" }}>
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
  );
}