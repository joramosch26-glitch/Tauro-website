import { useState, type FormEvent } from "react";
import { REGEXP_ONLY_DIGITS } from "input-otp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { supabase } from "../lib/supabase";

const genericCodeMessage =
  "If this email is authorized, a verification code has been sent.";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function StaffLogin() {
  const [email, setEmail] = useState("");
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function requestCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedEmail = normalizeEmail(email);

    setError("");
    setMessage("");

    if (!isValidEmail(normalizedEmail)) {
      setError("Enter a valid email address.");
      return;
    }

    setLoading(true);

    try {
      if (supabase) {
        await supabase.auth.signInWithOtp({
          email: normalizedEmail,
          options: { shouldCreateUser: false },
        });
      }

      setSubmittedEmail(normalizedEmail);
      setStep("code");
      setMessage(genericCodeMessage);
    } catch {
      setSubmittedEmail(normalizedEmail);
      setStep("code");
      setMessage(genericCodeMessage);
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!/^\d{6}$/.test(code)) {
      setError("Enter the six-digit verification code.");
      return;
    }

    if (!supabase) return;

    setLoading(true);

    try {
      const { error: verificationError } = await supabase.auth.verifyOtp({
        email: submittedEmail,
        token: code,
        type: "email",
      });

      if (verificationError) {
        setError("The code could not be verified. Check the code and try again.");
      }
    } catch {
      setError("The code could not be verified. Check the code and try again.");
    } finally {
      setLoading(false);
    }
  }

  function changeEmail() {
    setStep("email");
    setCode("");
    setMessage("");
    setError("");
  }

  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-5 py-12 text-[#20211f]"
      data-paint-guide-shell="true"
    >
      <section className="w-full max-w-md border border-[#20211f]/15 bg-white p-7 sm:p-10">
        <img
          alt="Tauro Painting"
          className="mb-9 h-10 w-auto"
          src="/tauro/logo-tauro.png"
        />
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
          Staff Access
        </p>
        <h1 className="font-serif text-4xl leading-tight">Tauro Paint Guide</h1>
        <p className="mt-4 text-sm leading-6 text-[#20211f]/65">
          Sign in with your authorized staff email.
        </p>

        {step === "email" ? (
          <form className="mt-8 space-y-5" onSubmit={requestCode}>
            <div>
              <label className="mb-2 block text-sm font-medium" htmlFor="staff-email">
                Email
              </label>
              <Input
                autoComplete="email"
                className="h-12 rounded-none border-[#20211f]/25 bg-white"
                id="staff-email"
                inputMode="email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </div>
            <Button
              className="h-12 w-full rounded-none bg-[#20211f] uppercase tracking-[0.12em] text-white hover:bg-[#20211f]/90"
              disabled={loading}
              type="submit"
            >
              {loading ? "Sending…" : "Send verification code"}
            </Button>
          </form>
        ) : (
          <form className="mt-8 space-y-5" onSubmit={verifyCode}>
            <div>
              <label className="mb-3 block text-sm font-medium" htmlFor="staff-code">
                Verification code
              </label>
              <InputOTP
                aria-label="Six-digit verification code"
                containerClassName="justify-between"
                id="staff-code"
                inputMode="numeric"
                maxLength={6}
                onChange={setCode}
                pattern={REGEXP_ONLY_DIGITS}
                value={code}
              >
                <InputOTPGroup className="w-full justify-between">
                  {Array.from({ length: 6 }, (_, index) => (
                    <InputOTPSlot
                      className="h-12 w-12 rounded-none border-[#20211f]/25 text-base first:rounded-none last:rounded-none"
                      index={index}
                      key={index}
                    />
                  ))}
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button
              className="h-12 w-full rounded-none bg-[#20211f] uppercase tracking-[0.12em] text-white hover:bg-[#20211f]/90"
              disabled={loading}
              type="submit"
            >
              {loading ? "Verifying…" : "Verify"}
            </Button>
            <button
              className="w-full text-sm underline underline-offset-4"
              onClick={changeEmail}
              type="button"
            >
              Use a different email
            </button>
          </form>
        )}

        {message ? (
          <p className="mt-5 text-sm leading-6 text-[#20211f]/70" role="status">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mt-5 text-sm leading-6 text-[#9c2f2f]" role="alert">
            {error}
          </p>
        ) : null}
      </section>
    </main>
  );
}
