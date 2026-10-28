import { useEffect, useRef, useState } from "react";
import { fetchHomeownerPhotoBlob, HomeownerPhotoError, type HomeownerPhotoFailure } from "../homeowner/private-photo-client";

type Props = {
  src?: string;
  alt: string;
  className?: string;
  loading?: "eager" | "lazy";
  fetchPriority?: "high" | "low" | "auto";
  allowRetry?: boolean;
  onFailure?: (kind: HomeownerPhotoFailure) => void;
};

/** Uses authenticated no-store fetches for private homeowner photos. Staff preview blob URLs keep native image loading. */
export function HomeownerPrivateImage({ src, alt, className, loading = "eager", fetchPriority = "auto", allowRetry = true, onFailure }: Props) {
  const imageSrc = src ?? "";
  const [attempt, setAttempt] = useState(0);
  const [inView, setInView] = useState(loading === "eager");
  const anchor = useRef<HTMLSpanElement>(null);
  const onFailureRef = useRef(onFailure);
  useEffect(() => { onFailureRef.current = onFailure; }, [onFailure]);
  const [state, setState] = useState<{ src: string; objectUrl: string } | { src: string; failure: HomeownerPhotoFailure } | null>(null);
  const isPrivateHomeownerUrl = imageSrc.startsWith("/api/paint-guide/homeowner/photos/");

  useEffect(() => {
    if (!isPrivateHomeownerUrl) return;
    if (loading === "lazy" && !inView) {
      const element = anchor.current?.parentElement ?? anchor.current;
      if (!element || typeof IntersectionObserver === "undefined") { setInView(true); return; }
      const observer = new IntersectionObserver((entries) => {
        if (entries.some(entry => entry.isIntersecting)) { setInView(true); observer.disconnect(); }
      }, { rootMargin: "300px" });
      observer.observe(element);
      return () => observer.disconnect();
    }
    if (!inView) return;
    const controller = new AbortController();
    let objectUrl: string | null = null;
    setState(null);
    void fetchHomeownerPhotoBlob(imageSrc, controller.signal, fetch, fetchPriority).then((blob) => {
      if (controller.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setState({ src: imageSrc, objectUrl });
    }).catch((error: unknown) => {
      if (controller.signal.aborted) return;
      const failure = error instanceof HomeownerPhotoError ? error.kind : "temporary";
      setState({ src: imageSrc, failure });
      onFailureRef.current?.(failure);
      if (failure === "session_unavailable") window.dispatchEvent(new Event("paintguide:homeowner-session-unavailable"));
    });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attempt, fetchPriority, inView, isPrivateHomeownerUrl, loading, imageSrc]);

  if (!isPrivateHomeownerUrl) return <img src={src} alt={alt} className={className} loading={loading} fetchPriority={fetchPriority} onError={() => onFailureRef.current?.("missing")} />;
  if (state?.src !== imageSrc) return loading === "lazy" ? <span aria-hidden="true" ref={anchor} style={{ display: "none" }} /> : null;
  if ("failure" in state) {
    return state.failure === "temporary" && allowRetry
      ? <button className="pg-photo-retry" type="button" onClick={() => setAttempt(value => value + 1)}>Photo could not load. Retry</button>
      : <span className="pg-photo-unavailable" role="status">Photo unavailable</span>;
  }
  return <img src={state.objectUrl} alt={alt} className={className} loading={loading} fetchPriority={fetchPriority} onError={() => setState({ src: imageSrc, failure: "missing" })} />;
}
