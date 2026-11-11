/**
 * Capture simulation for scanner-in-the-loop validation: blur, rotation,
 * perspective, uneven light, sensor noise, contrast loss and print-scale
 * resampling, all on a grayscale image. Deterministic given a seeded RNG.
 */

import type { Raster } from "./render";

export type Gray = { width: number; height: number; data: Float32Array };

export function toGray(raster: Raster): Gray {
  const { width, height, data } = raster;
  const out = new Float32Array(width * height);
  for (let i = 0; i < out.length; i++) {
    out[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  }
  return { width, height, data: out };
}

export function grayToBytes(img: Gray): Uint8ClampedArray {
  return Uint8ClampedArray.from(img.data);
}

export function grayToRgba(img: Gray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(img.width * img.height * 4);
  for (let i = 0; i < img.data.length; i++) {
    const v = img.data[i];
    out[i * 4] = v;
    out[i * 4 + 1] = v;
    out[i * 4 + 2] = v;
    out[i * 4 + 3] = 255;
  }
  return out;
}

export function gaussianBlur(img: Gray, sigma: number): Gray {
  if (sigma <= 0) return img;
  const radius = Math.ceil(sigma * 3);
  const kernel = new Float32Array(radius * 2 + 1);
  let sum = 0;
  for (let i = -radius; i <= radius; i++) {
    kernel[i + radius] = Math.exp(-(i * i) / (2 * sigma * sigma));
    sum += kernel[i + radius];
  }
  for (let i = 0; i < kernel.length; i++) kernel[i] /= sum;
  const { width: w, height: h } = img;
  const tmp = new Float32Array(w * h);
  const out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        acc += img.data[y * w + xx] * kernel[k + radius];
      }
      tmp[y * w + x] = acc;
    }
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let acc = 0;
      for (let k = -radius; k <= radius; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        acc += tmp[yy * w + x] * kernel[k + radius];
      }
      out[y * w + x] = acc;
    }
  }
  return { width: w, height: h, data: out };
}

/** 3x3 matrix, row-major. */
export type Homography = [number, number, number, number, number, number, number, number, number];

/** Solves the homography mapping four `from` points onto four `to` points. */
export function homography(from: [number, number][], to: [number, number][]): Homography {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i];
    const [u, v] = to[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let col = 0; col < 8; col++) {
    let pivot = col;
    for (let r = col + 1; r < 8; r++) if (Math.abs(A[r][col]) > Math.abs(A[pivot][col])) pivot = r;
    [A[col], A[pivot]] = [A[pivot], A[col]];
    const p = A[col][col];
    if (Math.abs(p) < 1e-12) throw new Error("degenerate_homography");
    for (let c = col; c < 9; c++) A[col][c] /= p;
    for (let r = 0; r < 8; r++) {
      if (r === col) continue;
      const f = A[r][col];
      if (f === 0) continue;
      for (let c = col; c < 9; c++) A[r][c] -= f * A[col][c];
    }
  }
  return [A[0][8], A[1][8], A[2][8], A[3][8], A[4][8], A[5][8], A[6][8], A[7][8], 1];
}

/** Resamples `img` onto a new canvas; `inverse` maps output pixels to input pixels. */
export function warp(img: Gray, inverse: Homography, outW: number, outH: number, fill: number): Gray {
  const out = new Float32Array(outW * outH);
  const { width: w, height: h, data } = img;
  const [a, b, c, d, e, f, g, hh, i] = inverse;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const px = x + 0.5;
      const py = y + 0.5;
      const z = g * px + hh * py + i;
      const sx = (a * px + b * py + c) / z - 0.5;
      const sy = (d * px + e * py + f) / z - 0.5;
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      if (x0 < 0 || y0 < 0 || x0 + 1 >= w || y0 + 1 >= h) {
        out[y * outW + x] = fill;
        continue;
      }
      const fx = sx - x0;
      const fy = sy - y0;
      const top = data[y0 * w + x0] * (1 - fx) + data[y0 * w + x0 + 1] * fx;
      const bot = data[(y0 + 1) * w + x0] * (1 - fx) + data[(y0 + 1) * w + x0 + 1] * fx;
      out[y * outW + x] = top * (1 - fy) + bot * fy;
    }
  }
  return { width: outW, height: outH, data: out };
}

