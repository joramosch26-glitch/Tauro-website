import React, { useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

/**
 * AutoReveal
 * Global auto-reveal animations inside <main>.
 *
 * - Does NOT rely on legacy .reveal / .animate classes.
 * - Uses IntersectionObserver + MutationObserver to catch late-rendered nodes.
 * - Scoped to <main> only (never touches nav/footer/dialog).
 * - Opt-out: add data-no-reveal="true" on any element.
 */
export default function AutoReveal() {
  const location = useLocation();

  const prefersReducedMotion = useMemo(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false
    );
  }, []);

  useEffect(() => {
    if (prefersReducedMotion) return;

    const main = document.querySelector("main");
    if (!main) return;

    const AUTO_CLASS = "auto-reveal";
    const VISIBLE_CLASS = "auto-reveal-visible";
    const SEEN_DATASET_KEY = "autoreveal"; // data-autoreveal="1"

    const TARGET_SELECTOR = [
      // headings / text
      "h1",
      "h2",
      "h3",
      "h4",
      "p",
      "li",
      // media
      "img",
      "picture",
      "video",
      // common blocks/cards
      "article",
      "section",
      // interactive
      "button",
      // card-ish containers / common layout patterns
      "[class*='card']",
      "[class*='Card']",
      "[class*='shadow']",
      "[class*='rounded']",
      "[class*='grid'] > *",
      "[class*='flex'] > *",
    ].join(",");

    const shouldSkip = (el: Element) => {
      if (!(el instanceof HTMLElement)) return true;

      // opt-out
      if (el.dataset.noReveal === "true") return true;

      // exclude global wrappers
      if (el.closest("nav")) return true;
      if (el.closest("footer")) return true;
      if (el.closest("[role='dialog']")) return true;

      // avoid tiny/invisible
      const rect = el.getBoundingClientRect();
      if (rect.width < 8 || rect.height < 8) return true;

      // avoid empty
      const text = (el.textContent ?? "").trim();
      const hasMedia = el.querySelector("img, picture, video");
      if (!hasMedia && text.length === 0) return true;

      return false;
    };

    const groupKey = (el: Element) => {
      const section =
        el.closest("section") ||
        el.closest("article") ||
        el.closest("[class*='grid']") ||
        el.closest("[class*='flex']") ||
        main;
      return section as Element;
    };

    const groupCounters = new Map<Element, number>();
    const nextIndexInGroup = (el: Element) => {
      const key = groupKey(el);
      const n = groupCounters.get(key) ?? 0;
      groupCounters.set(key, n + 1);
      return n;
    };

    // Only initialize once per element lifetime (even across route navigations)
    const markSeen = (h: HTMLElement) => {
      h.dataset[SEEN_DATASET_KEY] = "1";
    };
    const wasSeen = (h: HTMLElement) => h.dataset[SEEN_DATASET_KEY] === "1";

    const initElement = (h: HTMLElement) => {
      // dedupe: do not re-init an element we've already processed
      if (wasSeen(h)) return;

      // reset visibility state for animation
      h.classList.remove(VISIBLE_CLASS);
      h.classList.add(AUTO_CLASS);

      const idx = nextIndexInGroup(h);
      const delay = Math.min(idx * 60, 420);
      h.style.setProperty("--reveal-delay", `${delay}ms`);

      markSeen(h);
    };

    const scanTargets = () => {
      const raw = Array.from(main.querySelectorAll(TARGET_SELECTOR));
      return raw.filter((el) => !shouldSkip(el)) as HTMLElement[];
    };

    let cancelled = false;

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const h = entry.target as HTMLElement;
          h.classList.add(VISIBLE_CLASS);
          io.unobserve(h);
        }
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -10% 0px",
      }
    );

    const observeAll = () => {
      if (cancelled) return;

      // reset group counters for a fresh, consistent stagger each route scan
      groupCounters.clear();

      const targets = scanTargets();
      if (targets.length === 0) return;

      for (const h of targets) {
        // init only once; but we still want to observe it if not visible yet
        const alreadyInit = wasSeen(h);
        if (!alreadyInit) initElement(h);

        // If it isn't visible yet, observe it (safe even if already visible; IO will unobserve on intersect)
        if (!h.classList.contains(VISIBLE_CLASS)) {
          io.observe(h);
        }
      }
    };

    // Initial scan now + after a tick (helps late mounts right after route change)
    observeAll();

    let raf1 = 0;
    let raf2 = 0;
    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        observeAll();
      });
    });

    // Catch late nodes in <main>
    const mo = new MutationObserver(() => {
      observeAll();
    });
    mo.observe(main, { childList: true, subtree: true });

    // Safety fallback (only reveal things we've already initialized or match targets)
    const fallback = window.setTimeout(() => {
      if (cancelled) return;
      const all = scanTargets();
      for (const h of all) {
        // If it was never initialized (e.g. it appeared late), init it first so it has consistent base class.
        if (!wasSeen(h)) {
          groupCounters.clear();
          initElement(h);
        }
        h.classList.add(VISIBLE_CLASS);
        io.unobserve(h);
      }
    }, 3500);

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
      window.clearTimeout(fallback);
      mo.disconnect();
      io.disconnect();
    };
  }, [location.pathname, prefersReducedMotion]);

  // Inline CSS for auto reveal (scoped classes)
  return (
    <style>
      {`
        .auto-reveal {
          opacity: 0;
          transform: translate3d(0, 18px, 0);
          transition: opacity 700ms ease, transform 700ms ease;
          transition-delay: var(--reveal-delay, 0ms);
          will-change: opacity, transform;
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