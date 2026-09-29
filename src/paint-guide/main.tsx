import "../index.css";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import PaintGuideApp from "./PaintGuideApp";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <PaintGuideApp />
    </BrowserRouter>
  </React.StrictMode>,
);
