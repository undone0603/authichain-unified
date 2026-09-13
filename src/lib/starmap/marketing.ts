import type { NightstampInput, NightstampPayload } from "./types";

export type NightstampMarketingManifest = {
  skyUrl: string;
  imageUrl: string;
  referralUrl: string;
  campaign: string;
  variants: Array<{ channel: string; title: string; body: string; cta: string }>;
  hashtags: string[];
};

const safeLabel = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 100);

export function buildNightstampMarketing(input: NightstampInput, payload: NightstampPayload, ref = "nightstamp"): NightstampMarketingManifest {
  const place = safeLabel(input.placeLabel) || "under this sky";
  const event = payload.eventAt.slice(0, 10);
  const referralUrl = `${payload.url}?ref=${encodeURIComponent(ref)}`;
  const hook = input.dedication ? `A moment for ${safeLabel(input.dedication)}.` : `A real sky, preserved for one real moment.`;

  return {
    skyUrl: payload.url,
    imageUrl: payload.url,
    referralUrl,
    campaign: `nightstamp-${event}`,
    variants: [
      { channel: "instagram", title: "The sky from your moment", body: `${hook} Nightstamp turns date + place into a beautiful scannable star-map QR. ${place}.`, cta: referralUrl },
      { channel: "pinterest", title: "Your night, made permanent", body: `A deterministic star map for ${event}, tied to ${place}. Scan it to open the Memory Portal.`, cta: referralUrl },
      { channel: "tiktok", title: "What did the sky look like?", body: `Enter a date and place. Get the sky from that moment as a QR art piece and Memory Portal.`, cta: referralUrl },
      { channel: "facebook", title: "Turn a memory into a place in the sky", body: `${hook} Create a Nightstamp for weddings, births, anniversaries, memorials, or the moments you never want to lose.`, cta: referralUrl },
      { channel: "linkedin", title: "Nightstamp: physical memory + digital portal", body: `QRON is testing a new physical-to-digital keepsake: a date-and-place star field with a scannable QR that opens a persistent Memory Portal.`, cta: referralUrl },
    ],
    hashtags: ["#Nightstamp", "#QRON", "#StarMap", "#MemoryPortal", "#WeddingGift", "#AnniversaryGift"],
  };
}
