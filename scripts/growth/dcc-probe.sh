#!/usr/bin/env bash
# Temporary: learn the DCA iServices licence API shape. Removed before merge.
set -u
echo "id set: ${DCC_APP_ID:+yes} key set: ${DCC_APP_KEY:+yes}"
sudo apt-get install -y -qq poppler-utils >/dev/null 2>&1
for u in https://iservices.dca.ca.gov/docs/search https://iservices.dca.ca.gov/user-docs/user-guide https://iservices.dca.ca.gov/user_guide; do
  echo "=== $u"
  curl -sSL -m 30 "$u" | sed -e 's/<[^>]*>/ /g' | tr -s ' \n' | grep -v '^\s*$' | head -c 6000
  echo
done
echo "=== guide pdf"
curl -sSL -m 60 -o guide.pdf https://iservices.dca.ca.gov/docs/iservice_user_guide.pdf && pdftotext guide.pdf - | grep -v '^\s*$' | head -300
