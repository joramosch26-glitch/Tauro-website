import { useEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * A small, progressive-enhancement reveal for page-level content groups.
 *
 * Content is visible by default. JavaScript only prepares sections that start
 * below the initial viewport, so a missing observer (or an interrupted script)
 * never leaves a page hidden.
 */
export default function AutoReveal() {
  const location = useLocation();

  useEffect(() => {
    if (
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ||
      !("IntersectionObserver" in window)
    ) {
      return;
    }

    const main = document.querySelector("main");
    if (!main) return;

    const AUTO_CLASS = "auto-reveal";
    const VISIBLE_CLASS = "auto-reveal-visible";
    const PAGE_TARGET_SELECTOR = [
      ":scope > section",
      ":scope > article",
      ":scope > div > section",
      ":scope > div > article",
    ].join(",");
    const EXPLICIT_TARGET_SELECTOR = [
      "[data-reveal='true']",
      ".reveal",
      ".reveal-fade-up",
      ".reveal-slide-left",
      ".reveal-slide-right",
      ".reveal-scale",
      ".fade-up",
      ".slide-left",
      ".slide-right",
      ".scale",
    ].join(",");

    const isEligible = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.dataset.noReveal === "true") return false;
      if (element.closest("nav, footer, [role='dialog']")) return false;

      const { width, height } = element.getBoundingClientRect();
      return width >= 8 && height >= 8;
    };

    const pending = new Set<HTMLElement>();
    let scrollFrame = 0;

    const reveal = (element: HTMLElement) => {
      element.classList.add(VISIBLE_CLASS);
      pending.delete(element);
      observer.unobserve(element);
    };

    // This also protects against a delayed observer callback without revealing
    // targets the visitor has not approached yet.
    const revealApproachingTargets = () => {
      const revealBoundary = window.innerHeight * 0.96;

      for (const element of [...pending]) {
        const { top, bottom } = element.getBoundingClientRect();
        if (top < revealBoundary && bottom > 0) reveal(element);
      }
    };

    const scheduleProximityCheck = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        revealApproachingTargets();
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -4% 0px" },
    );

    // One post-render scan per route: no mutation observer and no recursive
    // descendant targeting. This caps work at the handful of page sections.
    const scanFrame = window.requestAnimationFrame(() => {
      const pageTargets = Array.from(main.querySelectorAll(PAGE_TARGET_SELECTOR)).filter(isEligible) as HTMLElement[];
      const explicitTargets = Array.from(main.querySelectorAll(EXPLICIT_TARGET_SELECTOR)).filter(isEligible) as HTMLElement[];
      const explicitTargetSet = new Set(explicitTargets);
      const targets = Array.from(new Set([...pageTargets, ...explicitTargets])).filter((element) => {
        if (explicitTargetSet.has(element)) {
          return !explicitTargets.some((target) => target !== element && target.contains(element));
        }

        // Explicit groups are more intentional than their enclosing section.
        return !explicitTargets.some((target) => element.contains(target));
      });

      for (const element of targets) {
        const { top } = element.getBoundingClientRect();

        // Keep the hero and content already in view immediate.
        if (top < window.innerHeight) continue;

        const variant = element.dataset.revealVariant;
        if (variant === "slide-left" || element.classList.contains("reveal-slide-left") || element.classList.contains("slide-left")) {
          element.classList.add("auto-reveal-slide-left");
        } else if (variant === "slide-right" || element.classList.contains("reveal-slide-right") || element.classList.contains("slide-right")) {
          element.classList.add("auto-reveal-slide-right");
        } else if (variant === "scale" || element.classList.contains("reveal-scale") || element.classList.contains("scale")) {
          element.classList.add("auto-reveal-scale");
        } else {
          element.classList.add("auto-reveal-fade-up");
        }
        element.classList.add(AUTO_CLASS);
        pending.add(element);
        observer.observe(element);
      }

      revealApproachingTargets();
    });

    window.addEventListener("scroll", scheduleProximityCheck, { passive: true });
    window.addEventListener("resize", scheduleProximityCheck);

    return () => {
      window.cancelAnimationFrame(scanFrame);
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", scheduleProximityCheck);
      window.removeEventListener("resize", scheduleProximityCheck);
      for (const element of pending) element.classList.add(VISIBLE_CLASS);
      observer.disconnect();
    };
  }, [location.pathname]);

  // Inline CSS for auto reveal (scoped classes)
  return (
    <style>
      {`
        .auto-reveal {
          opacity: 0;
          transform: translate3d(0, 22px, 0);
          transition: opacity 650ms cubic-bezier(0.16, 1, 0.3, 1), transform 650ms cubic-bezier(0.16, 1, 0.3, 1);
        }
        .auto-reveal.auto-reveal-slide-left {
          transform: translate3d(-22px, 0, 0);
        }
        .auto-reveal.auto-reveal-slide-right {
          transform: translate3d(22px, 0, 0);
        }
        .auto-reveal.auto-reveal-scale {
          transform: scale(0.975);
        }
        .auto-reveal-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        @media (prefers-reduced-motion: reduce) {
          .auto-reveal, .auto-reveal-visible {
            opacity: 1 !important;
            transform: none !important;
            transition: none !important;
          }
        }
      `}
    </style>
  );
}
