# Exact applyMode Wire-up (next commit)

In src/lib/generate-api.ts (current SHA 8a225ddf2ad3c83225f8958fda52c6c99bf0c229):

1. Add import:
```ts
import { applyMode, QRON_MODES, type ModeId } from "./qron-modes";
```

2. Extend type:
```ts
modeId?: string;
```

3. After resolvePrompt:
```ts
let finalPrompt = prompt;
if (opts.body.modeId && QRON_MODES[opts.body.modeId as ModeId]) {
  finalPrompt = applyMode(prompt, opts.body.modeId as ModeId);
}
```
Use finalPrompt in generateImage.

4. Add modeId to 200 qron object.

Observability: log modeId. Cost $0. Idempotent.
