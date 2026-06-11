/**
 * Vertical Factory Service
 * (c) 2026 AuthiChain Inc.
 * 
 * Programmatically generates and deploys new branded industry verticals.
 */
import { exec } from "node:child_process";
import { promisify } from "node:util";
import fs from "node:fs/promises";
import path from "node:path";

const execAsync = promisify(exec);

export interface ForgeOptions {
  id: string;
  displayName: string;
  tagline: string;
  domain: string;
  industry: string;
  primaryColor: string;
  primaryDim: string;
  bgColor?: string;
  bg2Color?: string;
  borderColor?: string;
}

export async function forgeVertical(options: ForgeOptions) {
  const root = "/home/zac/authichain-unified";
  const templateDir = path.join(root, "templates/vertical-worker");
  const targetDir = path.join(root, "workers", options.id);

  console.log(`[Vertical-Factory] Forging ${options.displayName} (${options.id})...`);

  // 1. Create target directory
  await fs.mkdir(targetDir, { recursive: true });
  await fs.mkdir(path.join(targetDir, "src"), { recursive: true });

  // 2. Copy and transform index.ts
  let indexTs = await fs.readFile(path.join(templateDir, "src/index.ts"), "utf-8");
  indexTs = indexTs
    .replace(/{{ID}}/g, options.id)
    .replace(/{{DISPLAY_NAME}}/g, options.displayName)
    .replace(/{{TAGLINE}}/g, options.tagline)
    .replace(/{{DOMAIN}}/g, options.domain)
    .replace(/{{PRIMARY_COLOR}}/g, options.primaryColor)
    .replace(/{{PRIMARY_DIM}}/g, options.primaryDim)
    .replace(/{{BG_COLOR}}/g, options.bgColor || "#08080a")
    .replace(/{{BG2_COLOR}}/g, options.bg2Color || "#0c0c0f")
    .replace(/{{BORDER_COLOR}}/g, options.borderColor || "rgba(255,255,255,0.1)")
    .replace(/{{SEO_TITLE}}/g, `The Truth Layer for ${options.industry}`)
    .replace(/{{INDUSTRY}}/g, options.industry);

  await fs.writeFile(path.join(targetDir, "src/index.ts"), indexTs);

  // 3. Copy and transform wrangler.toml
  let wranglerToml = await fs.readFile(path.join(templateDir, "wrangler.toml"), "utf-8");
  wranglerToml = wranglerToml
    .replace(/{{ID}}/g, options.id)
    .replace(/{{DOMAIN}}/g, options.domain);

  await fs.writeFile(path.join(targetDir, "wrangler.toml"), wranglerToml);

  // 4. Create package.json
  const pkgJson = {
    name: `${options.id}-worker`,
    version: "1.0.0",
    private: true,
    scripts: {
      deploy: "npx wrangler deploy"
    }
  };
  await fs.writeFile(path.join(targetDir, "package.json"), JSON.stringify(pkgJson, null, 2));

  // 5. Deploy (Optional: can be triggered manually)
  console.log(`[Vertical-Factory] Successfully forged ${options.id}. Ready for deployment.`);
  
  return {
    success: true,
    workerPath: targetDir,
    previewCommand: `cd ${targetDir} && npx wrangler dev`,
    deployCommand: `cd ${targetDir} && npx wrangler deploy`
  };
}
