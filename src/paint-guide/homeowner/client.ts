import { parseHomeownerGuideDocument } from "./document.js";
import type { HomeownerGuideDocumentData } from "../presentation/types.js";

export async function exchangeHomeownerToken(token: string) {
  try {
    const response = await fetch("/api/paint-guide/homeowner/exchange", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }), credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" });
    return response.status === 204;
  } catch { return false; }
}
export async function fetchHomeownerDocument(): Promise<HomeownerGuideDocumentData | null> {
  try {
    const response = await fetch("/api/paint-guide/homeowner/document", { method: "GET", credentials: "same-origin", cache: "no-store", referrerPolicy: "no-referrer", redirect: "error" });
    return response.status === 200 ? parseHomeownerGuideDocument(await response.json()) : null;
  } catch { return null; }
}
