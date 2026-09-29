import type { ReactNode } from "react";
import { StaffLogin } from "./StaffLogin";
import { useAuth } from "./useAuth";

type RequireStaffAuthProps = {
  children: ReactNode;
};

export function RequireStaffAuth({ children }: RequireStaffAuthProps) {
  const { configured, loading, session } = useAuth();

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

  if (loading) {
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

  if (!session) return <StaffLogin />;

  // Temporary Phase 2A gate: any authenticated Supabase user is treated as staff.
  // OWNER/SUPERVISOR authorization will be enforced after profiles and RLS exist.
  return children;
}
