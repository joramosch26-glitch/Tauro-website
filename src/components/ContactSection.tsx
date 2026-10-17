import { FormEvent, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SubmissionError from "@/components/SubmissionError";
import { LeadSubmissionError, submitLeadInquiry } from "@/lib/lead-submission";

const fieldClass = "h-12 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:border-[#9a6a25] focus-visible:ring-0";

export default function ContactSection() {
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [projectType, setProjectType] = useState("");
  const [projectLocation, setProjectLocation] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<"rejected" | "unconfirmed" | "duplicate" | "timed_out" | null>(null);
  const [website, setWebsite] = useState("");
  const [lastSubmittedSignature, setLastSubmittedSignature] = useState("");
  const [lastSubmittedAt, setLastSubmittedAt] = useState(0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;
    if (website) return;
    setShowQuoteDialog(false);
    setSubmitError(null);

    const submissionSignature = JSON.stringify({ name: name.trim(), phone: phone.trim(), email: email.trim(), projectType, projectLocation: projectLocation.trim(), message: message.trim() });
    const now = Date.now();
    if (submissionSignature === lastSubmittedSignature && now - lastSubmittedAt < 60000) {
      setSubmitError("duplicate");
      return;
    }

    setIsSubmitting(true);

    try {
      await submitLeadInquiry(
        { name, phone, email, projectType, projectLocation, message },
        `${window.location.origin}${window.location.pathname}`,
      );

      try {
        const gtag = (window as Window & { gtag?: (...args: unknown[]) => void }).gtag;
        if (typeof gtag === "function") {
          gtag("event", "generate_lead", { form_location: "home", project_type: projectType, page_path: window.location.pathname });
        }
      } catch {
        // Analytics must not affect a successful form submission.
      }

      setShowQuoteDialog(true);
      setLastSubmittedSignature(submissionSignature);
      setLastSubmittedAt(now);
      setName("");
      setPhone("");
      setEmail("");
      setProjectType("");
      setProjectLocation("");
      setMessage("");
    } catch (error) {
      setSubmitError(error instanceof LeadSubmissionError ? error.outcome : "unconfirmed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" aria-labelledby="home-contact-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
      <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:gap-20 lg:px-8">
        <div className="lg:col-span-5">
          <p className="mb-7 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]">
            <span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />
            Contact Tauro
          </p>
          <h2 id="home-contact-heading" className="max-w-xl text-4xl font-semibold leading-[1.04] tracking-[-0.04em] text-slate-950 sm:text-5xl">Start a Conversation</h2>
          <p className="mt-7 max-w-lg text-lg leading-8 text-slate-600">Tell us where your project stands, what finishes are involved, and when you need us on site. We&apos;ll follow up to discuss next steps.</p>

          <dl className="mt-12 border-t border-slate-300">
            <div className="grid gap-2 border-b border-slate-300 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6"><dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6a25]">Phone</dt><dd><a href="tel:8019289520" className="transition-colors hover:text-[#9a6a25]">(801) 928-9520</a></dd></div>
            <div className="grid gap-2 border-b border-slate-300 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6"><dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6a25]">Email</dt><dd><a href="mailto:tauropaintingutah@gmail.com" className="break-words transition-colors hover:text-[#9a6a25]">tauropaintingutah@gmail.com</a></dd></div>
            <div className="grid gap-2 border-b border-slate-300 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6"><dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6a25]">Service area</dt><dd>Orem, Utah County &amp; surrounding communities</dd></div>
            <div className="grid gap-2 border-b border-slate-300 py-5 sm:grid-cols-[8rem_1fr] sm:gap-6"><dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6a25]">Hours</dt><dd>Mon–Fri: 8AM–6PM · Sat: 9AM–2PM</dd></div>
          </dl>

          <div className="mt-8 flex gap-6 text-xs font-semibold uppercase tracking-[0.16em] text-slate-600">
            <a href="https://www.instagram.com/tauropainting" target="_blank" rel="noopener noreferrer" className="border-b border-slate-400 pb-1 transition-colors hover:text-[#9a6a25]">Instagram</a>
            <a href="https://www.facebook.com/tauropainting" target="_blank" rel="noopener noreferrer" className="border-b border-slate-400 pb-1 transition-colors hover:text-[#9a6a25]">Facebook</a>
          </div>
        </div>

        <div className="bg-white px-6 py-9 sm:px-9 sm:py-10 lg:col-span-6 lg:col-start-7 lg:px-10">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]">Project inquiry</p>
          <h3 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-slate-950">Request a Walkthrough</h3>
          <p className="mt-4 max-w-xl leading-7 text-slate-600">Share the project scope and timing. City or ZIP is helpful but optional; walkthroughs take place at the project site.</p>

          {showQuoteDialog ? <div role="status" aria-live="polite" className="mt-8 border-l-2 border-[#9a6a25] bg-[#f5f3ee] px-5 py-4 text-slate-700">Request received successfully. We&apos;ll reach out shortly.</div> : null}
          {submitError ? <SubmissionError outcome={submitError} /> : null}

          <form className="mt-9 space-y-7" onSubmit={handleSubmit}>
            <div className="hidden" aria-hidden="true"><label htmlFor="home-contact-website">Website</label><input id="home-contact-website" type="text" value={website} onChange={(event) => setWebsite(event.target.value)} autoComplete="off" tabIndex={-1} /></div>
            <div className="grid gap-7 sm:grid-cols-2">
              <div><label htmlFor="home-contact-name" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Name</label><Input name="name" id="home-contact-name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className={`mt-3 ${fieldClass}`} required /></div>
              <div><label htmlFor="home-contact-phone" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Phone</label><Input name="phone" id="home-contact-phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(801) 000-0000" className={`mt-3 ${fieldClass}`} required /></div>
            </div>
            <div><label htmlFor="home-contact-email" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Email</label><Input name="email" id="home-contact-email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" className={`mt-3 ${fieldClass}`} required /></div>
            <div><label htmlFor="home-contact-project-type" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Project type</label><select name="projectType" id="home-contact-project-type" value={projectType} onChange={(event) => setProjectType(event.target.value)} className={`mt-3 w-full ${fieldClass} text-slate-700 focus:outline-none`} required><option value="">Select a type</option><option value="interior">Interior Painting</option><option value="exterior">Exterior Painting</option><option value="cabinets">Cabinets</option><option value="custom">Custom Home</option><option value="complete">Complete Project</option></select></div>
            <div><label htmlFor="home-contact-project-location" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Project city or ZIP (optional)</label><Input name="projectLocation" id="home-contact-project-location" value={projectLocation} onChange={(event) => setProjectLocation(event.target.value)} placeholder="City or ZIP code" className={`mt-3 ${fieldClass}`} /></div>
            <div><label htmlFor="home-contact-message" className="block text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-600">Project details</label><Textarea name="message" id="home-contact-message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Project stage, surfaces, timing, and anything else we should know..." className="mt-3 min-h-32 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:border-[#9a6a25] focus-visible:ring-0" required /></div>
            <Button type="submit" disabled={isSubmitting} className="min-h-14 w-full rounded-none bg-slate-950 px-6 text-xs font-semibold uppercase tracking-[0.13em] text-white shadow-none hover:bg-[#9a6a25] disabled:opacity-60 sm:w-auto">{isSubmitting ? "Sending..." : "Request a Walkthrough"}<ArrowUpRight aria-hidden="true" className="ml-3 h-4 w-4" /></Button>
          </form>
        </div>
      </div>
    </section>
  );
}
