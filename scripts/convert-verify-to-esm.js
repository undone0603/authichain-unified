import fs from 'fs';
import path from 'path';

const dir = './scripts/verify';
fs.readdirSync(dir).forEach(file => {
  if (!file.endsWith('.cjs') && !file.endsWith('.js')) return;
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace requires and dotenv config
  content = content.replace(/const\s+(\w+)\s*=\s*require\(['"]([^'"]+)['"]\);?/g, "import $1 from '$2';");
  content = content.replace(/const\s+\{\s*([^}]+)\s*\}\s*=\s*require\(['"]([^'"]+)['"]\);?/g, "import { $1 } from '$2';");
  content = content.replace(/require\(['"]dotenv['"]\)\.config\(\);?/g, "import 'dotenv/config';");

  const newFilePath = filePath.replace(/\.cjs$/, '.js');
  fs.writeFileSync(newFilePath, content, 'utf8');
  if (filePath !== newFilePath) {
    fs.unlinkSync(filePath);
  }
  console.log(`Converted ${file} to ESM.`);
});
console.log('Conversion complete.');
