// @ts-ignore - package installed separately
import { Resvg } from '@resvg/resvg-js';
import fs from 'fs';
import path from 'path';

const pub = path.resolve(process.cwd(), 'client/public');
const domains = ['authichain', 'qron', 'strainchain', 'govchain'];

async function main() {
  for (const d of domains) {
    const svgPath = path.join(pub, `favicon-${d}.svg`);
    const outPath = path.join(pub, `apple-touch-icon-${d}.png`);

    const svg = fs.readFileSync(svgPath, 'utf-8');
    const resvg = new Resvg(svg, {
      fitTo: { mode: 'width', value: 180 },
    });
    const rendered = resvg.render();
    const pngBuffer = rendered.asPng();
    fs.writeFileSync(outPath, pngBuffer);
    console.log(`Created ${path.basename(outPath)} (${pngBuffer.length} bytes)`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
