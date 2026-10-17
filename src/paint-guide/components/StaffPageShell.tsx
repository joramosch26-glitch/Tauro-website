import { Link } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../auth/useAuth";

type StaffPageShellProps = {
  eyebrow?: string;
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
};

export function StaffPageShell({
  eyebrow = "Tauro Paint Guide",
  title,
  children,
  action,
}: StaffPageShellProps) {
  const { profile, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState("");

  async function handleSignOut() {
    setSignOutError("");

    try {
      await signOut();
    } catch {
      setSignOutError("Sign out could not be completed. Please try again.");
    }
  }

  return (
    <main
      className="min-h-screen bg-[#f5f1e8] px-5 py-8 text-[#20211f] sm:px-8 sm:py-12"
      data-paint-guide-shell="true"
    >
      <div className="mx-auto max-w-5xl">
        <header className="flex flex-col gap-6 border-b border-[#20211f]/15 pb-7 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Link
              className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]"
              to="/paint-guide"
            >
              {eyebrow}
            </Link>
            <h1 className="mt-3 font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {action}
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#20211f]/55">
              {profile?.role}
            </span>
            <button
              className="border border-[#20211f]/30 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] transition-colors hover:border-[#20211f] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9b6b36]"
              onClick={() => void handleSignOut()}
              type="button"
            >
              Sign Out
            </button>
          </div>
        </header>
        {signOutError ? (
          <p className="mt-4 text-sm text-[#9c2f2f]" role="alert">
            {signOutError}
          </p>
        ) : null}
        {children}
      </div>
    </main>
  );
}
