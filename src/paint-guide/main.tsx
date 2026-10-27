import "../index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HomeownerPage } from "./homeowner/HomeownerPage";
import { initializeHomeownerNavigationController } from "./homeowner/bootstrap";
import { resolvePaintGuideEntry } from "./homeowner/fragment";

const root = ReactDOM.createRoot(document.getElementById("root")!);
const entry = resolvePaintGuideEntry(window.location.pathname, import.meta.env.VITE_TAURO_PG_ENVIRONMENT);
const syntheticStaffTestEnabled = import.meta.env.VITE_TAURO_PG_SYNTHETIC_STAFF_TEST_ENABLED === "true";
if (entry === "homeowner") {
  initializeHomeownerNavigationController();
  root.render(<React.StrictMode><HomeownerPage /></React.StrictMode>);
} else if (entry === "preview_restricted" && syntheticStaffTestEnabled
  && window.location.pathname === "/paint-guide/qa-synthetic") {
  void import("./homeowner/SyntheticPreviewTestPage").then(({ SyntheticPreviewTestPage }) => {
    root.render(<React.StrictMode><SyntheticPreviewTestPage /></React.StrictMode>);
  });
} else if (entry === "preview_restricted") {
  root.render(<main className="flex min-h-screen items-center justify-center bg-[#f5f1e8] px-6 py-16 text-[#20211f]">
    <section className="w-full max-w-2xl border border-[#20211f]/15 bg-white p-8 sm:p-12">
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-[#9b6b36]">Tauro Painting</p>
      <h1 className="font-serif text-4xl leading-tight sm:text-5xl">Private homeowner preview</h1>
      <p className="mt-5 text-[#20211f]/65">Open an authorized homeowner guide link to continue.</p>
    </section>
  </main>);
} else {
  void import("./PaintGuideApp").then(({ default: PaintGuideApp }) => {
    root.render(<React.StrictMode><BrowserRouter><PaintGuideApp /></BrowserRouter></React.StrictMode>);
  });
}

