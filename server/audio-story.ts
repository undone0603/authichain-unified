/** Spoken asset story. A missing date is omitted. This is not a passport scan. */
export function audioStoryScript(data: {
  brandName: string;
  strainName: string;
  thcContent?: string | null;
  harvestDate?: string | null;
}): string {
  const lines = [`Recorded story for ${data.strainName} by ${data.brandName}.`];
  if (typeof data.harvestDate === "string" && data.harvestDate.trim()) {
    lines.push(`Manufacturing date ${data.harvestDate.trim()}.`);
  }
  const thc = typeof data.thcContent === "string" ? data.thcContent.trim() : "";
  if (thc && thc !== "N/A") lines.push(`THC content supplied as ${thc}.`);
  return lines.join(" ");
}
