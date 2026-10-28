# Paint Guide photo loading fixture

Run `node scripts/paint-guide-photo-load-fixture.mjs` to reproduce the sanitized scheduling comparison.

The fixture uses 36 synthetic photos, a 300 KB cover, 515 KB of context thumbnails, and nine formula labels. It assumes three room-context thumbnails intersect the initial viewport. The previous eager policy schedules the cover and every context thumbnail immediately; the candidate prioritizes the cover and defers context thumbnails until they are near the viewport. Formula labels remain on demand.

The script reports only estimated initial request count and scheduled bytes. It does not measure elapsed time, Storage latency, network throughput, image decode, or iPhone performance. Replace the three-visible-image assumption with a browser trace from a synthetic guide before treating byte savings as representative. No live image bytes or identifiers are captured.
