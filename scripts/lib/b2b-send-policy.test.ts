import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isAlreadyContacted,
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
