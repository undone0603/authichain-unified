// Stand-in for playwright-core in the Cloudflare Workers build only.
//
// Workers cannot spawn a Chromium process, and bundling the real package
// fails outright (it requires chromium-bidi, which is not installed).
// next.config.js aliases playwright-core here when WORKERS_CI=1, so the
// routes that import server/agents/browser-vision.ts still build, and any
// attempt to drive a browser fails loudly instead of at bundle time. The
// Node service (server/_core/app.ts) keeps the real package.
const unavailable = () => {
  throw new Error(
    "playwright-core is not available on Cloudflare Workers; run browser jobs on the Node service"
  );
};
const browserType = {
  launch: unavailable,
  connect: unavailable,
  connectOverCDP: unavailable,
};
module.exports = {
  chromium: browserType,
  firefox: browserType,
  webkit: browserType,
};
