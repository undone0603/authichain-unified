/**
 * QRON renderers: an RGBA rasterizer (the validator scans this) and an SVG
 * writer that draws the same design as vectors.
 *
 * Function patterns (finders, alignment, timing, format and version info)
 * are protected. Their style may change, but their module geometry and
 * contrast never do. The halftone shape is the multiscale layer: a scanner
 * samples module centres, so only a centre square has to carry the module
 * value, and the rest of each module shows the artwork at full resolution.
 */

import { layout, Role, type QrSymbol } from "./encoder";
import { luminance, type Rgb, type TargetField } from "./targets";

export type Palette = {
  id: string;
  label: string;
  dark: Rgb;
  /** second dark stop for gradient fills */
  dark2: Rgb;
  light: Rgb;
  /** artwork tones for procedural halftone backgrounds */
  artDark: Rgb;
  artLight: Rgb;
};

/** Every palette clears the contrast floor asserted in studio.test.ts. */
export const PALETTES: readonly Palette[] = [
  { id: "obsidian-gold", label: "Obsidian & gold", dark: [20, 17, 15], dark2: [64, 42, 12], light: [248, 236, 204], artDark: [38, 28, 18], artLight: [240, 196, 112] },
  { id: "midnight-ink", label: "Midnight ink", dark: [11, 29, 58], dark2: [36, 20, 74], light: [238, 243, 251], artDark: [16, 32, 72], artLight: [150, 186, 240] },
  { id: "forest-canopy", label: "Forest canopy", dark: [16, 46, 30], dark2: [10, 54, 50], light: [241, 245, 233], artDark: [22, 60, 36], artLight: [170, 214, 150] },
  { id: "ember", label: "Ember", dark: [59, 13, 12], dark2: [80, 22, 6], light: [255, 241, 224], artDark: [92, 22, 14], artLight: [255, 170, 110] },
  { id: "violet-dusk", label: "Violet dusk", dark: [42, 20, 73], dark2: [70, 14, 64], light: [243, 236, 255], artDark: [50, 26, 92], artLight: [206, 168, 255] },
  { id: "deep-ocean", label: "Deep ocean", dark: [6, 52, 63], dark2: [4, 30, 70], light: [230, 247, 248], artDark: [8, 62, 80], artLight: [120, 214, 222] },
  { id: "graphite", label: "Graphite", dark: [22, 22, 24], dark2: [48, 48, 56], light: [255, 255, 255], artDark: [40, 40, 44], artLight: [205, 205, 210] },
  { id: "rosewood", label: "Rosewood", dark: [74, 16, 36], dark2: [56, 12, 52], light: [253, 238, 242], artDark: [96, 24, 48], artLight: [246, 176, 196] },
];

export type ModuleShape = "square" | "dot" | "diamond" | "liquid" | "halftone";
export type FinderStyle = "square" | "rounded" | "orb";

export type DesignStyle = {
  shape: ModuleShape;
  finder: FinderStyle;
  palette: Palette;
  gradient: boolean;
  /** dot diameter, diamond size or halftone centre size, as a module fraction */
  scale: number;
  /**
   * Halftone only: how far the artwork around each centre leans toward the
   * module's tone (0 = untouched art, 1 = solid module). Raises
   * module-level contrast so the code survives blur.
   */
  blend?: number;
};

export type Raster = { width: number; height: number; data: Uint8ClampedArray };

export type RenderOptions = {
  /** pixels per module */
  ppm: number;
  quiet?: number;
  supersample?: number;
  /** artwork for halftone backgrounds */
  field?: TargetField | null;
  /** draw only the halftone background (used to embed art in SVG) */
  artOnly?: boolean;
};

const DARK_LUMA = 0.18;
const LIGHT_LUMA = 0.8;

const lerp = (a: Rgb, b: Rgb, t: number): Rgb => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];

