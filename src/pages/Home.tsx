import ProjectsSection from "../components/ProjectsSection";
import AboutSection from "../components/AboutSection";
import ContactSection from "../components/ContactSection";
import Services from "./Services";
import TestimonialsSection from "../components/TestimonialsSection";

export default function Home() {
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