import assert from "node:assert/strict";
import { test } from "node:test";
import { screenInquiryMessage } from "../src/lib/inquiry-screening.js";

// Synthetic paraphrases of the categories reported on Oct 15, 16 and 20.
// They are not copies of the original emails and do not measure real-world accuracy.
const solicitations = [
  ["Wikipedia", "Hello Tauro, we offer Wikipedia page creation and editing services for your company.", "wikipedia_offer"],
  ["financing", "We provide business financing and working capital. Are you interested in our services?", "finance_offer"],
  ["web development", "We offer web development services and can redesign your website. Book a call today.", "digital_services_offer"],
  ["Spanish finance", "Ofrecemos financiamiento y préstamos para hacer crecer su empresa.", "finance_offer"],
  ["Spanish web", "Nuestra agencia ofrece diseño web y páginas web para negocios.", "digital_services_offer"],
  ["case/spacing/zero-width", "WE\n OFFER WIKI\u200bPEDIA page services for businesses.", "wikipedia_offer"],
  ["keyword stuffing", "We offer web design for your painting business. Cabinets, interior, exterior, Lehi 84043.", "digital_services_offer"],
  ["mixed request", "We provide SEO services. Also need cabinets painted at our office.", "digital_services_offer"],
];
for (const [label, message, reason] of solicitations) {
  test(`manual review retains a possible solicitation: ${label}`, () => {
    const result = screenInquiryMessage(message);
    assert.equal(result.disposition, "possible_solicitation");
    assert.ok(result.reasons.includes(reason as typeof result.reasons[number]));
  });
}
const customers = [
  "I need an estimate to paint our kitchen cabinets in Lehi next month.",
  "Can you paint the entire interior of our new home? Plans: https://example.test/plans.pdf",
  "Do you offer financing for cabinet painting?",
  "My funding comes through next month; can you give me a painting quote?",
  "We are a web development company and need our office walls painted.",
  "I found you on Wikipedia and need a quote for my front door.",
  "I work in SEO. We need our conference room repainted.",
  "Necesito pintar mi casa. ¿Ofrecen financiamiento?",
  "¿Cuánto cobran por pintar gabinetes? Vivo en Orem.",
  "Hola, quiero una cotización.",
  "Please call me.",
  "Painting quote?",
  "We offer interior design. Can you paint cabinets for a client?",
  "Our company needs exterior painting and wood stain, not web development.",
  "I need financing information for repainting. You offer great painting services.",
  "",
];
for (const [index, message] of customers.entries()) {
  test(`customer or ambiguous inquiry stays deliverable without a suspicion flag: ${index + 1}`, () => {
    assert.equal(screenInquiryMessage(message).disposition, "unverified_inquiry");
  });
}
test("repeated screening is deterministic and never promotes an inquiry to qualified", () => {
  for (let i = 0; i < 3; i++) {
    assert.deepEqual(screenInquiryMessage(solicitations[0][1]), {
      disposition: "possible_solicitation", reasons: ["wikipedia_offer"],
    });
    assert.equal(screenInquiryMessage("Please call me").disposition, "unverified_inquiry");
  }
});
