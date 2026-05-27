const fs = require('fs');
const { globSync } = require('glob');

// Capture all .js, .ts, .jsx, .tsx in src/app/api and app/api
const files = globSync(['src/app/api/**/*.{js,ts,jsx,tsx}', 'app/api/**/*.{js,ts,jsx,tsx}']);
const lineToInject = "export const runtime = 'edge';\n\n";

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes("export const runtime = 'edge'")) {
    fs.writeFileSync(file, lineToInject + content);
    console.log(`Updated: ${file}`);
  }
});

// Delete /api/server.disabled.js (or .ts / .tsx) if it exists anywhere
const filesToDelete = globSync('**/api/server.disabled.{js,ts,tsx}');
filesToDelete.forEach(file => {
  fs.unlinkSync(file);
  console.log(`Deleted: ${file}`);
});
