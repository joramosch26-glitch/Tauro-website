import { FormEvent, useState } from "react";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import SubmissionError from "@/components/SubmissionError";
import { LeadSubmissionError, submitLeadInquiry } from "@/lib/lead-submission";

const contactDetails = [
  { label: "Phone", value: "(801) 928-9520", href: "tel:8019289520" },
  { label: "Email", value: "tauropaintingutah@gmail.com", href: "mailto:tauropaintingutah@gmail.com" },
  { label: "Service area", value: "Orem, Utah County & surrounding communities" },
  { label: "Hours", value: "Mon–Fri: 8AM–6PM · Sat: 9AM–2PM" },
];

const fieldClass =
  "h-12 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:border-[#9a6a25] focus-visible:ring-0";
const labelClass = "mb-2 block text-xs font-semibold uppercase tracking-[0.16em] text-slate-600";

export default function Contact() {
  const [showSuccess, setShowSuccess] = useState(false);
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
    setShowSuccess(false);
    setSubmitError(null);

    const submissionSignature = JSON.stringify({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      projectType,
      projectLocation: projectLocation.trim(),
      message: message.trim(),
    });
    const now = Date.now();

    if (
      submissionSignature === lastSubmittedSignature &&
      now - lastSubmittedAt < 60000
    ) {
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
          gtag("event", "generate_lead", {
            form_location: "contact_page",
            project_type: projectType,
            page_path: window.location.pathname,
          });
        }
      } catch {
        // Analytics must not affect a successful form submission.
      }

      setShowSuccess(true);
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
    <div>
      <section aria-labelledby="contact-heading" className="bg-slate-950 text-white">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 py-16 lg:grid-cols-12 lg:items-center lg:gap-16 lg:px-8 lg:py-24">
          <div className="lg:col-span-6">
            <p className="mb-8 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.24em] text-[#c5a374]">
              <span aria-hidden="true" className="h-px w-8 bg-[#a64036]" />
              Start a conversation
            </p>
            <h1
              id="contact-heading"
              className="text-5xl font-semibold leading-[0.98] tracking-[-0.045em] sm:text-7xl lg:text-[5.5rem]"
            >
              Let&apos;s walk<br />
              the project.
            </h1>
            <p className="mt-8 max-w-xl text-lg leading-8 text-white/75">
              Tell us where the project stands, what finishes are involved, and when
              you need us on site.
            </p>
            <p className="mt-5 max-w-lg leading-7 text-white/60">
              We&apos;ll start with the scope, sequence, and details—then talk through
              the right next step for your custom home or residential project.
            </p>
          </div>

          <figure className="lg:col-span-6">
            <img
              src="/tauro/entry-door.webp"
              alt="Custom entry door and architectural wood finish by Tauro Painting"
              fetchPriority="high"
              className="aspect-[5/6] w-full object-cover sm:aspect-[4/3] lg:aspect-[5/6]"
            />
            <figcaption className="mt-4 text-[10px] uppercase tracking-[0.18em] text-white/50">
              Detail begins with a walkthrough.
            </figcaption>
          </figure>
        </div>
      </section>

      <section aria-labelledby="project-details-heading" className="bg-[#f5f3ee] py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-12 lg:gap-20 lg:px-8">
          <aside className="lg:col-span-4">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]">
              Contact Tauro
            </p>
            <h2 className="mt-6 text-3xl font-semibold leading-tight tracking-[-0.035em] text-slate-950">
              Bring us into the details.
            </h2>
            <p className="mt-5 leading-7 text-slate-600">
              Plans, timing, surfaces, and finish expectations all help us understand
              the work. Share what you know; we can work through the rest together.
            </p>

            <dl className="mt-10 border-t border-slate-300">
              {contactDetails.map((detail) => (
                <div key={detail.label} className="border-b border-slate-300 py-5">
                  <dt className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#9a6a25]">
                    {detail.label}
                  </dt>
                  <dd className="mt-2 text-sm leading-6 text-slate-700">
                    {detail.href ? (
                      <a className="transition-colors hover:text-[#9a6a25]" href={detail.href}>
                        {detail.value}
                      </a>
                    ) : (
                      detail.value
                    )}
                  </dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex gap-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
              <a href="https://www.instagram.com/tauropainting" target="_blank" rel="noopener noreferrer" className="border-b border-slate-500 pb-1 hover:text-[#9a6a25]">
                Instagram
              </a>
              <a href="https://www.facebook.com/tauropainting" target="_blank" rel="noopener noreferrer" className="border-b border-slate-500 pb-1 hover:text-[#9a6a25]">
                Facebook
              </a>
            </div>
          </aside>

          <div className="bg-white p-6 sm:p-10 lg:col-span-8 lg:p-14">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]">
              Project inquiry
            </p>
            <h2
              id="project-details-heading"
              className="mt-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl"
            >
              Tell us about the work.
            </h2>
            <p className="mt-5 max-w-xl leading-7 text-slate-600">
              Share the project city or ZIP along with the scope and timing. Walkthroughs take place at the project site.
            </p>

            {showSuccess ? (
              <div role="status" className="mt-8 border-l-2 border-[#9a6a25] bg-[#f5f3ee] px-5 py-4 text-slate-700">
                Request received successfully. We&apos;ll reach out shortly.
              </div>
            ) : null}
            {submitError ? <SubmissionError outcome={submitError} /> : null}

            <form className="mt-10 space-y-7" onSubmit={handleSubmit}>
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="contact-website">Website</label>
                <input
                  id="contact-website"
                  type="text"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>

              <div className="grid gap-7 sm:grid-cols-2">
                <div>
                  <label htmlFor="contact-name" className={labelClass}>Name</label>
                  <Input id="contact-name" name="name" autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="Your name" className={fieldClass} required />
                </div>
                <div>
                  <label htmlFor="contact-phone" className={labelClass}>Phone</label>
                  <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(801) 000-0000" className={fieldClass} required />
                </div>
              </div>

              <div>
                <label htmlFor="contact-email" className={labelClass}>Email</label>
                <Input id="contact-email" name="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@email.com" className={fieldClass} required />
              </div>

              <div>
                <label htmlFor="contact-project-type" className={labelClass}>Project type</label>
                <select
                  id="contact-project-type"
                  name="projectType"
                  value={projectType}
                  onChange={(event) => setProjectType(event.target.value)}
                  className={`${fieldClass} w-full appearance-none text-slate-700 focus:outline-none`}
                  required
                >
                  <option value="">Select a type</option>
                  <option value="interior">Interior Painting</option>
                  <option value="exterior">Exterior Painting</option>
                  <option value="cabinets">Cabinets</option>
                  <option value="custom">Custom Home</option>
                  <option value="complete">Complete Project</option>
                </select>
              </div>

              <div>
                <label htmlFor="contact-project-location" className={labelClass}>Project city or ZIP (optional)</label>
                <Input id="contact-project-location" name="projectLocation" value={projectLocation} onChange={(event) => setProjectLocation(event.target.value)} placeholder="City or ZIP code" className={fieldClass} />
              </div>

              <div>
                <label htmlFor="contact-message" className={labelClass}>Project details</label>
                <Textarea id="contact-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Project stage, surfaces, timing, and anything else we should know..." className="min-h-36 rounded-none border-0 border-b border-slate-300 bg-transparent px-0 shadow-none focus-visible:border-[#9a6a25] focus-visible:ring-0" required />
              </div>

              <Button type="submit" disabled={isSubmitting} className="min-h-14 w-full rounded-none bg-slate-950 px-6 text-xs font-semibold uppercase tracking-[0.13em] text-white shadow-none hover:bg-[#9a6a25] disabled:opacity-60 sm:w-auto">
                {isSubmitting ? "Sending..." : "Request a Walkthrough"}
                <ArrowUpRight aria-hidden="true" className="ml-3 h-4 w-4" />
              </Button>
            </form>
          </div>
        </div>
      </section>

      <section aria-labelledby="next-step-heading" className="bg-white py-20 lg:py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-6 lg:grid-cols-12 lg:gap-16 lg:px-8">
          <figure className="lg:col-span-7">
            <img src="/tauro/bedroom-finish.webp" alt="Finished custom home bedroom interior by Tauro Painting" loading="lazy" className="aspect-[6/5] w-full object-cover" />
          </figure>
          <div className="lg:col-span-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#9a6a25]">What comes next</p>
            <h2 id="next-step-heading" className="mt-6 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-slate-950 sm:text-5xl">A clear first step.</h2>
            <p className="mt-6 leading-8 text-slate-600">We&apos;ll review your project information, follow up with any questions, and arrange an on-site walkthrough when the work is a fit. From there, we can define the scope, materials, and sequence with clarity.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
