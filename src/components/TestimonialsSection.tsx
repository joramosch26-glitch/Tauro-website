import { Quote, Star } from "lucide-react";

const testimonials = [
  {
    name: "Sarah M.",
    location: "Salt Lake City, UT",
    rating: 5,
    text: "Excellent prep work and flawless finish. The team was professional and fast.",
    project: "Interior Painting",
  },
  {
    name: "James R.",
    location: "Park City, UT",
    rating: 5,
    text: "High-end results. Communication was clear, and the work exceeded expectations.",
    project: "Exterior Painting",
  },
  {
    name: "Emily T.",
    location: "Draper, UT",
    rating: 5,
    text: "Clean lines, great attention to detail, and they left everything spotless.",
    project: "Cabinet Refinishing",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="py-24 lg:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
            <Quote className="w-4 h-4" />
            Testimonials
          </span>
          <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-4">
            What Our Clients Say
          </h2>
          <p className="text-slate-600 text-lg">
            Our clients&apos; satisfaction is the true testament to our work.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-slate-50 rounded-2xl p-8 relative"
              style={{ transitionDelay: `${index * 100 + 200}ms` }}
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 left-8 w-8 h-8 bg-amber-500 rounded-full flex items-center justify-center">
                <Quote className="w-4 h-4 text-slate-900" />
              </div>

              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-5 h-5 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>

              {/* Text */}
              <p className="text-slate-700 mb-6 leading-relaxed">
                &quot;{testimonial.text}&quot;
              </p>

              {/* Project Tag */}
              <div className="inline-block px-3 py-1 bg-amber-100 rounded-full text-xs font-medium text-amber-700 mb-6">
                {testimonial.project}
              </div>

              {/* Author */}
              <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
                <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                  <span className="text-slate-600 font-bold">
                    {testimonial.name.charAt(0)}
                  </span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">
                    {testimonial.name}
                  </div>
                  <div className="text-sm text-slate-500">
                    {testimonial.location}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}