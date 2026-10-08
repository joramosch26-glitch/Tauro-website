import QRCode from "qrcode";

export const QR_PNG_FILENAME = "tauro-paint-guide-access.png";
export const QR_SVG_FILENAME = "tauro-paint-guide-access.svg";
const PREVIEW_SIZE = 512;
const DOWNLOAD_SIZE = 1024;
const options = {
  errorCorrectionLevel: "M" as const,
  margin: 4,
  color: { dark: "#000000", light: "#ffffff" },
};

type QrRenderer = {
  toDataURL(value: string, options: Parameters<typeof QRCode.toDataURL>[1]): Promise<string>;
  toString(value: string, options: Parameters<typeof QRCode.toString>[1]): Promise<string>;
};

function pngBytes(dataUrl: string) {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) throw new Error("QR PNG output was invalid.");
  const binary = atob(dataUrl.slice(prefix.length));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function safeSvg(svg: string, encodedValue: string) {
  if (!svg.startsWith("<svg") || svg.includes(encodedValue)
    || /<\/?(?:script|metadata|title|desc)\b|\son[a-z]+\s*=|(?:href|src)\s*=/i.test(svg)) {
    throw new Error("QR SVG output was invalid.");
  }
  return svg;
}

export async function createQrPreview(privateUrl: string, renderer: QrRenderer = QRCode) {
  return renderer.toDataURL(privateUrl, { ...options, width: PREVIEW_SIZE, type: "image/png" });
}

export async function createQrPng(privateUrl: string, renderer: QrRenderer = QRCode) {
  const dataUrl = await renderer.toDataURL(privateUrl, { ...options, width: DOWNLOAD_SIZE, type: "image/png" });
  return new Blob([pngBytes(dataUrl)], { type: "image/png" });
}

export async function createQrSvg(privateUrl: string, renderer: QrRenderer = QRCode) {
  const svg = safeSvg(await renderer.toString(privateUrl, { ...options, type: "svg", width: DOWNLOAD_SIZE }), privateUrl);
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
}

export function qrDownloadStillCurrent(requestedUrl: string, currentUrl: string | null, requestedGeneration: number, currentGeneration: number) {
  return qrValueStillCurrent(requestedUrl, currentUrl) && requestedGeneration === currentGeneration;
}

export function qrValueStillCurrent(requestedUrl: string, currentUrl: string | null) {
  return requestedUrl === currentUrl;
}

export function downloadQr(blob: Blob, filename: string, documentRef: Pick<Document, "createElement" | "body"> = document, urlRef: Pick<typeof URL, "createObjectURL" | "revokeObjectURL"> = URL) {
  const objectUrl = urlRef.createObjectURL(blob);
  try {
    const anchor = documentRef.createElement("a");
    anchor.href = objectUrl;
    anchor.download = filename;
    anchor.click();
  } finally {
    setTimeout(() => urlRef.revokeObjectURL(objectUrl), 0);
  }
}
