import { test, expect } from "vitest";
import { assessInstantlyReply } from "./instantly-reply-evidence";

const genuine = { event: "email_replied", reply_id: "reply_123", reply_text: "Thanks, please send a brief overview." };

test("genuine-looking reply is review-only, never auto-qualified", () => {
  expect(assessInstantlyReply(genuine)).toEqual({
    status: "review", reason: "candidate_requires_human_verification", sourceId: "reply_123",
  });
});

test("autoresponders, delivery failures and explicit bounces cannot qualify", () => {
  for (const payload of [
    { ...genuine, subject: "Automatic reply: out of office" },
    { ...genuine, reply_text: "Mail delivery subsystem: undeliverable" },
    { ...genuine, is_auto_reply: true },
    { ...genuine, is_bounce: true },
  ]) expect(assessInstantlyReply(payload).status).toBe("reject");
});

test("missing provenance or content fails closed", () => {
  expect(assessInstantlyReply({ event: "email_replied", reply_text: "Interested" }).reason).toBe("missing_source_id");
  expect(assessInstantlyReply({ event: "email_replied", reply_id: "r" }).reason).toBe("missing_reply_content");
  expect(assessInstantlyReply({ event: "email_opened", reply_id: "r", reply_text: "hello" }).reason).toBe("not_reply");
});
