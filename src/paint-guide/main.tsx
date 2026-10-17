import "../index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { HomeownerPage } from "./homeowner/HomeownerPage";
import { initializeHomeownerNavigationController } from "./homeowner/bootstrap";
import { isHomeownerPath } from "./homeowner/fragment";

const root = ReactDOM.createRoot(document.getElementById("root")!);
if (isHomeownerPath(window.location.pathname)) {
  initializeHomeownerNavigationController();
  root.render(<React.StrictMode><HomeownerPage /></React.StrictMode>);
} else {
  void import("./PaintGuideApp").then(({ default: PaintGuideApp }) => {
    root.render(<React.StrictMode><BrowserRouter><PaintGuideApp /></BrowserRouter></React.StrictMode>);
  });
}
