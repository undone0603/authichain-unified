import { launch } from "@cloudflare/playwright";

export async function scrapeBatteryPassport(env: any, targetUrl: string) {
  const browser = await launch(env.MYBROWSER);
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(targetUrl, { waitUntil: "domcontentloaded" });

  // Extract attributes based on the CIRPASS / Battery Pass Data Model
  const passportData = await page.evaluate(() => {
    const document = (
      globalThis as {
        document?: {
          querySelector(selector: string): { textContent: string | null } | null;
        };
      }
    ).document;
    // Helper to safely extract text content based on generic or semantic selectors
    const getText = (selector: string) =>
      document?.querySelector(selector)?.textContent?.trim() || null;

    return {
      // 1. General Product Identity
      batteryId: getText('[data-schema="battery-id"], .battery-id'),
      manufacturer: getText('[data-schema="manufacturer"], .manufacturer-name'),

      // 2. Materials & Composition
      criticalRawMaterials: getText('[data-schema="crm-list"], .raw-materials'),
      recycledContent: getText(
        '[data-schema="recycled-content"], .recycled-percentage'
      ),

      // 3. Sustainability Metrics (Audited)
      carbonFootprint: getText(
        '[data-schema="carbon-footprint"], .carbon-metrics'
      ),

      // 4. End-of-Life Data
      stateOfHealth: getText('[data-schema="state-of-health"], .soh-value'),
    };
  });

  await browser.close();
  return passportData;
}
