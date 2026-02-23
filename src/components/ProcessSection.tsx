import { Clock } from "lucide-react";

const processSteps = [
  {
    number: "01",
    title: "Consultation",
    description:
      "We begin with a detailed walkthrough to understand your vision and requirements.",
  },
  {
    number: "02",
    title: "Preparation",
    description:
      "Surfaces are carefully prepared to ensure durability and a flawless finish.",
  },
  {
    number: "03",
    title: "Painting",
    description:
      "Our skilled team applies premium products with precision and care.",
  },
  {
    number: "04",
    title: "Final Inspection",
    description:
      "We review every detail to guarantee complete satisfaction before completion.",
  },
];

export default function ProcessSection() {
  return (
    <section id="process" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
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
          {processSteps.map((step, index) => (
            <div key={index} className="relative">
              {index < processSteps.length - 1 && (
                <div className="hidden lg:block absolute top-12 left-full w-full h-px bg-gradient-to-r from-amber-300 to-transparent" />
              )}

              <div className="bg-white rounded-2xl p-8 shadow-sm hover:shadow-lg transition-shadow duration-300 h-full">
                <div className="text-5xl font-bold text-amber-200 mb-6">
                  {step.number}
                </div>

                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {step.title}
                </h3>

                <p className="text-slate-600 text-sm leading-relaxed">
                  {step.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}