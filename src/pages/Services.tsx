import { content } from "../content";
import { Sparkles, CheckCircle2 } from "lucide-react";

type Service = (typeof content.services)[number];

export default function Services() {
  const services: readonly Service[] = content.services;

  return (
    <section className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="reveal reveal-fade-up max-w-3xl mb-16">
          <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
            <Sparkles className="w-4 h-4" />
            Our Services
          </span>
          <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
            Excellence in Every Finish
          </h1>
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
              className={`reveal reveal-fade-up group relative bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 ${
                index === 0 || index === 3 ? "lg:col-span-2" : ""
              }`}
              style={{ transitionDelay: `${index * 100 + 200}ms` }}
            >
              <div className={`grid ${index === 0 || index === 3 ? "lg:grid-cols-2" : ""} gap-0`}>
                {/* Image */}
                <div className={`relative overflow-hidden ${index === 1 || index === 2 ? "h-48" : "h-64 lg:h-full"}`}>
                  <img
                    src={service.image}
                    alt={service.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                </div>

                {/* Content */}
                <div className="p-8 lg:p-10">
                  <div className="w-14 h-14 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 mb-6 group-hover:bg-amber-500 group-hover:text-white transition-colors duration-300">
                    <Sparkles className="w-6 h-6" />
                  </div>

                  <h2 className="text-2xl font-bold text-slate-900 mb-4">{service.title}</h2>

                  {"description" in service && service.description ? (
                    <p className="text-slate-600 mb-6 leading-relaxed">{service.description}</p>
                  ) : null}

                  {"features" in service && Array.isArray(service.features) && service.features.length ? (
                    <ul className="grid grid-cols-2 gap-3">
                      {service.features.map((feature: string, fIndex: number) => (
                        <li key={fIndex} className="flex items-center gap-2 text-sm text-slate-600">
                          <CheckCircle2 className="w-4 h-4 text-amber-500 flex-shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