/** Darkens a colour to at most DARK_LUMA, keeping its hue. */
export function toneDark(c: Rgb): Rgb {
  const y = luminance(c);
  if (y <= DARK_LUMA) return c;
  const k = DARK_LUMA / y;
  return [c[0] * k, c[1] * k, c[2] * k];
}

/** Lightens a colour to at least LIGHT_LUMA, keeping its hue. */
export function toneLight(c: Rgb): Rgb {
  const y = luminance(c);
  if (y >= LIGHT_LUMA) return c;
  const t = (LIGHT_LUMA - y) / (1 - y);
  return [c[0] + (255 - c[0]) * t, c[1] + (255 - c[1]) * t, c[2] + (255 - c[2]) * t];
}

/** Signed distance to a rounded box centred at the origin. */
function roundedBox(px: number, py: number, half: number, radius: number): number {
  const qx = Math.abs(px) - half + radius;
  const qy = Math.abs(py) - half + radius;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - radius;
}

/** Finder or alignment pattern: is the point dark? (dx, dy from its centre) */
function patternDark(style: FinderStyle, dx: number, dy: number, outer: number): boolean {
  // outer = 3.5 for finders (7x7), 2.5 for alignment (5x5)
  if (style === "orb") {
    const r = Math.hypot(dx, dy);
    return r <= outer ? r > outer - 1 || r <= outer - 2 : false;
  }
  if (style === "rounded") {
    const ring = roundedBox(dx, dy, outer, outer * 0.42);
    const hole = roundedBox(dx, dy, outer - 1, (outer - 1) * 0.36);
    const core = roundedBox(dx, dy, outer - 2, (outer - 2) * 0.4);
    return (ring <= 0 && hole > 0) || core <= 0;
  }
  const d = Math.max(Math.abs(dx), Math.abs(dy));
  return d <= outer && (d > outer - 1 || d <= outer - 2);
}

type Geometry = {
  size: number;
  quiet: number;
  role: Uint8Array;
  isFunction: Uint8Array;
  finders: [number, number][];
  aligns: [number, number][];
};

function geometry(symbol: QrSymbol, quiet: number): Geometry {
  const lay = layout(symbol.version);
  const { size } = symbol;
  const finders: [number, number][] = [
    [3.5, 3.5],
    [size - 3.5, 3.5],
    [3.5, size - 3.5],
  ];
  const aligns: [number, number][] = [];
  const pos = lay.alignmentCenters;
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      aligns.push([pos[i] + 0.5, pos[j] + 0.5]);
    }
  }
  return { size, quiet, role: lay.role, isFunction: lay.isFunction, finders, aligns };
}

/** Halftone centre colour per module: the artwork tone-mapped dark or light. */
export function halftoneCenterColors(
  symbol: QrSymbol,
  style: DesignStyle,
  field: TargetField | null,
  quiet = 4
): Rgb[] {
  const { size } = symbol;
  const span = size + quiet * 2;
  const out: Rgb[] = new Array(size * size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const mx = x + 0.5;
      const my = y + 0.5;
      const art = artColor(style, field, (mx + quiet) / span, (my + quiet) / span);
      out[y * size + x] =
        symbol.modules[y * size + x] === 1
          ? toneDark(lerp(art, darkColor(style, size, mx, my), 0.5))
          : toneLight(art);
    }
  }
  return out;
}

function artColor(style: DesignStyle, field: TargetField | null, u: number, v: number): Rgb {
  if (!field) return style.palette.light;
  return field.color ? field.color(u, v) : lerp(style.palette.artDark, style.palette.artLight, field.luma(u, v));
}

function darkColor(style: DesignStyle, size: number, mx: number, my: number): Rgb {
  const { palette } = style;
  if (!style.gradient) return palette.dark;
  return lerp(palette.dark, palette.dark2, Math.min(1, Math.max(0, (mx + my) / (2 * size))));
}

