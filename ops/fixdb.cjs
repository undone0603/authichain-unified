const fs = require("fs");
const path = path.join(__dirname, "../server/db.ts");
let s = fs.readFileSync(path, "utf8");
let n = 0;

// 1) Single-line inserts: add .returning({ id: TABLE.id }) before the semicolon
s = s.replace(/const result = await (d|db)\.insert\((\w+)\)\.values\((\w+)\);/g,
  (m, dvar, table, arg) => { n++; return `const result = await ${dvar}.insert(${table}).values(${arg}).returning({ id: ${table}.id });`; });

// 2) Multi-line leads upsert insert: add .returning before the closing of .values({...})
s = s.replace(/(\n  })\;(\n  return \{ id: result\[0\]\.insertId, created: true \};)/,
  (m, close, ret) => { n++; return `${close}.returning({ id: leads.id });${ret}`; });

// 3) Replace all MySQL-style result[0].insertId with Postgres returning result[0].id
const before = (s.match(/result\[0\]\.insertId/g) || []).length;
s = s.replace(/result\[0\]\.insertId/g, "result[0].id");

fs.writeFileSync(path, s);
console.log(`returning() added to ${n} inserts; insertId->id replaced ${before} times`);
