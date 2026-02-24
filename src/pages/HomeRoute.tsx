import { useEffect } from "react";

import ProjectsSection from "../components/ProjectsSection";
import AboutSection from "../components/AboutSection";
import ContactSection from "../components/ContactSection";
import Services from "./Services";
import TestimonialsSection from "../components/TestimonialsSection";

export default function HomeRoute() {
  useEffect(() => {
  document.title = "Tauro Painting | Professional House Painters in Utah";

  const desc =
    "Tauro Painting provides professional interior and exterior painting in Utah. Reliable house painters for homes and businesses. Free estimates.";
  let meta = document.querySelector('meta[name="description"]') as HTMLMetaElement | null;
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "description";
    document.head.appendChild(meta);
  }
  meta.content = desc;
}, []);
  useEffect(() => {
    document.title = "Tauro Painting | Professional Residential & Commercial Painting";
  }, []);

  return (
    <>
      {/* Por ahora reutilizamos la página Services como sección en Home */}
      <Services />

      <ProjectsSection />

      <TestimonialsSection />

      <AboutSection />
      <ContactSection />
    </>
  );
}