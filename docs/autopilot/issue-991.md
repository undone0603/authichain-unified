# QFS-ready profile shipped — ISO 20022 carriage, not a QFS node

Issue: #991
Source: AuthiChain Board autopilot
Written: 2026-09-23T13:55:07.059Z

## Increment: QFS-ready profile (ISO 20022 carriage) — Issue 991

### Outcome
Ship a **QFS-ready profile** that can carry ISO 20022 message payloads end-to-end, with docs and UI copy that state clearly: the profile is a **carriage layer**, not a QFS node.

### Files to touch
- `packages/profile/src/iso20022/types.ts` — message envelope + profile flags
- `packages/profile/src/iso20022/carriage.ts` — encode/decode carriage helpers
- `apps/web/components/profile/QfsReadyBadge.tsx` — UI label + tooltip
- `apps/web/app/profile/[id]/page.tsx` — surface badge and non-node disclaimer
- `docs/profiles/qfs-ready-iso20022.md` — distinction + usage
- `packages/profile/README.md` — short pointer to the doc

### Acceptance checks
- [ ] Profile type exposes `iso20022Carriage: true` and `isQfsNode: false` (or equivalent) and both are enforced in types.
- [ ] Carriage helpers accept/return ISO 20022 XML/JSON payloads without implying node participation.
- [ ] UI shows “QFS-ready (ISO 20022 carriage)” and explicit “Not a QFS node” copy on the profile view.
- [ ] Doc states carriage vs node in the first screenful; no “QFS node” claims.
- [ ] Unit tests cover round-trip carriage and flag defaults; no network/deploy steps required.

### Minimal patch sketch
```ts
// packages/profile/src/iso20022/types.ts
export type Iso20022CarriageProfile = {
  id: string;
  /** Carries ISO 20022 messages; does not participate as a QFS node. */
  capabilities: {
    iso20022Carriage: true;
    isQfsNode: false;
  };
  /** Opaque ISO 20022 document (XML or JSON string). */
  payload?: string;
  contentType?: "application/xml" | "application/json";
};

// packages/profile/src/iso20022/carriage.ts
export function wrapIso20022(
  profileId: string,
  payload: string,
  contentType: "application/xml" | "application/json"
): Iso20022CarriageProfile {
  return {
    id: profileId,
    capabilities: { iso20022Carriage: true, isQfsNode: false },
    payload,
    contentType,
  };
}

// apps/web/components/profile/QfsReadyBadge.tsx
// Render: "QFS-ready · ISO 20022 carriage" + tooltip "Not a QFS node"

// docs/profiles/qfs-ready-iso20022.md
// Lead: "This profile carries ISO 20022 messages. It is not a QFS node."
```
