import { ArrowRight, Phone } from "lucide-react";
import { Link } from "react-router-dom";

export default function CTASection() {
  return (
    <section className="py-24 lg:py-32 bg-amber-500 relative overflow-hidden">
      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-amber-400 rounded-full blur-3xl opacity-50 -translate-y-1/2 translate-x-1/2" />
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-amber-600 rounded-full blur-3xl opacity-30 translate-y-1/2 -translate-x-1/2" />

      <div className="max-w-4xl mx-auto px-6 lg:px-8 text-center relative z-10">
        <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
          Ready to Transform Your Space?
        </h2>

        <p className="text-slate-800 text-lg mb-10 max-w-2xl mx-auto">
          Contact us today for a free consultation. Discover why we are the
          preferred painters for Utah's most luxurious homes.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          {/* Link to Contact Page */}
          <Link
            to="/contact"
            className="inline-flex items-center justify-center bg-slate-900 hover:bg-slate-800 text-white font-semibold px-8 py-3 text-base rounded-md transition-colors"
          >
            Request a Quote
            <ArrowRight className="w-5 h-5 ml-2" />
          </Link>

          {/* Phone Button */}
          <a
            href="tel:8019289520"
            className="inline-flex items-center justify-center border border-slate-900 text-slate-900 hover:bg-slate-900 hover:text-white px-8 py-3 text-base rounded-md transition-colors"
          >
            <Phone className="w-5 h-5 mr-2" />
            (801) 928-9520
          </a>
        </div>
      </div>
    </section>
  );
}