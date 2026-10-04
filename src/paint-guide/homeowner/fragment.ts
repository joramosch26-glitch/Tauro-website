export const HOMEOWNER_PATHNAME = "/paint-guide/p";

type LocationLike = Pick<Location, "pathname" | "search" | "hash">;
type HistoryLike = Pick<History, "state" | "replaceState">;

export type HomeownerFragmentCapture = {
  captured: boolean;
  token: string | null;
};

export function isHomeownerPath(pathname: string) {
  return pathname === HOMEOWNER_PATHNAME;
}

export function captureHomeownerFragment(
  location: LocationLike,
  history: HistoryLike,
): HomeownerFragmentCapture {
  if (!isHomeownerPath(location.pathname) || !location.hash) {
    return { captured: false, token: null };
  }

  const token = location.hash.startsWith("#")
    ? location.hash.slice(1) || null
    : null;
  history.replaceState(history.state, "", `${location.pathname}${location.search}`);
  return { captured: true, token };
}
