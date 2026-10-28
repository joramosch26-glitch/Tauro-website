import { useEffect, useState, useSyncExternalStore } from "react";
import { HomeownerGuideDocument } from "../components/HomeownerGuideDocument.js";
import { getHomeownerNavigationController, type HomeownerBootstrapState } from "./bootstrap.js";
import { buildHomeownerPhotoSources } from "./photo-sources.js";

function HomeownerShell({ children }: { children: React.ReactNode }) { return <main className="min-h-screen bg-[#f5f1e8] px-4 py-6 text-[#20211f] sm:px-8 sm:py-10"><div className="mx-auto w-full max-w-6xl">{children}</div></main>; }
function LoadingGuide() { return <HomeownerShell><section className="border border-[#20211f]/15 bg-[#fffdf8] px-6 py-16 sm:px-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">Tauro Painting</p><h1 className="mt-6 font-serif text-4xl sm:text-5xl">Paint Color Guide</h1><p className="mt-5 text-[#20211f]/65">Loading your paint guide…</p></section></HomeownerShell>; }
function UnavailableGuide() { return <HomeownerShell><section className="border border-[#20211f]/15 bg-[#fffdf8] px-6 py-16 sm:px-10"><p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">Tauro Painting</p><h1 className="mt-6 font-serif text-4xl sm:text-5xl">This paint guide is unavailable.</h1><p className="mt-5 max-w-xl text-[#20211f]/65">Please contact Tauro Painting if you need help with your paint selections.</p></section></HomeownerShell>; }
export function HomeownerPage() {
  const [sessionUnavailable, setSessionUnavailable] = useState(false);
  useEffect(() => {
    const onSessionUnavailable = () => setSessionUnavailable(true);
    window.addEventListener("paintguide:homeowner-session-unavailable", onSessionUnavailable);
    return () => window.removeEventListener("paintguide:homeowner-session-unavailable", onSessionUnavailable);
  }, []);
  const controller = getHomeownerNavigationController();
  const snapshot = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot);
  useEffect(() => setSessionUnavailable(false), [snapshot.generation]);
  const state: HomeownerBootstrapState | null = snapshot.state;
  if (state === null) return <LoadingGuide />;
  if (state.kind === "unavailable") return <UnavailableGuide />;
  const photoSources = buildHomeownerPhotoSources(state.document.photos);
  return <HomeownerShell>
    {sessionUnavailable ? <div className="mb-5 border border-[#9c2f2f]/30 bg-[#fff7f3] p-4 text-sm text-[#792c25]" role="alert">
      This private Paint Guide link may have ended or been disabled. Ask Tauro Painting for a current guide link.
    </div> : null}
    <HomeownerGuideDocument data={state.document} {...photoSources} />
  </HomeownerShell>;
}
