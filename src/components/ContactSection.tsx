import { FormEvent, useState } from "react";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Instagram,
  Facebook,
  ArrowUpRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ContactSection() {
  const [showQuoteDialog, setShowQuoteDialog] = useState(false);

    const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [projectType, setProjectType] = useState("");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [lastSubmittedSignature, setLastSubmittedSignature] = useState("");
const [lastSubmittedAt, setLastSubmittedAt] = useState(0);

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
  if (isSubmitting) return;

  e.preventDefault();
  const submissionSignature = JSON.stringify({
  name: name.trim(),
  phone: phone.trim(),
  email: email.trim(),
  projectType,
  message: message.trim(),
});

const now = Date.now();
const isDuplicateRecentSubmission =
  submissionSignature === lastSubmittedSignature &&
  now - lastSubmittedAt < 60000;

if (isDuplicateRecentSubmission) {
  setSubmitError("This request was already sent. Please wait a minute before sending the same message again.");
  return;
}
    setIsSubmitting(true);
    setShowQuoteDialog(false);
    setSubmitError("");

    try {
      const response = await fetch("https://formsubmit.co/ajax/tauropaintingutah@gmail.com", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          phone,
          email,
          projectType,
          message,
          _subject: "New Tauro Painting quote request",
        }),
      });

      if (!response.ok) {
        throw new Error("Form submission failed");
      }

      setShowQuoteDialog(true);
setLastSubmittedSignature(submissionSignature);
setLastSubmittedAt(now);
setName("");
setPhone("");
setEmail("");
setProjectType("");
setMessage("");
    } catch (error) {
      console.error("Contact form error:", error);
setSubmitError("There was a problem sending your request. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="py-24 lg:py-32 bg-slate-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16">
          {/* Contact Info */}
          <div className="reveal reveal-slide-right">
            <span className="inline-flex items-center gap-2 text-amber-600 font-semibold text-sm uppercase tracking-wider mb-4">
              <Phone className="w-4 h-4" />
              Contact Us
            </span>
            <h2 className="text-4xl lg:text-5xl font-bold text-slate-900 mb-6">
              Start Your Project
            </h2>
            <p className="text-slate-600 mb-10 leading-relaxed">
              We&apos;re here to help transform your home. Contact us by phone,
              email, or fill out the form and we&apos;ll get back to you within 24 hours.
            </p>

            <div className="space-y-6">
              {[
                {
                  icon: <Phone className="w-5 h-5" />,
                  label: "Phone",
                  value: "(801) 928-9520",
                  href: "tel:8019289520",
                },
                {
                  icon: <Mail className="w-5 h-5" />,
                  label: "Email",
                  value: "tauropaintingutah@gmail.com",
                  href: "mailto:tauropaintingutah@gmail.com",
                },
                {
                  icon: <MapPin className="w-5 h-5" />,
                  label: "Address",
                  value: "1144 N Main St, Orem, UT 84057",
                  href: "#",
                },
                {
                  icon: <Clock className="w-5 h-5" />,
                  label: "Hours",
                  value: "Mon-Fri: 8AM-6PM | Sat: 9AM-2PM",
                  href: "#",
                },
              ].map((item, index) => (
                <a key={index} href={item.href} className="flex items-start gap-4 group">
                  <div className="w-12 h-12 rounded-xl bg-amber-100 flex items-center justify-center text-amber-600 group-hover:bg-amber-500 group-hover:text-white transition-colors">
                    {item.icon}
                  </div>
                  <div>
                    <h4 className="font-semibold text-slate-900 text-sm mb-1">
                      {item.label}
                    </h4>
                    <p className="text-slate-600 group-hover:text-amber-600 transition-colors">
                      {item.value}
                    </p>
                  </div>
                </a>
              ))}
            </div>

            {/* Social Links */}
            <div className="mt-10 pt-8 border-t border-slate-200">
              <h4 className="font-semibold text-slate-900 mb-4">Follow Us</h4>
              <div className="flex gap-3">
                <a
                  href="https://www.instagram.com/tauropainting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-amber-500 hover:text-white transition-colors"
                >
                  <Instagram className="w-5 h-5" />
                </a>
                <a
                  href="https://www.facebook.com/tauropainting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-12 h-12 rounded-xl bg-slate-200 flex items-center justify-center text-slate-600 hover:bg-amber-500 hover:text-white transition-colors"
                >
                  <Facebook className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>

          {/* Contact Form */}
          <div className="reveal reveal-slide-left" style={{ transitionDelay: "200ms" }}>
            <div className="bg-white rounded-2xl p-8 lg:p-10 shadow-lg">
              <h3 className="text-2xl font-bold text-slate-900 mb-2">Request a Quote</h3>
              <p className="text-slate-600 mb-8">
                Fill out the form and we&apos;ll contact you soon.
              </p>

              {showQuoteDialog ? (
  <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-slate-700">
    ✅ Request received successfully. We&apos;ll reach out shortly.
  </div>
) : null}

{submitError ? (
  <div className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
    {submitError}
  </div>
) : null}

              <form className="space-y-5" onSubmit={handleSubmit}>

                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Name
                    </label>
                    <Input
  name="name"
  value={name}
  onChange={(e) => setName(e.target.value)}
  placeholder="Your name"
  className="border-slate-200 h-12"
  required
/>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone
                    </label>
                    <Input
  name="phone"
  value={phone}
  onChange={(e) => setPhone(e.target.value)}
  placeholder="(801) 000-0000"
  className="border-slate-200 h-12"
  required
/>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <Input
  name="email"
  type="email"
  value={email}
  onChange={(e) => setEmail(e.target.value)}
  placeholder="you@email.com"
  className="border-slate-200 h-12"
  required
/>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Type
                  </label>
                  
                  <select
  name="projectType"
  value={projectType}
  onChange={(e) => setProjectType(e.target.value)}
  className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
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
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Message
                  </label>
                  
                  <Textarea
  name="message"
  value={message}
  onChange={(e) => setMessage(e.target.value)}
  placeholder="Tell us about your project..."
  className="border-slate-200 min-h-[120px]"
  required
/>

                </div>

                <Button
  type="submit"
  disabled={isSubmitting}
  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-12"
>
  {isSubmitting ? "Sending..." : "Submit Request"}
  <ArrowUpRight className="w-5 h-5 ml-2" />
</Button>

              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}