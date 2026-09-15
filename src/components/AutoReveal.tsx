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
    const TARGET_SELECTOR = [
      ":scope > section",
      ":scope > article",
      ":scope > div > section",
      ":scope > div > article",
      "[data-reveal='true']",
    ].join(",");

    const isEligible = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.dataset.noReveal === "true") return false;
      if (element.closest("nav, footer, [role='dialog']")) return false;

      const { width, height } = element.getBoundingClientRect();
      return width >= 8 && height >= 8;
    };

    const pending = new Set<HTMLElement>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) reveal(entry.target as HTMLElement);
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );

    const reveal = (element: HTMLElement) => {
      element.classList.add(VISIBLE_CLASS);
      pending.delete(element);
      observer.unobserve(element);
    };

    // One post-render scan per route: no mutation observer and no recursive
    // descendant targeting. This caps work at the handful of page sections.
    const scanFrame = window.requestAnimationFrame(() => {
      const candidates = Array.from(main.querySelectorAll(TARGET_SELECTOR)).filter(isEligible) as HTMLElement[];
      const targets = candidates.filter(
        (element) => !candidates.some((candidate) => candidate !== element && candidate.contains(element)),
      );

      for (const element of targets) {
        const { top } = element.getBoundingClientRect();

        // Keep the hero and content already entering the viewport immediate.
        if (top < window.innerHeight + 96) continue;

        element.classList.add(AUTO_CLASS);
        pending.add(element);
        observer.observe(element);
      }
    });

    // A brief fail-safe: hidden enhancement state can never persist if an
    // observer callback is delayed after initialization.
    const fallback = window.setTimeout(() => {
      for (const element of [...pending]) reveal(element);
    }, 900);

    return () => {
      window.cancelAnimationFrame(scanFrame);
      window.clearTimeout(fallback);
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
          transform: translate3d(0, 12px, 0);
          transition: opacity 420ms ease-out, transform 420ms ease-out;
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
