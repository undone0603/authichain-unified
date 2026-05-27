const fs = require('fs');
const { globSync } = require('glob');

const files = globSync('src/app/api/**/*.ts?(x)');
const lineToInject = "export const runtime = 'edge';\n\n";

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  if (!content.includes("export const runtime = 'edge'")) {
    fs.writeFileSync(file, lineToInject + content);
    console.log(`Updated: ${file}`);
  }
});
