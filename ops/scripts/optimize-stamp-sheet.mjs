import sharp from 'sharp';
import { stat } from 'node:fs/promises';

const SRC = 'public/media/roscommon-stamp-sheet.png';
const OUT_PNG = 'public/media/roscommon-stamp-sheet.png';
const OUT_WEBP = 'public/media/roscommon-stamp-sheet.webp';

const before = await stat(SRC);

const buf = await sharp(SRC)
  .resize({ width: 1920, withoutEnlargement: true })
  .png({ compressionLevel: 9, quality: 82, palette: true })
  .toBuffer();

await sharp(buf).toFile(OUT_PNG);

await sharp(SRC)
  .resize({ width: 1920, withoutEnlargement: true })
  .webp({ quality: 82 })
  .toFile(OUT_WEBP);

const afterPng = await stat(OUT_PNG);
const afterWebp = await stat(OUT_WEBP);

const fmt = (b) => `${(b / 1024 / 1024).toFixed(2)} MB`;
console.log(`Before: ${fmt(before.size)}`);
console.log(`After PNG:  ${fmt(afterPng.size)}`);
console.log(`After WebP: ${fmt(afterWebp.size)}`);
