// PATCH NOTE: Add the following to the existing file.

// At top with other imports:
import { softUpgradePrompt } from "./qron-upgrade-prompt";

// Inside the 200 return body, after remaining_credits:
...(function() {
  const remaining = deducted.ok ? deducted.remaining : credit.remaining;
  const upgrade = softUpgradePrompt(remaining, modeId);
  return upgrade ? { upgrade } : {};
})(),
