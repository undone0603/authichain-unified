# Minimal patch for src/lib/generate-api.ts

SHA of current file on branch: 8a225ddf2ad3c83225f8958fda52c6c99bf0c229

## Changes

1. Add to imports:
```ts
import { applyMode, QRON_MODES, type ModeId } from "./qron-modes";
```

2. Extend GeneratePostInput:
```ts
export type GeneratePostInput = {
  // existing fields
  modeId?: string;
};
```

3. After `const prompt = resolvePrompt(opts.body);` in handleGeneratePost:
```ts
let finalPrompt = prompt;
if (opts.body.modeId && QRON_MODES[opts.body.modeId as ModeId]) {
  finalPrompt = applyMode(prompt, opts.body.modeId as ModeId);
}
// use finalPrompt instead of prompt in generateImage call
```

4. In the 200 response qron object, add `modeId: opts.body.modeId`.

5. Observability: include modeId in any logAutomation or structured log.

This is idempotent. Cost $0. No new infra.
