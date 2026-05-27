const fs = require('fs');
const { globSync } = require('glob');

// Ensure you have 'glob' installed: npm install glob
const files = globSync('src/app/api/**/*.ts?(x)');
const lineToInject = "export const runtime = 'edge';\n\n";

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Only inject if it's not already present
  if (!content.includes("export const runtime = 'edge'")) {
    fs.writeFileSync(file, lineToInject + content);
    console.log(`Updated: ${file}`);
  }
});
