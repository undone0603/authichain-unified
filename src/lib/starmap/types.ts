export type NightstampStyle = "navy-gold" | "parchment" | "glow";
export type NightstampSku = "preview" | "digital" | "portal" | "certified";

export type NightstampInput = {
  dateISO: string;
  time: string;
  lat: number;
  lon: number;
  tz: string;
  placeLabel: string;
  dedication?: string;
  style: NightstampStyle;
  sku: NightstampSku;
};

export type NightstampPayload = {
  id: string;
  url: string;
  eventAt: string;
  catalogHash: string;
};

export type Star = { ra: number; dec: number; mag: number };
