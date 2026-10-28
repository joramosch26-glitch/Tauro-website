export type HomeownerPhotoFailure = "session_unavailable" | "missing" | "temporary";

export class HomeownerPhotoError extends Error {
  constructor(readonly kind: HomeownerPhotoFailure) {
    super("A private Paint Guide photo could not be loaded.");
    this.name = "HomeownerPhotoError";
  }
}

export async function fetchHomeownerPhotoBlob(
  url: string,
  signal: AbortSignal,
  fetcher: typeof fetch = fetch,
  priority: "high" | "low" | "auto" = "auto",
): Promise<Blob> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "GET", credentials: "same-origin", cache: "no-store",
      referrerPolicy: "no-referrer", redirect: "error", signal, priority,
    });
  } catch (error) {
    if (signal.aborted) throw error;
    throw new HomeownerPhotoError("temporary");
  }
  if (response.status === 401) throw new HomeownerPhotoError("session_unavailable");
  if (response.status === 404) throw new HomeownerPhotoError("missing");
  if (!response.ok) throw new HomeownerPhotoError("temporary");
  if (!response.headers.get("content-type")?.toLowerCase().startsWith("image/")) {
    throw new HomeownerPhotoError("temporary");
  }
  try { return await response.blob(); }
  catch (error) {
    if (signal.aborted) throw error;
    throw new HomeownerPhotoError("temporary");
  }
}
