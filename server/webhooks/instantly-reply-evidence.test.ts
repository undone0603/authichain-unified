import { test, expect } from "vitest";
import { assessInstantlyReply, getInstantlyEventKey, normalizeInstantlyEvent } from "./instantly-reply-evidence";

const vendorReply = {
  timestamp: "2026-11-01T07:00:00Z",
  event_type: "reply_received",
  lead_email: "Prospect@Example.com",
  campaign_id: "campaign-1",
  email_id: "email-1",
  reply_text_snippet: "Thanks, please send a brief overview.",
};

test("Instantly v2 payload normalizes and remains review-only", () => {
  expect(normalizeInstantlyEvent(vendorReply)).toEqual({ eventType: "reply_received", email: "prospect@example.com" });
  expect(assessInstantlyReply(vendorReply)).toEqual({
    status: "review", reason: "candidate_requires_human_verification", sourceId: "email-1",
  });
});

test("legacy payload aliases remain review-only and clicks normalize", () => {
  const legacy = { event: "email_replied", email: "buyer@example.com", reply_id: "reply-1", reply_text: "Interested in the pilot." };
  expect(assessInstantlyReply(legacy).status).toBe("review");
  expect(normalizeInstantlyEvent({ event_type: "email_link_clicked", lead_email: "a@b.com" }).eventType).toBe("link_clicked");
  expect(normalizeInstantlyEvent({ event_type: "link_clicked", lead_email: "a@b.com" }).eventType).toBe("link_clicked");
});

test("autoresponders, bounces, out-of-office and delivery failures cannot qualify", () => {
  for (const payload of [
    { ...vendorReply, event_type: "auto_reply_received" },
    { ...vendorReply, event_type: "email_bounced" },
    { ...vendorReply, event_type: "lead_out_of_office" },
    { ...vendorReply, reply_subject: "Automatic reply: out of office" },
    { ...vendorReply, reply_text_snippet: "Mail delivery subsystem: undeliverable" },
    { ...vendorReply, is_auto_reply: true },
    { ...vendorReply, is_bounce: true },
  ]) expect(assessInstantlyReply(payload).status).toBe("reject");
});

test("missing provenance or content fails closed", () => {
  expect(assessInstantlyReply({ ...vendorReply, email_id: undefined }).reason).toBe("missing_source_id");
  expect(assessInstantlyReply({ ...vendorReply, reply_text_snippet: undefined }).reason).toBe("missing_reply_content");
  expect(assessInstantlyReply({ ...vendorReply, event_type: "email_opened" }).reason).toBe("not_reply");
});

test("dedupe key separates later replies and never uses only email and event type", () => {
  const key = getInstantlyEventKey(vendorReply);
  expect(key).toContain("2026-11-01T07:00:00Z");
  expect(getInstantlyEventKey({ ...vendorReply, timestamp: "2026-11-01T07:01:00Z" })).not.toBe(key);
  expect(getInstantlyEventKey({ ...vendorReply, email_id: "email-2" })).not.toBe(key);
  expect(getInstantlyEventKey({ event_type: "reply_received", lead_email: "a@b.com" })).toBeNull();
  expect(getInstantlyEventKey({ webhook_id: "vendor-1" })).toBe("instantly:vendor-1");
});
