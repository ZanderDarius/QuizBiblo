# Issue 5: Azure speech playback decision

Status: proposed implementation baseline. A live Azure timing experiment and product-owner approval are still required before this decision can be treated as final pilot evidence.

## Decision

Use server-generated Azure REST audio for approved question and fixed-prompt IDs. Cache the resulting browser-compatible audio by an immutable content key, and keep the authoritative spoken-text boundary in the question revision and audio metadata. The browser may stop playback immediately, while the room state remains authoritative for shared cancellation.

The first implementation should use phrase-level segments rather than one uninterruptible file. Each segment carries `roomId`, `questionId`, `revision`, `attemptId`, `turnId`, `segmentIndex`, and the exact text used for synthesis. A client must ignore any callback whose IDs do not match its active turn.

## Why this baseline

- The Azure resource key remains server-side; the browser receives audio bytes or a short-lived cached result, never a key or token.
- Phrase segments make local stop immediate and give the app a conservative interruption boundary without pretending that a buzz can recover a word boundary after the fact.
- Both clients can prepare the same approved revision before a scheduled start.
- A single audio coordinator can cancel fetches, playback, timers, and stale callbacks together.
- Cache keys can be deterministic and invalidated whenever the approved question revision, voice, rate, SSML, or pronunciation hints change.

## Rejected alternatives

### Short-lived browser Speech SDK authorization

Rejected for the first baseline because it adds browser token handling, makes cross-computer timing and cancellation more dependent on browser behavior, and exposes more provider behavior to the client. It can be revisited after the pilot has measured the need for provider word-boundary events.

### One server-generated file per question

Rejected because a single long file has a less useful interruption boundary and makes stale playback harder to cancel safely. Segments keep the same server authority while reducing stop and retry granularity.

## Audio contract

- Format: `audio/mpeg` unless the compatibility experiment proves another format is better.
- Voice: one approved English neural voice, configured as a server-side setting.
- Rate: one fixed pilot rate, stored with the synthesized metadata.
- SSML: generated only from approved fields; XML characters are escaped and pronunciation hints are allow-listed.
- Cache key: `sha256(questionRevision + segmentText + voice + rate + format + ssmlVersion)`.
- Expiry: cache entries may be reused while the referenced question revision is active; changing any input creates a new key.
- Invalidation: never reuse audio across question revisions or prompt versions.

## Targets to approve in the two-PC experiment

| Measure | Pilot target | Measurement rule |
| --- | ---: | --- |
| Audio readiness | 95% of prepared segments ready before start | Record prepare request and ready acknowledgement times. |
| Cross-client start skew | <= 250 ms | Compare first playback timestamps from both clients. |
| Local stop latency | <= 100 ms | Buzz event to local audio stop. |
| Remote stop latency | <= 500 ms | Authoritative buzz to other-client audio stop. |
| Boundary tolerance | <= 1 spoken phrase | Grading may not assume text beyond the last confirmed segment. |

These are proposed engineering targets, not measured results.

## Failure behavior

- `401` or `403`: mark speech unavailable, redact the provider response, and offer the visible-caption/manual practice fallback.
- `429`: do not retry in a tight loop; use cached audio or show a retry action with backoff.
- Timeout or network loss: cancel the segment, keep the room in a safe non-advancing state, and let the host retry.
- Malformed audio: discard it, record a redacted failure counter, and do not activate it.
- Autoplay blocked: require the room-level Enable audio gesture before the next turn.

## Secret flow

```text
Hosted secret AZURE_SPEECH_KEY + AZURE_SPEECH_REGION
    -> server-side speech endpoint
    -> Azure REST request
    -> validated audio bytes / cache entry
    -> browser playback
```

The key, authorization headers, raw provider payloads, and raw microphone audio must not enter browser assets, D1, GitHub, issue comments, or normal logs.

## Remaining evidence

This document supplies the design decision and safety contract. Issue 5 still needs a minimal non-production timing experiment and product-owner approval before it can be closed.
