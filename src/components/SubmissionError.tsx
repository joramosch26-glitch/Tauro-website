import type { LeadSubmissionOutcome } from "@/lib/lead-submission";

interface SubmissionErrorProps {
  outcome: LeadSubmissionOutcome;
}

export default function SubmissionError({ outcome }: SubmissionErrorProps) {
  const submittedUnconfirmed = outcome === "submitted_unconfirmed";
  const message = outcome === "rejected"
    ? "The form service could not accept your request. Your details are still here; please try again."
    : outcome === "timed_out"
      ? "This is taking longer than expected, and we could not confirm whether your request was received. Your details are still here. Please call us to confirm before sending again."
    : outcome === "duplicate"
      ? "This request was sent recently. Please wait before trying again, or call us if you need to confirm it."
      : "We could not confirm whether your request was received. Your details are still here; please call us before trying again.";

  return (
    <div
      role={submittedUnconfirmed ? "status" : "alert"}
      aria-live={submittedUnconfirmed ? "polite" : "assertive"}
      className={`mt-8 border-l-2 px-5 py-4 ${submittedUnconfirmed ? "border-[#9a6a25] bg-[#f5f3ee] text-slate-800" : "border-[#a64036] bg-red-50 text-red-900"}`}
    >
      {submittedUnconfirmed ? (
        <>
          <p className="font-semibold">Request submitted; receipt unconfirmed.</p>
          <p className="mt-1">The form service responded, but did not confirm receipt. Your details are still here. Please call us to confirm before sending again.</p>
        </>
      ) : <p>{message}</p>}
      <a href="tel:8019289520" className="mt-3 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
        Call Tauro at (801) 928-9520
      </a>
    </div>
  );
}
