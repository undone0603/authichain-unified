import { describe, expect, it } from "vitest";
import {
  FIRST_SCAN_GIFT_URL,
  FIRST_SCAN_REWARD_QRON,
  firstScanAcquisitionReward,
} from "./reward-calculator";

describe("first-scan $QRON entitlement", () => {
  it("pays 1 QRON once, with the gift, and does not settle on-chain", () => {
    const reward = firstScanAcquisitionReward({
      isFirstScan: true,
      alreadyRewarded: false,
    });
    expect(reward.qron).toBe(FIRST_SCAN_REWARD_QRON);
    expect(reward.qron).toBe(1);
    expect(reward.unit).toBe("QRON");
    expect(reward.settlesOnChain).toBe(false);
    expect(reward.giftUrl).toBe(FIRST_SCAN_GIFT_URL);
    expect(reward.reason).toBe("first_scan");
  });

  it("pays nothing on a repeat scan or a second claim", () => {
    expect(
      firstScanAcquisitionReward({
        isFirstScan: false,
        alreadyRewarded: false,
      }).qron
    ).toBe(0);
    expect(
      firstScanAcquisitionReward({
        isFirstScan: true,
        alreadyRewarded: true,
      }).reason
    ).toBe("already_rewarded");
  });
});
