export interface LeadInquiry {
  name: string;
  phone: string;
  email: string;
  projectType: string;
  projectLocation: string;
  message: string;
}

export const DEFAULT_LEAD_RECIPIENT = "tauropaintingutah@gmail.com";
export const OFFICE_TEST_RECIPIENT = "office@tauropainting.com";
export type LeadSubmissionRecipient =
  | typeof DEFAULT_LEAD_RECIPIENT
  | typeof OFFICE_TEST_RECIPIENT;

export type LeadSubmissionOutcome = "rejected" | "unconfirmed" | "duplicate" | "timed_out" | "submitted_unconfirmed";
export type LeadSubmissionResult = "accepted" | "submitted_unconfirmed";
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
  recipient: LeadSubmissionRecipient = DEFAULT_LEAD_RECIPIENT,
): Promise<LeadSubmissionResult> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new LeadSubmissionError("timed_out"));
    }, LEAD_SUBMISSION_TIMEOUT_MS);
  });

  const request = (async () => {
    const response = await fetch(`https://formsubmit.co/ajax/${recipient}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        ...inquiry,
        submittedFrom,
        _subject: `New Tauro Painting lead — ${inquiry.name || "Website Form"}`,
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
      return "accepted";
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