export function rotate(img: Gray, degrees: number, fill: number): Gray {
  const t = (degrees * Math.PI) / 180;
  const { width: w, height: h } = img;
  const outW = Math.ceil(Math.abs(w * Math.cos(t)) + Math.abs(h * Math.sin(t)));
  const outH = Math.ceil(Math.abs(w * Math.sin(t)) + Math.abs(h * Math.cos(t)));
  const cos = Math.cos(t);
  const sin = Math.sin(t);
  // output -> input: translate to centre, rotate by -t, translate back
  const cx = outW / 2;
  const cy = outH / 2;
  const ix = w / 2;
  const iy = h / 2;
  const inverse: Homography = [cos, sin, ix - cos * cx - sin * cy, -sin, cos, iy + sin * cx - cos * cy, 0, 0, 1];
  return warp(img, inverse, outW, outH, fill);
}

/** Keystone tilt: the top edge shrinks by `amount` (0..0.5) of the width. */
export function perspective(img: Gray, amount: number, fill: number): Gray {
  const { width: w, height: h } = img;
  const pad = Math.round(w * 0.08);
  const outW = w + pad * 2;
  const outH = h + pad * 2;
  const inset = w * amount * 0.5;
  const dst: [number, number][] = [
    [pad + inset, pad + h * 0.04],
    [pad + w - inset, pad],
    [pad + w, pad + h],
    [pad, pad + h * 0.97],
  ];
  const src: [number, number][] = [
    [0, 0],
    [w, 0],
    [w, h],
    [0, h],
  ];
  return warp(img, homography(dst, src), outW, outH, fill);
}

/** Directional light falloff plus a soft shadow band. */
export function unevenLight(img: Gray, minGain: number, angle: number): Gray {
  const { width: w, height: h } = img;
  const out = new Float32Array(w * h);
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const t = ((x / w - 0.5) * dx + (y / h - 0.5) * dy + 0.71) / 1.42;
      const shadow = 1 - 0.18 * Math.exp(-(((x / w - 0.65) / 0.08) ** 2));
      out[y * w + x] = img.data[y * w + x] * (minGain + (1 - minGain) * t) * shadow;
    }
  }
  return { width: w, height: h, data: out };
}

export function addNoise(img: Gray, sigma: number, rand: () => number): Gray {
  const out = new Float32Array(img.data.length);
  for (let i = 0; i < out.length; i++) {
    const u1 = Math.max(rand(), 1e-12);
    const u2 = rand();
    const n = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    out[i] = img.data[i] + n * sigma;
  }
  return { width: img.width, height: img.height, data: out };
}

export function compressContrast(img: Gray, lo: number, hi: number): Gray {
  const out = new Float32Array(img.data.length);
  for (let i = 0; i < out.length; i++) out[i] = lo + ((hi - lo) * img.data[i]) / 255;
  return { width: img.width, height: img.height, data: out };
}

/** Area-average downscale by a factor < 1 (print-size / distance simulation). */
export function downscale(img: Gray, factor: number): Gray {
  const outW = Math.max(1, Math.round(img.width * factor));
  const outH = Math.max(1, Math.round(img.height * factor));
  const out = new Float32Array(outW * outH);
  const sx = img.width / outW;
  const sy = img.height / outH;
  for (let y = 0; y < outH; y++) {
    for (let x = 0; x < outW; x++) {
      const x0 = x * sx;
      const y0 = y * sy;
      let acc = 0;
      let area = 0;
      for (let yy = Math.floor(y0); yy < Math.ceil(y0 + sy); yy++) {
        const wy = Math.min(yy + 1, y0 + sy) - Math.max(yy, y0);
        for (let xx = Math.floor(x0); xx < Math.ceil(x0 + sx); xx++) {
          const wx = Math.min(xx + 1, x0 + sx) - Math.max(xx, x0);
          const wgt = wx * wy;
          acc += img.data[Math.min(img.height - 1, yy) * img.width + Math.min(img.width - 1, xx)] * wgt;
          area += wgt;
        }
      }
      out[y * outW + x] = acc / area;
    }
  }
  return { width: outW, height: outH, data: out };
}
