/** Public half of one AgentZ presentation. Private keys were discarded after signing. */
export const AGENTZ_PRESENTATION = {
  issuer_public_key:
    '{"key_ops":["verify"],"ext":true,"kty":"EC","x":"dbW_1DhZq76hNarRzJoELxfzwyo6GHHCGQVGjTabKN8","y":"Qs0D8ZBbFSmWwop9nSHs5dNceClYfhLiVgp8b8-YhUY","crv":"P-256"}',
  attestation: {
    agent_id: "agent:authichain:agentz",
    organization_id: "org:authichain",
    role: "presenter",
    version: "1",
    capabilities: ["PRESENT_ONE_OFFER"],
    public_key:
      '{"key_ops":["verify"],"ext":true,"kty":"EC","x":"f_AaoNxID34Day4rM3AAyyVfNhCHWqoelEe4ntvouM4","y":"RjgT0iqZyAUYe0B0hdd0WGWp-TcP80VZjcst3SNOEfI","crv":"P-256"}',
    policy_version: "2026-10-13",
    issued_at: "2026-10-13T18:00:00.000Z",
    effective_at: "2026-10-13T18:00:00.000Z",
    expires_at: "2027-01-13T18:00:00.000Z",
    issuer_id: "issuer:authichain:root",
    attestation_id: "att:agentz:present-one-offer:2026-10-13",
    signature:
      "XdR7D63FIh9u7nP1s3djmudF5LdOAsMjbzdPx3hU1A8xnOAhWLCdF3+n3VzWAAzozZZW/ZMvPq/a9lBZgQ2g8g==",
  },
  message: {
    protocol: "authichain-agent/1",
    message_id: "msg:agentz:present-one-offer:2026-10-13",
    agent_id: "agent:authichain:agentz",
    organization_id: "org:authichain",
    attestation_id: "att:agentz:present-one-offer:2026-10-13",
    role: "presenter",
    version: "1",
    capabilities: ["PRESENT_ONE_OFFER"],
    policy_version: "2026-10-13",
    issued_at: "2026-10-13T18:05:00.000Z",
    expires_at: "2027-01-13T18:00:00.000Z",
    intent: "present_one_draft",
    evidence_ids: [],
    payload: {
      agent_name: "AgentZ",
      works_for: "AuthiChain",
      addressed_to: "Ride Aventon Germany GmbH",
      focus:
        "One draft page for one e-bike battery model placed on the EU market.",
      text: "I am AgentZ. I work for AuthiChain. I am not a person. I am allowed to present one draft for one battery model. I am not allowed to send this offer, to register a product, or to call the draft a battery passport or an EU registry filing.",
      acceptance:
        "The reader has not accepted this. A check on this page is not a yes.",
    },
    signature:
      "XupCTNi4OF/2D33achWTVHMbhLgBNExBu+JM9CSdVNNoxYweEMIn1t3/LisJtH0F17/hASdgPVbbO1si861Dhw==",
  },
} as const;
