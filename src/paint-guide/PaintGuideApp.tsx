import { Link, Outlet, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireStaffAuth } from "./auth/RequireStaffAuth";
import { GuideDashboard } from "./pages/GuideDashboard";
import { GuideOverview } from "./pages/GuideOverview";
import { NewGuide } from "./pages/NewGuide";
import { GuideLocations } from "./pages/GuideLocations";

type PaintGuideScreenProps = {
  title: string;
};

function PaintGuideScreen({ title }: PaintGuideScreenProps) {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]"
      data-paint-guide-shell="true"
    >
      <section className="w-full max-w-2xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">
          Tauro Painting
        </p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">{title}</h1>
      </section>
    </main>
  );
}

function PaintGuideNotFound() {
  return (
    <main
      className="flex min-h-screen items-center justify-center bg-[#20211f] px-6 py-16 text-[#f5f1e8]"
      data-paint-guide-shell="true"
    >
      <section className="w-full max-w-2xl">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#c78b47]">
          Paint Guide
        </p>
        <h1 className="font-serif text-4xl leading-tight sm:text-5xl">
          Page not found
        </h1>
        <Link
          className="mt-8 inline-flex border border-current px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em]"
          to="/paint-guide"
        >
          Back to Paint Guide
        </Link>
      </section>
    </main>
  );
}

function StaffRoute({ children }: { children: React.ReactNode }) {
  return <RequireStaffAuth>{children}</RequireStaffAuth>;
}

function StaffAuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  );
}

export default function PaintGuideApp() {
  return (
    <Routes>
      <Route element={<StaffAuthLayout />}>
        <Route
          path="/paint-guide"
          element={
            <StaffRoute>
              <GuideDashboard />
            </StaffRoute>
          }
        />
        <Route
          path="/paint-guide/new"
          element={
            <StaffRoute>
              <NewGuide />
            </StaffRoute>
          }
        />
        <Route
          path="/paint-guide/g/:guideId"
          element={
            <StaffRoute>
              <GuideOverview />
            </StaffRoute>
          }
        />
        <Route path="/paint-guide/g/:guideId/locations" element={<StaffRoute><GuideLocations /></StaffRoute>} />
        <Route
          path="/paint-guide/g/:guideId/preview"
          element={
            <StaffRoute>
              <PaintGuideScreen title="Paint Guide Preview" />
            </StaffRoute>
          }
        />
      </Route>
      <Route path="/paint-guide/p" element={<PaintGuideScreen title="Paint Guide Client" />} />
      <Route path="/paint-guide/*" element={<PaintGuideNotFound />} />
    </Routes>
  );
}
