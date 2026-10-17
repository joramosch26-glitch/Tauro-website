import { Link } from "react-router-dom";

import { OFFICE_TEST_RECIPIENT } from "@/lib/lead-submission";
import Contact from "@/pages/Contact";

export default function OfficeRoutingCheck() {
  return (
    <>
      <section aria-label="Temporary delivery verification notice" className="bg-[#f5f3ee] px-6 py-8">
        <div className="mx-auto max-w-7xl border-l-4 border-[#9a6a25] bg-white p-6 text-slate-800">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#9a6a25]">Temporary internal test</p>
          <p className="mt-3 max-w-3xl leading-7">
            This temporary form is only for delivery verification. Please do not use it for a customer inquiry.
            For service requests, use the <Link className="underline" to="/contact">regular contact page</Link>.
          </p>
        </div>
      </section>
      <Contact recipient={OFFICE_TEST_RECIPIENT} trackLead={false} />
    </>
  );
}