function makeShader(symbol: QrSymbol, style: DesignStyle, geo: Geometry, opts: RenderOptions) {
  const { size, quiet, role } = geo;
  const { palette } = style;
  const field = opts.field ?? null;
  const span = size + quiet * 2;
  const halftone = style.shape === "halftone" && !!field;
  const mods = symbol.modules;
  const centers = halftone ? halftoneCenterColors(symbol, style, field, quiet) : null;

  const art = (mx: number, my: number) => artColor(style, field, (mx + quiet) / span, (my + quiet) / span);
  const darkAt = (mx: number, my: number) => darkColor(style, size, mx, my);
  const dark = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size ? mods[y * size + x] === 1 : false;

  return (mx: number, my: number): Rgb => {
    const inside = mx >= 0 && my >= 0 && mx < size && my < size;
    if (!inside || opts.artOnly) {
      if (!halftone) return palette.light;
      return inside ? art(mx, my) : toneLight(art(mx, my));
    }
    const x = Math.floor(mx);
    const y = Math.floor(my);
    const u = mx - x;
    const v = my - y;
    const r = role[y * size + x];

    if (r === Role.Finder || r === Role.Separator) {
      for (const [cx, cy] of geo.finders) {
        if (Math.abs(mx - cx) <= 4.5 && Math.abs(my - cy) <= 4.5) {
          return patternDark(style.finder, mx - cx, my - cy, 3.5) ? darkAt(mx, my) : palette.light;
        }
      }
    }
    if (r === Role.Alignment) {
      for (const [cx, cy] of geo.aligns) {
        if (Math.abs(mx - cx) <= 2.5 && Math.abs(my - cy) <= 2.5) {
          return patternDark(style.finder, mx - cx, my - cy, 2.5) ? darkAt(mx, my) : palette.light;
        }
      }
    }
    const isDark = mods[y * size + x] === 1;
    if (centers) {
      const c = geo.isFunction[y * size + x] === 1 ? 0.5 : style.scale / 2;
      const tone = centers[y * size + x];
      if (Math.abs(u - 0.5) <= c && Math.abs(v - 0.5) <= c) return tone;
      return style.blend ? lerp(art(mx, my), tone, style.blend) : art(mx, my);
    }
    if (!isDark) return palette.light;
    switch (style.shape) {
      case "dot":
        return Math.hypot(u - 0.5, v - 0.5) <= style.scale / 2 ? darkAt(mx, my) : palette.light;
      case "diamond":
        return Math.abs(u - 0.5) + Math.abs(v - 0.5) <= style.scale * 0.6 ? darkAt(mx, my) : palette.light;
      case "liquid": {
        // A corner rounds to radius 0.5 when no neighbour touches it.
        const sx = u < 0.5 ? -1 : 1;
        const sy = v < 0.5 ? -1 : 1;
        if (dark(x + sx, y) || dark(x, y + sy) || dark(x + sx, y + sy)) return darkAt(mx, my);
        return Math.hypot(u - 0.5, v - 0.5) <= 0.5 ? darkAt(mx, my) : palette.light;
      }
      default:
        return darkAt(mx, my);
    }
  };
}

/** Rasterizes a design to RGBA with supersampled anti-aliasing. */
export function renderRaster(symbol: QrSymbol, style: DesignStyle, opts: RenderOptions): Raster {
  const quiet = opts.quiet ?? 4;
  const ss = Math.max(1, Math.floor(opts.supersample ?? 3));
  const geo = geometry(symbol, quiet);
  const shade = makeShader(symbol, style, geo, opts);
  const ppm = opts.ppm;
  const width = Math.round((symbol.size + quiet * 2) * ppm);
  const data = new Uint8ClampedArray(width * width * 4);
  for (let py = 0; py < width; py++) {
    for (let px = 0; px < width; px++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = shade((px + (sx + 0.5) / ss) / ppm - quiet, (py + (sy + 0.5) / ss) / ppm - quiet);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = ss * ss;
      const i = (py * width + px) * 4;
      data[i] = r / n;
      data[i + 1] = g / n;
      data[i + 2] = b / n;
      data[i + 3] = 255;
    }
  }
  return { width, height: width, data };
}

