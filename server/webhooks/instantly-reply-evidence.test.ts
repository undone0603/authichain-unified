import { test } from "node:test";
import { strict as assert } from "node:assert";
import { assessInstantlyReply } from "./instantly-reply-evidence.ts";

const genuine = { event: "email_replied", reply_id: "reply_123", reply_text: "Thanks, please send a brief overview." };
test("genuine-looking reply is review-only, never auto-qualified", () => {
  assert.deepEqual(assessInstantlyReply(genuine), {
    status: "review", reason: "candidate_requires_human_verification", sourceId: "reply_123",
  });
});
test("autoresponders, delivery failures and explicit bounces cannot qualify", () => {
  for (const payload of [
    { ...genuine, subject: "Automatic reply: out of office" },
    { ...genuine, reply_text: "Mail delivery subsystem: undeliverable" },
    { ...genuine, is_auto_reply: true },
    { ...genuine, is_bounce: true },
  ]) assert.equal(assessInstantlyReply(payload).status, "reject");
});
test("missing provenance or content fails closed", () => {
  assert.equal(assessInstantlyReply({ event: "email_replied", reply_text: "Interested" }).reason, "missing_source_id");
  assert.equal(assessInstantlyReply({ event: "email_replied", reply_id: "r" }).reason, "missing_reply_content");
  assert.equal(assessInstantlyReply({ event: "email_opened", reply_id: "r", reply_text: "hello" }).reason, "not_reply");
});
