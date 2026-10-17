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
  create(value: string, options: Parameters<typeof QRCode.create>[1]): ReturnType<typeof QRCode.create>;
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

export async function createQrPng(privateUrl: string, renderer: QrRenderer = QRCode, createCanvas: () => HTMLCanvasElement = () => document.createElement("canvas")) {
  const qr = renderer.create(privateUrl, { errorCorrectionLevel: options.errorCorrectionLevel });
  // Integer module sizes avoid interpolation and qrcode's fractional-width
  // rounding. Center the complete symbol, including its four-module quiet zone.
  const scale = Math.floor(DOWNLOAD_SIZE / (qr.modules.size + options.margin * 2));
  if (scale < 1) throw new Error("QR PNG output was invalid.");
  const padding = Math.floor((DOWNLOAD_SIZE - (qr.modules.size + options.margin * 2) * scale) / 2);
  const offset = padding + options.margin * scale;
  const canvas = createCanvas();
  canvas.width = DOWNLOAD_SIZE;
  canvas.height = DOWNLOAD_SIZE;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("QR PNG output was unavailable.");
  context.fillStyle = options.color.light;
  context.fillRect(0, 0, DOWNLOAD_SIZE, DOWNLOAD_SIZE);
  context.fillStyle = options.color.dark;
  for (let row = 0; row < qr.modules.size; row += 1) {
    for (let column = 0; column < qr.modules.size; column += 1) {
      if (qr.modules.get(row, column)) context.fillRect(offset + column * scale, offset + row * scale, scale, scale);
    }
  }
  return new Blob([pngBytes(canvas.toDataURL("image/png"))], { type: "image/png" });
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