const hex = ([r, g, b]: Rgb) =>
  "#" + [r, g, b].map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");

const num = (n: number) => String(Math.round(n * 1000) / 1000);

function boxPath(cx: number, cy: number, half: number, radius: number): string {
  const r = Math.min(radius, half);
  const x0 = cx - half;
  const y0 = cy - half;
  const s = half * 2;
  if (r <= 0) return `M${num(x0)} ${num(y0)}h${num(s)}v${num(s)}h${num(-s)}z`;
  return (
    `M${num(x0 + r)} ${num(y0)}h${num(s - 2 * r)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(r)}` +
    `v${num(s - 2 * r)}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(r)}h${num(-(s - 2 * r))}` +
    `a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(-r)}v${num(-(s - 2 * r))}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(-r)}z`
  );
}

/** Axis-aligned box around (cx, cy), clipped to the symbol area. */
function clippedBox(cx: number, cy: number, half: number, size: number): string {
  const x0 = Math.max(0, cx - half);
  const y0 = Math.max(0, cy - half);
  const x1 = Math.min(size, cx + half);
  const y1 = Math.min(size, cy + half);
  return `M${num(x0)} ${num(y0)}H${num(x1)}V${num(y1)}H${num(x0)}z`;
}

function circlePath(cx: number, cy: number, r: number): string {
  return `M${num(cx - r)} ${num(cy)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0z`;
}

function patternPath(style: FinderStyle, cx: number, cy: number, outer: number): string {
  if (style === "orb") {
    return circlePath(cx, cy, outer) + circlePath(cx, cy, outer - 1) + circlePath(cx, cy, outer - 2);
  }
  const k = style === "rounded";
  return (
    boxPath(cx, cy, outer, k ? outer * 0.42 : 0) +
    boxPath(cx, cy, outer - 1, k ? (outer - 1) * 0.36 : 0) +
    boxPath(cx, cy, outer - 2, k ? (outer - 2) * 0.4 : 0)
  );
}

export type SvgOptions = {
  quiet?: number;
  /** artwork the halftone centres are tone-mapped from */
  field?: TargetField | null;
  /** pre-rendered halftone background (data: URI), drawn under the modules */
  artHref?: string;
  title?: string;
  /** output width/height attribute in px */
  pixelSize?: number;
};

