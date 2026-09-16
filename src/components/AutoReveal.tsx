import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/**
 * Progressive enhancement for meaningful section content groups.
 *
 * Static HTML remains visible. Once JavaScript is available, only content
 * below the initial reading area is prepared for a scroll reveal. Section
 * backgrounds are never hidden, so alternating architectural panels keep
 * their intended rhythm as the next content group approaches.
 */
export default function AutoReveal() {
  const location = useLocation();

  useLayoutEffect(() => {
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
    const SECTION_SELECTOR = [
      ":scope > section",
      ":scope > article",
      ":scope > div > section",
      ":scope > div > article",
    ].join(",");
    const EXPLICIT_SELECTOR = [
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
    const initialScrollY = window.scrollY;
    const initiallyPrepared = new Set<HTMLElement>();
    const pending = new Set<HTMLElement>();
    let motionFrame = 0;
    let observeFrame = 0;
    let scrollFrame = 0;
    let observer: IntersectionObserver;

    const isEligible = (element: Element) => {
      if (!(element instanceof HTMLElement)) return false;
      if (element.dataset.noReveal === "true") return false;
      if (element.closest("nav, footer, [role='dialog']")) return false;

      const { width, height } = element.getBoundingClientRect();
      return width >= 8 && height >= 8;
    };

    const reveal = (element: HTMLElement) => {
      element.classList.add(VISIBLE_CLASS);
      pending.delete(element);
      observer.unobserve(element);
    };

    const revealApproachingTargets = () => {
      const revealBoundary = window.innerHeight * 0.8;
      const hasMeaningfullyScrolled = window.scrollY - initialScrollY >= 48;

      for (const element of [...pending]) {
        const { top } = element.getBoundingClientRect();
        if (top > revealBoundary) continue;

        // An initial sliver of the next panel should not consume its reveal.
        if (initiallyPrepared.has(element) && !hasMeaningfullyScrolled) continue;

        reveal(element);
      }
    };

    const scheduleProximityCheck = () => {
      if (scrollFrame) return;
      scrollFrame = window.requestAnimationFrame(() => {
        scrollFrame = 0;
        revealApproachingTargets();
      });
    };

    observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const element = entry.target as HTMLElement;

          if (initiallyPrepared.has(element) && window.scrollY - initialScrollY < 48) {
            continue;
          }

          reveal(element);
        }
      },
      { threshold: 0, rootMargin: "0px 0px -20% 0px" },
    );

    const sectionContentGroups = Array.from(main.querySelectorAll(SECTION_SELECTOR))
      .map((section) => Array.from(section.children).find((child) => child instanceof HTMLElement && child.matches("div, article")))
      .filter((element): element is HTMLElement => Boolean(element))
      .filter(isEligible);
    const explicitTargets = Array.from(main.querySelectorAll(EXPLICIT_SELECTOR)).filter(isEligible) as HTMLElement[];
    const explicitTargetSet = new Set(explicitTargets);
    const targets = Array.from(new Set([...sectionContentGroups, ...explicitTargets])).filter((element) => {
      if (explicitTargetSet.has(element)) {
        return !explicitTargets.some((target) => target !== element && target.contains(element));
      }

      // An explicit group is more precise than its containing section wrapper.
      return !explicitTargets.some((target) => element.contains(target));
    });

    const prepare = (element: HTMLElement) => {
      const { top } = element.getBoundingClientRect();
      const initialReadingBoundary = window.innerHeight * 0.65;

      // The hero and content clearly in the first reading area remain immediate.
      if (top < initialReadingBoundary) return;

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

      // React Strict Mode runs an initial cleanup/setup cycle in development.
      // Clear the cleanup's visible safety class before preparing again.
      element.classList.remove(VISIBLE_CLASS);
      element.classList.add(AUTO_CLASS);
      pending.add(element);
      initiallyPrepared.add(element);
    };

    // Layout effect prepares below-fold groups before paint. Two animation frames
    // then enable transitions and observation separately, so hidden styles are
    // painted before any target can become visible.
    for (const element of targets) prepare(element);

    motionFrame = window.requestAnimationFrame(() => {
      main.classList.add("auto-reveal-motion-ready");
      observeFrame = window.requestAnimationFrame(() => {
        for (const element of pending) observer.observe(element);
        revealApproachingTargets();
      });
    });

    window.addEventListener("scroll", scheduleProximityCheck, { passive: true });
    window.addEventListener("resize", scheduleProximityCheck);

    return () => {
      window.cancelAnimationFrame(motionFrame);
      window.cancelAnimationFrame(observeFrame);
      window.cancelAnimationFrame(scrollFrame);
      window.removeEventListener("scroll", scheduleProximityCheck);
      window.removeEventListener("resize", scheduleProximityCheck);
      for (const element of pending) element.classList.add(VISIBLE_CLASS);
      main.classList.remove("auto-reveal-motion-ready");
      observer.disconnect();
    };
  }, [location.pathname]);

  return (
    <style>
      {`
        .auto-reveal {
          opacity: 0;
          transform: translate3d(0, 40px, 0);
        }
        .auto-reveal.auto-reveal-slide-left {
          transform: translate3d(-38px, 0, 0);
        }
        .auto-reveal.auto-reveal-slide-right {
          transform: translate3d(38px, 0, 0);
        }
        .auto-reveal.auto-reveal-scale {
          transform: scale(0.985);
        }
        .auto-reveal.auto-reveal-visible {
          opacity: 1;
          transform: translate3d(0, 0, 0);
        }
        .auto-reveal-motion-ready .auto-reveal {
          transition: opacity 1100ms cubic-bezier(0.16, 1, 0.3, 1), transform 1100ms cubic-bezier(0.16, 1, 0.3, 1);
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
