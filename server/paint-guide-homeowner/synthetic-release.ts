import type { PaintGuideServerEnvironment } from "./types.js";

export function syntheticReleaseGuideIds(environment: PaintGuideServerEnvironment): readonly string[] {
  const release = environment.syntheticRelease;
  return release ? [release.guideId, ...(release.additionalGuideIds ?? [])] : [];
}

export function syntheticReleaseAllowsGuide(environment: PaintGuideServerEnvironment, guideId: string): boolean {
  return !environment.syntheticRelease || syntheticReleaseGuideIds(environment).includes(guideId);
}

