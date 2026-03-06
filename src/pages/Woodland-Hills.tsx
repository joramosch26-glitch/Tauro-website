import { useEffect } from "react";

export default function WoodlandHills() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <main className="pt-28 pb-20 bg-slate-50">
      <div className="max-w-5xl mx-auto px-6">
        
        <h1 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
          House Painters in Woodland Hills, UT
        </h1>

        <p className="text-lg text-slate-600 mb-8 leading-relaxed">
          Tauro Painting provides premium interior and exterior house painting
          services in Woodland Hills, Utah. From detailed preparation to flawless
          finishes, we deliver long-lasting results with clean execution and
          professional standards.
        </p>

        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Interior & Exterior Painting in Woodland Hills
        </h2>

        <p className="text-slate-600 mb-6 leading-relaxed">
          Whether you're updating a modern home near UVU or refreshing a
          classic property in central Woodland Hills, our team handles every project
          with precision, protection, and attention to detail.
        </p>

        <h2 className="text-2xl font-semibold text-slate-900 mb-4">
          Why Homeowners in Woodland Hills Choose Tauro Painting
        </h2>

        <ul className="list-disc pl-6 text-slate-600 space-y-2 mb-10">
          <li>Meticulous surface preparation</li>
          <li>Premium materials and finishes</li>
          <li>Clean, organized job sites</li>
          <li>Clear communication and timelines</li>
          <li>Free detailed estimates</li>
        </ul>

        <a
          href="/contact"
          className="inline-block bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold px-8 py-3 rounded-lg transition"
        >
          Request a Free Estimate
        </a>

      </div>
    </main>
  );
}