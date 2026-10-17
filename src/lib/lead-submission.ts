export interface LeadInquiry {
  name: string;
  phone: string;
  email: string;
  projectType: string;
  projectLocation: string;
  message: string;
}

export type LeadSubmissionOutcome = "rejected" | "unconfirmed" | "duplicate" | "timed_out";
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
): Promise<void> {
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new LeadSubmissionError("timed_out"));
    }, LEAD_SUBMISSION_TIMEOUT_MS);
  });

  const request = (async () => {
    const response = await fetch("https://formsubmit.co/ajax/tauropaintingutah@gmail.com", {
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
    } catch {
      throw new LeadSubmissionError("unconfirmed");
    }

    if (result.success === true || result.success === "true") {
      return;
    }

    if (
      result.success === false ||
      result.success === "false" ||
      result.error
    ) {
      throw new LeadSubmissionError("rejected");
    }

    throw new LeadSubmissionError("unconfirmed");
  })();

  try {
    await Promise.race([request, timeout]);
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
