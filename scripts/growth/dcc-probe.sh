#!/usr/bin/env bash
# Temporary: learn the DCA iServices licence API shape. Removed before merge.
set -u
curl -sSL -m 30 https://iservices.dca.ca.gov/swagger/spec/search.json -o spec.json
echo "=== spec size $(wc -c < spec.json)"
node -e '
const s=JSON.parse(require("fs").readFileSync("spec.json","utf8"));
console.log("servers", JSON.stringify(s.servers||s.host||s.basePath));
for (const [p,ops] of Object.entries(s.paths||{})) for (const [m,o] of Object.entries(ops)) {
  if (typeof o!=="object") continue;
  console.log(m.toUpperCase(), p, "|", (o.summary||"").slice(0,100));
  for (const q of o.parameters||[]) console.log("   param", q.in, q.name, q.required?"req":"", (q.description||"").slice(0,140).replace(/\s+/g," "), q.schema?JSON.stringify(q.schema).slice(0,160):"", q.enum?JSON.stringify(q.enum).slice(0,300):"");
}
const txt=JSON.stringify(s);
const m=txt.match(/.{150}[Cc]annabis.{150}/g); console.log("cannabis:", (m||[]).slice(0,5));
'
