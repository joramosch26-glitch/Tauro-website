import { INQUIRY_SCREENING_VERSION, screenInquiryMessage } from "./inquiry-screening.js";

export interface LeadInquiry {
  name: string;
  phone: string;
  email: string;
  projectType: string;
  projectLocation: string;
  message: string;
}

export type LeadSubmissionOutcome = "rejected" | "unconfirmed" | "duplicate" | "timed_out" | "submitted_unconfirmed";
export type LeadSubmissionResult = "accepted" | "accepted_for_review" | "submitted_unconfirmed";
export const LEAD_SUBMISSION_TIMEOUT_MS = 15_000;

export class LeadSubmissionError extends Error {
  constructor(readonly outcome: LeadSubmissionOutcome) {
    super(`Lead submission ${outcome}`);
    this.name = "LeadSubmissionError";
  }
}

interface FormSubmitResponse {
  success?: boolean | string;
  error?: unknown;
}

export async function submitLeadInquiry(
  inquiry: LeadInquiry,
  submittedFrom: string,
  options: { honeypot?: string } = {},
): Promise<LeadSubmissionResult> {
  if (options.honeypot) throw new LeadSubmissionError("rejected");
  const screening = screenInquiryMessage(inquiry.message);
  const requiresReview = screening.disposition === "possible_solicitation";
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new LeadSubmissionError("timed_out"));
    }, LEAD_SUBMISSION_TIMEOUT_MS);
  });

  const request = (async () => {
    const response = await fetch("https://formsubmit.co/ajax/office@tauropainting.com", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        // Explicit fields prevent caller-supplied control/qualification fields leaking through.
        name: inquiry.name,
        phone: inquiry.phone,
        email: inquiry.email,
        projectType: inquiry.projectType,
        projectLocation: inquiry.projectLocation,
        message: inquiry.message,
        submittedFrom,
        inquiryScreening: screening.disposition,
        screeningReasons: screening.reasons.join(", ") || "none_detected",
        screeningVersion: INQUIRY_SCREENING_VERSION,
        opportunityStatus: "unqualified",
        automationAction: "manual_review",
        _honey: options.honeypot ?? "",
        _subject: requiresReview
          ? "[REVIEW REQUIRED] Tauro Painting inquiry — possible solicitation"
          : "New Tauro Painting inquiry — unverified",
        _replyto: inquiry.email,
        _template: "table",
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new LeadSubmissionError("rejected");
    }

    let result: FormSubmitResponse;
    try {
      result = await response.json() as FormSubmitResponse;
    } catch (error) {
      if (controller.signal.aborted) throw error;
      return "submitted_unconfirmed";
    }

    if (result.success === true || result.success === "true") {
      return requiresReview ? "accepted_for_review" : "accepted";
    }

    if (
      result.success === false ||
      result.success === "false" ||
      result.error
    ) {
      throw new LeadSubmissionError("rejected");
    }

    return "submitted_unconfirmed";
  })();

  try {
    return await Promise.race([request, timeout]);
  } catch (error) {
    if (controller.signal.aborted && !(error instanceof LeadSubmissionError)) {
      throw new LeadSubmissionError("timed_out");
    }
    throw error;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

/** A provider acknowledgment is not sales qualification. Exclude review and unknown outcomes. */
export function shouldRecordLeadConversion(result: LeadSubmissionResult): boolean {
  return result === "accepted";
}
