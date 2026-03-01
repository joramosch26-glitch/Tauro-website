import HeroSection from "../components/HeroSection";
import ServicesSection from "../components/ServicesSection";
import ProjectsSection from "../components/ProjectsSection";
import TestimonialsSection from "../components/TestimonialsSection";
import AboutSection from "../components/AboutSection";
import ContactSection from "../components/ContactSection";
import ProcessSection from "../components/ProcessSection";
import CTASection from "../components/CTASection";
import StandardSection from "../components/StandardSection";

export default function HomeRoute() {
  return (
    <>
      <HeroSection />
      <ServicesSection />
      <ProjectsSection />
      <StandardSection />
      <ProcessSection />
      <TestimonialsSection />
      <AboutSection />
      <CTASection />
      <ContactSection />
    </>
  );
}