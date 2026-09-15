import { Award, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

export default function AboutSection() {
  return (
    <section id="about" className="bg-[#f5f3ee] py-24 lg:py-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-6">
            <div className="grid grid-cols-2 gap-4">
              <img
                src="/tauro/interior-open-plan.webp"
                alt="Custom home interior finished by Tauro Painting"
                loading="lazy"
                className="mt-14 aspect-[4/5] h-auto w-full object-cover"
              />
              <img
                src="/tauro/stair-detail.webp"
                alt="Detailed stair and millwork finish by Tauro Painting"
                loading="lazy"
                className="aspect-[4/5] h-auto w-full object-cover"
              />
            </div>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-[#9a6a25]">About Tauro</p>
            <h2 className="text-4xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-5xl">
              A painting partner for projects where details matter.
            </h2>
            <p className="mt-6 text-lg leading-8 text-slate-600">
              Tauro Painting is a Utah-based painting company focused on custom homes, premium new construction,
              and high-detail residential work. We work closely with builders, designers, and homeowners to keep
              finishes consistent from initial prep through final punch.
            </p>
            <p className="mt-4 leading-7 text-slate-600">
              Our crews are built around accountability, clean execution, and a finish standard that holds up under
              the lighting, materials, and scrutiny of luxury construction.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="border-t border-slate-300 pt-4">
                <ShieldCheck className="mb-3 h-5 w-5 text-[#9a6a25]" />
                <p className="font-semibold text-slate-900">Licensed & insured</p>
                <p className="mt-1 text-sm text-slate-500">Utah contractor license S270</p>
              </div>
              <div className="border-t border-slate-300 pt-4">
                <Award className="mb-3 h-5 w-5 text-[#9a6a25]" />
                <p className="font-semibold text-slate-900">UVHBA member</p>
                <p className="mt-1 text-sm text-slate-500">Utah Valley Home Builders Association</p>
              </div>
            </div>

            <Link
              to="/about"
              className="mt-9 inline-flex border-b border-slate-900 pb-1 text-sm font-semibold uppercase tracking-[0.14em] text-slate-900"
            >
              More about Tauro
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
