import type { LeadSubmissionOutcome } from "@/lib/lead-submission";

interface SubmissionErrorProps {
  outcome: LeadSubmissionOutcome;
}

export default function SubmissionError({ outcome }: SubmissionErrorProps) {
  const message = outcome === "rejected"
    ? "The form service could not accept your request. Your details are still here; please try again."
    : outcome === "duplicate"
      ? "This request was sent recently. Please wait before trying again, or call us if you need to confirm it."
      : "We could not confirm whether your request was received. Your details are still here; please call us before trying again.";

  return (
    <div role="alert" aria-live="assertive" className="mt-8 border-l-2 border-[#a64036] bg-red-50 px-5 py-4 text-red-900">
      <p>{message}</p>
      <a href="tel:8019289520" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        Call Tauro at (801) 928-9520
      </a>
    </div>
  );
}
