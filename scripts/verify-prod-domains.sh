#!/usr/bin/env bash
# Post-Vercel-cleanup smoke: every production domain still serves.
for u in https://app.authichain.com/ https://authichain.com/ https://qron.space/ https://app.qron.space/ https://govchain.us/ https://strainchain.io/; do
  code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "$u")
  echo "GET $u -> $code"
done
