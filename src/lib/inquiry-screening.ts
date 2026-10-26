/** Conservative triage, not proof that an inquiry is genuine or spam. */
export const INQUIRY_SCREENING_VERSION = "1";
export type ScreeningReason = "wikipedia_offer" | "finance_offer" | "digital_services_offer";
export interface InquiryScreening {
  disposition: "unverified_inquiry" | "possible_solicitation";
  reasons: ScreeningReason[];
}

const OFFER = /\b(?:we|i)\s+(?:can\s+)?(?:offer|provide|specialize|help|build|create|design|develop)\b|\bour\s+(?:services|agency)\b|\b(?:interested in|grow your business|increase your leads|pre[- ]?approved)\b|\b(?:ofrecemos|ofrezco|brindamos|nuestros servicios|nuestra agencia|podemos ayudar|puedo ayudar|le ofrecemos|te ofrecemos)\b/g;
const SERVICES: ReadonlyArray<{ reason: ScreeningReason; pattern: RegExp }> = [
  { reason: "wikipedia_offer", pattern: /\bwikipedia\b/g },
  { reason: "finance_offer", pattern: /\b(?:financing|funding|business loans?|working capital|business credit|financiamiento|prestamos?|capital de trabajo)\b/g },
  { reason: "digital_services_offer", pattern: /\b(?:web(?:site)?\s+(?:design|development|redesign)|(?:design|develop|redesign|build|create)\s+(?:a |your |the )?(?:new )?website|seo|search engine optimization|digital marketing|desarrollo web|diseno web|paginas? web|marketing digital)\b/g },
];

/** Reusable by an ingestion worker: inspect the message itself, never project type or location. */
export function screenInquiryMessage(message: string): InquiryScreening {
  const normalized = message.normalize("NFKD").replace(/[\u0300-\u036f\u200b-\u200d\ufeff]/g, "")
    .toLowerCase().replace(/\s+/g, " ");
  const offers = [...normalized.matchAll(OFFER)].map((match) => match.index);
  // Require an offer near the unrelated service; a keyword alone never rejects a customer.
  const reasons = SERVICES.filter(({ pattern }) => [...normalized.matchAll(pattern)]
    .some((service) => offers.some((offer) => Math.abs(service.index - offer) <= 240)))
    .map(({ reason }) => reason);
  return { disposition: reasons.length ? "possible_solicitation" : "unverified_inquiry", reasons };
}