/** Vector rendering of the same design. Halftone art is embedded as an image. */
export function renderSvg(symbol: QrSymbol, style: DesignStyle, opts: SvgOptions = {}): string {
  const quiet = opts.quiet ?? 4;
  const geo = geometry(symbol, quiet);
  const { size } = symbol;
  const { palette } = style;
  const span = size + quiet * 2;
  const field = opts.field ?? null;
  const halftone = style.shape === "halftone" && !!field && !!opts.artHref;
  const darkFill = style.gradient ? "url(#qron-dark)" : hex(palette.dark);
  const mods = symbol.modules;
  const at = (x: number, y: number) =>
    x >= 0 && y >= 0 && x < size && y < size ? mods[y * size + x] === 1 : false;
  const centers = halftone ? halftoneCenterColors(symbol, style, field, quiet) : null;

  const dark: string[] = [];
  const centerPaths = new Map<string, string[]>();
  const blendPaths = new Map<string, string[]>();
  const push = (map: Map<string, string[]>, fill: string, d: string) => {
    const list = map.get(fill);
    if (list) list.push(d);
    else map.set(fill, [d]);
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const r = geo.role[y * size + x];
      if (r === Role.Finder || r === Role.Separator || r === Role.Alignment) continue;
      const isDark = at(x, y);
      if (centers) {
        const c = geo.isFunction[y * size + x] === 1 ? 0.5 : style.scale / 2;
        const fill = hex(centers[y * size + x]);
        push(centerPaths, fill, `M${num(x + 0.5 - c)} ${num(y + 0.5 - c)}h${num(2 * c)}v${num(2 * c)}h${num(-2 * c)}z`);
        // Blending art toward the tone = the tone composited at alpha `blend`.
        if (style.blend && c < 0.5) push(blendPaths, fill, `M${x} ${y}h1v1h-1z`);
        continue;
      }
      if (!isDark) continue;
      switch (style.shape) {
        case "dot":
          dark.push(circlePath(x + 0.5, y + 0.5, style.scale / 2));
          break;
        case "diamond": {
          const d = style.scale * 0.6;
          dark.push(`M${num(x + 0.5)} ${num(y + 0.5 - d)}l${num(d)} ${num(d)}l${num(-d)} ${num(d)}l${num(-d)} ${num(-d)}z`);
          break;
        }
        case "liquid": {
          const corner = (sx: number, sy: number) => !at(x + sx, y) && !at(x, y + sy) && !at(x + sx, y + sy);
          const tl = corner(-1, -1) ? 0.5 : 0;
          const tr = corner(1, -1) ? 0.5 : 0;
          const br = corner(1, 1) ? 0.5 : 0;
          const bl = corner(-1, 1) ? 0.5 : 0;
          dark.push(
            `M${num(x + tl)} ${num(y)}h${num(1 - tl - tr)}` +
              (tr ? `a${tr} ${tr} 0 0 1 ${tr} ${tr}` : "") +
              `v${num(1 - tr - br)}` +
              (br ? `a${br} ${br} 0 0 1 ${-br} ${br}` : "") +
              `h${num(-(1 - br - bl))}` +
              (bl ? `a${bl} ${bl} 0 0 1 ${-bl} ${-bl}` : "") +
              `v${num(-(1 - bl - tl))}` +
              (tl ? `a${tl} ${tl} 0 0 1 ${tl} ${-tl}` : "") +
              "z"
          );
          break;
        }
        default:
          dark.push(`M${x} ${y}h1v1h-1z`);
      }
    }
  }
  const patterns = [
    ...geo.finders.map(([cx, cy]) => patternPath(style.finder, cx, cy, 3.5)),
    ...geo.aligns.map(([cx, cy]) => patternPath(style.finder, cx, cy, 2.5)),
  ].join("");
  const px = opts.pixelSize ?? span * 12;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${-quiet} ${-quiet} ${span} ${span}" width="${px}" height="${px}" shape-rendering="geometricPrecision">`,
    opts.title ? `<title>${opts.title.replace(/[<&>]/g, "")}</title>` : "",
    style.gradient
      ? `<defs><linearGradient id="qron-dark" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="${size}" y2="${size}"><stop offset="0" stop-color="${hex(palette.dark)}"/><stop offset="1" stop-color="${hex(palette.dark2)}"/></linearGradient></defs>`
      : "",
    `<rect x="${-quiet}" y="${-quiet}" width="${span}" height="${span}" fill="${hex(palette.light)}"/>`,
    halftone
      ? `<image href="${opts.artHref}" x="${-quiet}" y="${-quiet}" width="${span}" height="${span}" preserveAspectRatio="none"/>`
      : "",
    ...[...blendPaths].map(
      ([fill, d]) => `<path fill="${fill}" fill-opacity="${num(style.blend ?? 0)}" d="${d.join("")}"/>`
    ),
    ...[...centerPaths].map(([fill, d]) => `<path fill="${fill}" d="${d.join("")}"/>`),
    halftone
      ? `<path fill="${hex(palette.light)}" d="${[
          ...geo.finders.map(([cx, cy]) => clippedBox(cx, cy, 4.5, size)),
          ...geo.aligns.map(([cx, cy]) => clippedBox(cx, cy, 2.5, size)),
        ].join("")}"/>`
      : "",
    `<path fill="${darkFill}" d="${dark.join("")}"/>`,
    `<path fill="${darkFill}" fill-rule="evenodd" d="${patterns}"/>`,
    "</svg>",
  ];
  return parts.join("");
}
