# PaintGuide private-photo browser comparison

## Setup

- Compared the published baseline at `fb7f0cb038a75eda55d8c58b3754a16ef0780b1e` against the modified `pgv1` worktree with the same Playwright Chromium binary, synthetic React fixture, viewport (`390 × 844`, mobile/touch), route order, and scroll itinerary.
- The fixture models **one fictional Paint Guide containing nine synthetic paint records** and nine room thumbnails, plus one cover photo. It does not represent nine guides or use customer images.
- Each image response is private and `no-store`. The synthetic network waits 160 ms per response plus transfer time at 256,000 bytes/second. The cover is 300,000 bytes; nine room thumbnails total 515,000 bytes.
- Took three cold samples per version (new browser process each run) and three warm samples per version (reused browser process, new context). Warm runs do not imply a cached photo: protected responses remain `no-store`.
- The page is served from Vite in the isolated workspace. End-to-end times include page startup, browser scheduling, image transfer, and decode; they are not field timings.

## Results

| Metric | Baseline cold median (range) | Modified cold median (range) | Baseline warm median (range) | Modified warm median (range) |
|---|---:|---:|---:|---:|
| Cover image decoded after navigation | 6,874 ms (5,002–8,069) | 6,660 ms (4,696–8,699) | 7,342 ms (7,198–9,533) | 6,294 ms (5,722–6,428) |
| Initially visible photos ready | 6,881 ms (5,009–8,075) | 6,672 ms (4,702–8,703) | 7,351 ms (7,207–9,540) | 6,299 ms (5,728–6,433) |
| Requests by initial visible readiness | 10 | 5 | 10 | 5 |
| Bytes by initial visible readiness | 815,000 | 530,000 | 815,000 | 530,000 |
| All photos ready after the same full scroll | 7,469 ms (5,592–8,668) | 7,269 ms (5,301–9,312) | 7,945 ms (7,793–10,144) | 6,890 ms (6,352–7,045) |
| Requests and bytes after visiting every room | 10 / 815,000 | 10 / 815,000 | 10 / 815,000 | 10 / 815,000 |

At the initial viewport, the browser found two room cards visible. The modified version also scheduled the next nearby cards within its 300 px lazy-load margin, so the initial request count includes those prefetched photos. The initial request count fell by 50%, and initial scheduled bytes fell by 285,000 bytes (35%). After scrolling through every room, both versions requested the same ten photos and transferred the same 815,000 bytes.

Cold timing ranges overlap widely, and the cold median cover difference is only 214 ms. The warm full-scroll median was 1,055 ms lower for the modified version, but this small sample includes browser/page startup and host scheduling variation, and there is no image cache for these `no-store` responses. Treat the observed timing difference as inconclusive: the measured result supports fewer initial requests and bytes, not a reliable claim that real users will see images load faster.

## Security and behavior review

- Private photo requests still use the same-origin session cookie, `no-store`, and no referrer; no public cache or longer session lifetime was introduced.
- The fallback session check is coalesced only while in flight, keyed by deployment environment, project, key version, and session HMAC. It shares no authorization decision across different sessions and removes the entry after resolution. A valid session with an absent or foreign photo ID receives the same generic unavailable body and no cookie mutation.
- Photo 401 responses no longer clear the shared session cookie. Otherwise a delayed response for an old photo request could delete a newer session cookie that replaced it while that request was in flight. The response remains generic; the UI asks the homeowner to request a current link.
- Synthetic browser checks verify the lazy room image loads after scrolling, a 401 differs from a missing photo only in the UI recovery state (both use the same generic image fallback), temporary failures can be retried, and navigation aborts the stale request.

## Limits

This is a repeatable synthetic Chromium comparison, not a real Supabase Storage measurement, production trace, or iPhone test. The Vite development fixture and this machine's startup/scheduling contribute to absolute timing. A real device/network comparison is still needed to confirm the reported 4–5 second experience.
