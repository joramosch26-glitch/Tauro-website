import { useState } from "react";
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
                  ✅ Request received! We&apos;ll reach out shortly.
                </div>
              ) : null}

              <form
                className="space-y-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  setShowQuoteDialog(true);
                }}
              >
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Name
                    </label>
                    <Input placeholder="Your name" className="border-slate-200 h-12" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Phone
                    </label>
                    <Input placeholder="(801) 000-0000" className="border-slate-200 h-12" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Email
                  </label>
                  <Input
                    type="email"
                    placeholder="you@email.com"
                    className="border-slate-200 h-12"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Project Type
                  </label>
                  <select className="w-full h-12 px-4 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500">
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
                    placeholder="Tell us about your project..."
                    className="border-slate-200 min-h-[120px]"
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-amber-500 hover:bg-amber-600 text-slate-900 font-semibold h-12"
                >
                  Submit Request
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