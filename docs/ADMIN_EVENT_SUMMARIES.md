# Admin-reviewed event summary integration

Last reviewed: 2026-08-04

The public EarthquakeHub frontend consumes the hub backend's canonical event
summary publication contract. It does not decide whether custom text is
approved and does not expose Admin Console review controls.

## Contract

Event REST responses and `SC_EVENT` server-sent events may include:

| Field | Meaning |
| --- | --- |
| `generatedSummary` | Backend-generated canonical fallback |
| `summaryOverride` | Custom summary metadata when the response policy permits it |
| `effectiveSummary` | Text selected by the backend for public rendering |
| `summaryPublication` | Source/review evidence describing the backend decision |
| `eventSummary` | Compatibility alias retained for older consumers |

Approved custom text is selected as `effectiveSummary`. Draft or Needs Review
custom text remains admin-only and public responses fall back to
`generatedSummary`. The temporary backend compatibility switch for legacy
unreviewed text is a rollout mechanism, not frontend authorization.

## Implementation

- `src/utils/eventSummaryContract.js` projects only the canonical summary fields
  from REST/SSE updates. It returns an empty projection for old responses so
  merging an update does not erase existing summary state.
- `src/hooks/useEventsFeed.js` applies the same projection to new and updated
  `SC_EVENT` messages, keeping live events consistent with initial REST data.
- `src/hooks/useEarthquakeDetailViewModel.js` renders sanitized summary markup
  with compatibility fallbacks.
- `src/pages/EarthquakeDetailPage.jsx` synchronizes detail and cache state after
  REST or editor updates.
- `src/components/EditableEventSummary.jsx` renders and optionally edits custom
  text for already-authorized legacy public-app users. The save response is
  still interpreted through `effectiveSummary`; saving custom text does not
  grant approval.
- `src/utils/eventSummaryContract.test.js` and the app smoke test cover the
  projection and public rendering contract.

## Why publication is backend-owned

Review status is persisted and audited in the hub backend. Selecting public
text there ensures REST, SSE, cached detail data, and every client receive the
same decision. A client-side `isApproved` check could be omitted by another
consumer or bypassed through stale state, so the frontend treats
`effectiveSummary` as authoritative.

The local `generateEventSummary` function remains only a compatibility fallback
for older backend responses. New code should not use it to override an explicit
canonical contract.

## Compatibility order

Current rendering uses this bounded fallback order:

1. `effectiveSummary`;
2. `eventSummary` compatibility alias;
3. permitted `summaryOverride.text` from an older response;
4. `generatedSummary`;
5. local generated fallback for a legacy payload.

When a response contains `effectiveSummary` or `summaryPublication`, it is a
canonical response and downstream merging should preserve all projected
contract fields together.

## Changing the contract

A change to review or publication semantics requires a coordinated rollout:

1. update the hub-backend normalization and tests;
2. preserve compatibility fields during the transition;
3. update initial REST and SSE projections together;
4. update Admin Console review evidence and public frontend rendering;
5. deploy backend compatibility first, then both frontends;
6. run the legacy-summary dry run and backup procedure;
7. disable the temporary compatibility switch only after review.

See `docs/API_MAP.md` for the wider event data flow and the deployment
repository's release checklist for migration/rollback steps.

