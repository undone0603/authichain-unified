/**
 * GF(2^8) arithmetic and Reed–Solomon remainders over the QR field
 * polynomial x^8 + x^4 + x^3 + x^2 + 1 (0x11D), per ISO/IEC 18004.
 *
 * Addition in this field is XOR, so every Reed–Solomon codeword is a
 * GF(2)-linear function of the data bits. Inverse synthesis depends on that.
 */

const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);

{
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x;
    LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
}

export function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[LOG[a] + LOG[b]];
}

const divisorCache = new Map<number, Uint8Array>();

/**
 * Coefficients of the monic generator polynomial of the given degree,
 * highest-order term omitted, highest power first.
 */
export function rsDivisor(degree: number): Uint8Array {
  const cached = divisorCache.get(degree);
  if (cached) return cached;
  if (degree < 1 || degree > 255) throw new RangeError("rs_degree_out_of_range");
  const result = new Uint8Array(degree);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root);
      if (j + 1 < degree) result[j] ^= result[j + 1];
    }
    root = gfMul(root, 0x02);
  }
  divisorCache.set(degree, result);
  return result;
}

/** Error-correction codewords for one block of data codewords. */
export function rsRemainder(
  data: ArrayLike<number>,
  divisor: Uint8Array
): Uint8Array {
  const n = divisor.length;
  const result = new Uint8Array(n);
  for (let i = 0; i < data.length; i++) {
    const factor = data[i] ^ result[0];
    result.copyWithin(0, 1);
    result[n - 1] = 0;
    if (factor === 0) continue;
    for (let j = 0; j < n; j++) result[j] ^= gfMul(divisor[j], factor);
  }
  return result;
}
