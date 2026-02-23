import { CheckCircle2, Sparkles, Home as HomeIcon, Building2, Palette, Sparkles as SparklesIcon } from "lucide-react";

const services = [
  {
    icon: <HomeIcon className="w-8 h-8" />,
    title: "Interior Painting",
    subtitle: "Interiors",
    description:
      "We transform interior spaces with impeccable finishes that elevate your home's aesthetics.",
    features: ["Walls & ceilings", "Trim & moldings", "Specialty finishes", "Custom colors"],
    image: "/interior-luxury-1.jpg",
  },
  {
    icon: <Building2 className="w-8 h-8" />,
    title: "Exterior Painting",
    subtitle: "Exteriors",
    description:
      "We protect and beautify your property's facade with durable paints.",
    features: ["Residential facades", "Doors & windows", "Decks & patios", "Siding"],
    image: "/villa-exterior.jpg",
  },
  {
    icon: <Palette className="w-8 h-8" />,
    title: "Cabinets & Woodwork",
    subtitle: "Cabinetry",
    description: "We refinish your cabinets with factory-quality finishes.",
    features: ["Kitchen cabinets", "Bathroom vanities", "Interior doors", "Moldings"],
    image: "/kitchen-luxury.jpg",
  },
  {
    icon: <SparklesIcon className="w-8 h-8" />,
    title: "Custom Homes",
    subtitle: "Luxury",
    description: "Specialists in luxury custom homes with premium finishes.",
    features: ["New construction", "Remodeling", "Premium finishes", "Attention to detail"],
    image: "/interior-luxury-2.jpg",
  },
];

export default function ServicesSection() {
  return (
    <section id="services" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-3xl mb-16">
          <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
            <Sparkles className="w-4 h-4" />
            Our Services
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Excellence in Every Finish
          </h2>
          <p className="text-slate-600 text-lg leading-relaxed">
            We offer complete painting solutions for luxury homes, using premium materials and specialized techniques
            that guarantee exceptional results.
          </p>
        </div>

        {/* Services Grid */}
        <div className="grid lg:grid-cols-2 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className={`group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 ${
                index === 0 || index === 3 ? "lg:col-span-2" : ""
              }`}
            >
              <div className={`grid ${index === 0 || index === 3 ? "lg:grid-cols-2" : ""} gap-0`}>
                {/* Image */}
                <div className={`relative overflow-hidden ${index === 1 || index === 2 ? "h-48" : "h-64 lg:h-full"}`}>
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
  );
}