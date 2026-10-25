# APEX V3.3 LIVE TIMING

## Production mode and permission boundary

`/live` replaces the old simulated/historical animated replay. It provides Canonical F1 schedules, Beijing-time countdowns, recorded results, and the official F1 timing link. A schedule reaching zero means WAITING, never a confirmed start. A scheduled duration ending does not establish a finish. Missing practice/SQ results, flags, timing and weather remain unavailable. Recorded Jolpica results are labelled confirmed/recorded, not FIA final classifications.

`lib/f1/live/policy.ts` denies public redistribution. No query, cookie, header, environment boolean or cached snapshot can turn it on. Public snapshot/status routes strip private timing even on cache reads. The browser never connects to F1, mirrors, OpenF1 live, radio, car telemetry or position feeds. No paid account or subscription is used.

## Source verification

On 2026-10-25 UTC, a bounded unauthenticated SignalR Core probe negotiated HTTP 200 and completed Subscribe. It requested only TimingData, TimingStats, TimingAppData, DriverList, SessionInfo, SessionData, TrackStatus, RaceControlMessages, LapCount and WeatherData. Nine returned initial snapshots; LapCount was not observed. TimingData/TimingStats/TimingAppData contained 22 driver entries, without a Withheld=true marker. Observations of 45 seconds and 12 seconds contained zero incremental updates and no feed timestamps. This establishes initial-snapshot access only, not active-session freshness, continuous availability or redistribution rights. The diagnostic stores field names/counts, never complete timing values or negotiation tokens.

Relevant observed fields: TimingData Position/LastLapTime/BestLapTime/Sectors/NumberOfLaps; TimingStats BestLapTime/BestSectors; TimingAppData Stints; DriverList identity/team metadata; SessionInfo SessionStatus/StartDate/EndDate; SessionData Series/StatusSeries; TrackStatus Status/Message; RaceControlMessages Messages; WeatherData AirTemp/TrackTemp/Rainfall. Actual fields may be missing. LapCount remains unverified. Missing values are never reconstructed from estimates. Old DRS telemetry is not used for 2026.

References reviewed (software licenses are not timing-data grants):

- https://github.com/julesr0y/f1-livetiming-api
- https://github.com/harsh779/f1-live-api
- https://github.com/theOehrly/Fast-F1/blob/main/fastf1/livetiming/client.py
- https://github.com/mricero/F1-Telemetry-Dashboard
- https://www.formula1.com/en/information/guidelines.4EOKE9RRqevL4niTK9kWyt
- https://openf1.org/ — free historical access; live access requires a paid subscription.

No reviewed source currently supplies a verified free redistribution grant covering this site's complete live timing tower. There is no third-party iframe or mirror fallback.

## Architecture and limits

The public mode uses cross-instance Redis snapshots and an atomic NX refresh lease. Concurrent visitors share the same Canonical fetch. Responses retain original source timestamps, and the five-minute last-known snapshot is explicitly stale. It cannot fall back to process memory for production coordination. Browser schedule polling is 60 seconds, stops while hidden and synchronizes on foreground; failures retain the last real data and use bounded exponential backoff with jitter.

The private, disabled collector implements SignalR JSON/RS framing, restricted topics, incremental merge, per-topic/driver ordering, deduplication, source-time validation, batched publication, protocol ping, heartbeat timeout, reconnection, and last-known snapshot restoration. RedisLiveStore implements owner-checked lease renewal/release and atomic monotonic snapshot writes under a separate private prefix. The public website cannot start it. A persistent collector host/coordinator and reviewed grant must be wired and validated before activating full live timing; a normal Vercel request is not used to keep an upstream socket alive.

Cloudflare Durable Objects is a possible persistent host: published Free limits are 100,000 requests/day and 13,000 GB-s/day. Upstash lists 500,000 commands/month. With 100 viewers for two hours, 60-second polling alone is about 12,000 browser requests; this is an estimate, excludes other site traffic and is not an account-quota guarantee. Existing account allowances must be checked before enabling collection. No Durable Object namespace, paid service or new subscription is provisioned by this release. References: https://developers.cloudflare.com/durable-objects/platform/pricing/ and https://upstash.com/pricing/redis .

## Deployment and rollback

Verified website proxy: Cloudflare custom domain `f1.tike69.cc.cd` maps to the existing Worker `feishu-f1-bot` (historical name). Its inspected deployed code is a pure Vercel proxy without scheduled handlers or Feishu sending. The separate `f1-reminder-worker` is not part of this release. The gateway preserves a socket-bearing 101 response instead of reconstructing an HTTP response. No public upstream timing connection is enabled by this change.

Vercel project: `f1-race-reminder-cloud`, scope `tike1`. Pre-release stable website deployment: `dpl_BPgprBXRKJKjdyvjvzREpcC9qZKA`, URL `f1-race-reminder-cloud-iojbw099b-tike1.vercel.app`, commit `1e0a107c567b9d9e3995cc0c7ceefac108d555f1`. Gateway rollback version: `45c62b10-2913-4f5b-bc64-f44819b35d5a`. Verify targets before any rollback.

## Acceptance boundary

Synthetic protocol events are confined to node tests and localhost browser fixtures. They exercise FP1/2/3, Q1/2/3, SQ1/2/3, Sprint and Race, delay/red flag/resume/finish, stale data and reconnects. These tests do not constitute real-race live acceptance. The default public mode is the released product until rights, persistent hosting, actual channel freshness and an in-progress-session test are all verified.
