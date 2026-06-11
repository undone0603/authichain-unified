#!/usr/bin/env bash
for u in https://authichain.com/ https://authichain.com/some-page https://authichain.com/login https://www.authichain.com/pricing https://www.authichain.com/; do
  code=$(curl -s -o /dev/null -m 20 -w "%{http_code}" "$u")
  loc=$(curl -s -o /dev/null -m 20 -w "%{redirect_url}" "$u")
  echo "$u  ->  $code  $loc"
done
echo -n "Launch App refs on deep path: "
curl -s -m 20 https://authichain.com/some-page | grep -c "Launch App" || true
