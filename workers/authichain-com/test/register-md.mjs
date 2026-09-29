import { readFileSync } from "node:fs";
import { Module, register } from "node:module";

register("./md-hook.mjs", import.meta.url);

// tsx compiles TypeScript to CommonJS require(). An ESM load hook never sees
// those .md specifiers, and tsx then parses the markdown as JavaScript.
const extensions = Module._extensions;
extensions[".md"] = function (mod, filename) {
  const text = readFileSync(filename, "utf8");
  const body = JSON.stringify(text);
  mod._compile(
    `"use strict";\nconst __markdown = ${body};\nmodule.exports = { __esModule: true, default: __markdown };\n`,
    filename,
  );
};
