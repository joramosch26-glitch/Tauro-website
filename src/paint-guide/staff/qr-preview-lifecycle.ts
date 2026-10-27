export function nextQrPreviewGeneration(current: number) {
  return current + 1;
}

export function isCurrentQrPreviewRequest(
  requestedGeneration: number,
  currentGeneration: number,
  requestedUrl: string,
  currentUrl: string | null,
  active: boolean,
) {
  return active && requestedGeneration === currentGeneration && requestedUrl === currentUrl;
}

export function isCurrentAccessOperation(
  requestedGeneration: number,
  currentGeneration: number,
  active: boolean,
) {
  return active && requestedGeneration === currentGeneration;
}
