/**
 * tsx does not treat *.md as text. Wrangler does, via the Text rule in
 * wrangler.toml. This hook is only for node:test.
 */
export async function load(url, context, nextLoad) {
  if (url.endsWith(".md")) {
    const { readFile } = await import("node:fs/promises");
    const { fileURLToPath } = await import("node:url");
    const text = await readFile(fileURLToPath(url), "utf8");
    return {
      format: "module",
      source: `export default ${JSON.stringify(text)};\n`,
      shortCircuit: true,
    };
  }
  return nextLoad(url, context);
}
