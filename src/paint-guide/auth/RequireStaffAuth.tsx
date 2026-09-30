import { useState, type ReactNode } from "react";
import { StaffLogin } from "./StaffLogin";
import { useAuth } from "./useAuth";

type RequireStaffAuthProps = {
  children: ReactNode;
};

export function RequireStaffAuth({ children }: RequireStaffAuthProps) {
  const { authState, configured } = useAuth();

  if (!configured) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]"
        data-paint-guide-shell="true"
      >
        <section className="w-full max-w-xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
            Tauro Paint Guide
          </p>
          <h1 className="font-serif text-3xl leading-tight sm:text-4xl">
            Authentication unavailable
          </h1>
          <p className="mt-4 leading-7 text-[#20211f]/65">
            Paint Guide authentication is not configured for this environment.
          </p>
        </section>
      </main>
    );
  }

  if (authState === "loading") {
    return (
      <main
        aria-busy="true"
        className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 text-[#20211f]"
        data-paint-guide-shell="true"
      >
        <p className="text-sm uppercase tracking-[0.16em]">Loading Paint Guide…</p>
      </main>
    );
  }

  if (authState === "unauthenticated") return <StaffLogin />;

  if (authState === "inactive") {
    return (
      <StaffAccessMessage
        description="This staff profile is inactive. Contact the Paint Guide owner if access should be restored."
        title="Staff access inactive"
      />
    );
  }

  if (authState === "unauthorized") {
    return (
      <StaffAccessMessage
        description="This account is not authorized to access the Tauro Paint Guide."
        title="Staff access unavailable"
      />
    );
  }

  if (
    authState !== "authorized_owner" &&
    authState !== "authorized_supervisor"
  ) {
    return (
      <StaffAccessMessage
        description="This account is not authorized to access the Tauro Paint Guide."
        title="Staff access unavailable"
      />
    );
  }

  return children;
}

type StaffAccessMessageProps = {
  title: string;
  description: string;
};

function StaffAccessMessage({ title, description }: StaffAccessMessageProps) {
  const { signOut } = useAuth();
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
      className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]"
      data-paint-guide-shell="true"
    >
      <section className="w-full max-w-xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
          Tauro Paint Guide
        </p>
        <h1 className="font-serif text-3xl leading-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-7 text-[#20211f]/65">{description}</p>
        <button
          className="mt-8 border border-[#20211f] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em]"
          onClick={() => void handleSignOut()}
          type="button"
        >
          Sign Out
        </button>
        {signOutError ? (
          <p className="mt-4 text-sm text-[#9c2f2f]" role="alert">
            {signOutError}
          </p>
        ) : null}
      </section>
    </main>
  );
}
