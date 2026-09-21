import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existingLeadBlocksLiveSend,
  isAlreadyContacted,
  nextLeadWriteStatus,
  shouldNotLiveResend,
} from "./b2b-send-policy.ts";

test("contacted leads are not live-sent again", () => {
  assert.equal(isAlreadyContacted("contacted"), true);
  assert.equal(isAlreadyContacted("queued"), false);
  assert.equal(isAlreadyContacted("draft"), false);
  assert.equal(isAlreadyContacted(null), false);
});

test("already-sent QRON inboxes and unpublished leftover drafts are blocked", () => {
  assert.equal(shouldNotLiveResend("franchiseinfo@fastsigns.com"), true);
  assert.equal(shouldNotLiveResend("inquiries@moo.com"), true);
  assert.equal(shouldNotLiveResend("product@moo.com"), true);
  assert.equal(shouldNotLiveResend("innovation@fastsigns.com"), true);
  assert.equal(shouldNotLiveResend("b2b@4imprint.com"), false);
  assert.equal(shouldNotLiveResend("franchise@signarama.com"), false);
});

test("already-sent partner desks are blocked even with mixed case", () => {
  assert.equal(shouldNotLiveResend("contact@existosolutions.com"), true);
  assert.equal(shouldNotLiveResend("Contact@ExistoSolutions.com"), true);
  assert.equal(shouldNotLiveResend("info@icsconsultingservice.com"), true);
  assert.equal(shouldNotLiveResend("Info@ICSConsultingService.com"), true);
  assert.equal(shouldNotLiveResend("fitzpatricks@nemcworks.org"), false);
  assert.equal(shouldNotLiveResend("mooret@nemcworks.org"), false);
  assert.equal(shouldNotLiveResend("mcmanuss@nemcworks.org"), false);
});

test("a contacted lead row blocks live send regardless of email case", () => {
  assert.equal(
    existingLeadBlocksLiveSend(
      [{ email: "Info@ICSConsultingService.com", status: "contacted" }],
      "info@icsconsultingservice.com"
    ),
    true
  );
  assert.equal(
    existingLeadBlocksLiveSend(
      [{ email: "fitzpatricks@nemcworks.org", status: "draft" }],
      "fitzpatricks@nemcworks.org"
    ),
    false
  );
  assert.equal(
    existingLeadBlocksLiveSend(
      [{ email: "other@example.com", status: "contacted" }],
      "fitzpatricks@nemcworks.org"
    ),
    false
  );
});

test("upsert must not clobber contacted back to draft", () => {
  assert.equal(nextLeadWriteStatus("contacted", "draft"), "contacted");
  assert.equal(nextLeadWriteStatus("queued", "draft"), "draft");
  assert.equal(nextLeadWriteStatus(null, "draft"), "draft");
});
