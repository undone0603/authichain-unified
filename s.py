import os

print("=== ALL FILES ===")
for r, d, fs in os.walk("."):
-if "node_modules" in r or "/." in r: continue
 for f in fs: 
  p = os.path.join(r, f)
  if any(kw in p.lower() for kw in ["stripe", "webhook", "middleware", "rate", "grant", "readme"]):
   print(p)

print("\n=== KEYWORD SEARCH ===")
for r, d, fs in os.walk("."):
-if "node_modules" in r or "/." in r: continue
 for f in fs: 
  if f.endswith((".ts", ".js", ".py", ".json", ".sql")):
  p = os.path.join(r, f)
  try:
   txt = open(p).read().lower()
   found = [k for k in ["user_grants", "rate", "limit", "stripe", "checkout", "starter", "launch"] if k in txt]
   if found:
    print(p, found)
  except:
    pass
