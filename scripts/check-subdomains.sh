#!/usr/bin/env bash
for h in api.authichain.com dashboard.authichain.com bitcoin-auth.authichain.com app.authichain.com www.authichain.com authichain.com; do
  if getent hosts "$h" >/dev/null; then
    code=$(curl -s -o /dev/null -m 15 -w "%{http_code}" "https://$h/")
    echo "$h  resolves, https -> $code"
  else
    echo "$h  NO RESOLUTION"
  fi
done
